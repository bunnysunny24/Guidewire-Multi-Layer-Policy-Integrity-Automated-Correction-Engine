const ValidationService = require("../services/ValidationService");
const CorrectionService = require("../services/CorrectionService");
const ScoreService = require("../services/ScoreService");

class PolicyIntegrityEngine {
  static run(policy, actor = "demo.user", options = {}) {
    console.log("\nRunning Policy Integrity Engine...");
    const logs = [];

    const logStep = (step, message) => {
      const entry = {
        step,
        message,
        at: new Date().toISOString()
      };
      logs.push(entry);
      if (typeof options.onStep === "function") {
        options.onStep(entry);
      }
    };

    // 1) Detect + classify.
    logStep("Detect", "Running validation pass 1");
    const firstPassIssues = ValidationService.validate(policy, actor, {
      ruleConfigMap: options.ruleConfigMap
    });
    policy.integrityScoreBefore = ScoreService.calculate(firstPassIssues);
    logStep("Classify", `Detected ${firstPassIssues.length} issue(s)`);

    // 2) Correct/suggest/block.
    logStep("Correct", "Applying correction governance");
    CorrectionService.process(policy, firstPassIssues, actor);

    // 3) Re-validate exactly once (dedupe logic avoids duplicate issue records).
    logStep("Re-validate", "Running validation pass 2");
    ValidationService.validate(policy, actor, {
      ruleConfigMap: options.ruleConfigMap
    });

    // 4) Final scoring and audit snapshot.
    logStep("Score", "Calculating weighted integrity score");
    policy.integrityScoreAfter = ScoreService.calculate(policy.issues);
    policy.integrityScore = policy.integrityScoreAfter;
    policy.lastRunAt = new Date().toISOString();
    logStep("Audit", `Score updated ${policy.integrityScoreBefore} -> ${policy.integrityScoreAfter}`);

    const blocked = policy.issues.filter((i) => i.status === "Blocked");

    return {
      policy,
      issues: policy.issues,
      corrections: policy.corrections,
      scoreBefore: policy.integrityScoreBefore,
      scoreAfter: policy.integrityScoreAfter,
      blocked,
      canProceed: blocked.length === 0,
      logs
    };
  }
}

module.exports = PolicyIntegrityEngine;
