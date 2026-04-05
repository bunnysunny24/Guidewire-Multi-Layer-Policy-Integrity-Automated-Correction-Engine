const ValidationService = require("../services/ValidationService");
const CorrectionService = require("../services/CorrectionService");
const ScoreService = require("../services/ScoreService");

class PolicyIntegrityEngine {
  static run(policy, actor = "demo.user", options = {}) {
    console.log("\nRunning Policy Integrity Engine...");
    const logs = [];
    const enableValidation = options.enableValidation !== false;
    const enableCorrection = options.enableCorrection !== false;
    const enableRevalidation = options.enableRevalidation !== false;
    const autoApplyCorrections = options.autoApplyCorrections !== false;
    const autoApplyMinConfidence = Number.isFinite(Number(options.autoApplyMinConfidence))
      ? Number(options.autoApplyMinConfidence)
      : 0;
    const executionProfile = options.executionProfile || "full-automation";

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
    let firstPassIssues = [];
    if (enableValidation) {
      logStep("Detect", "Running validation pass 1");
      firstPassIssues = ValidationService.validate(policy, actor, {
        ruleConfigMap: options.ruleConfigMap
      });
    } else {
      logStep("Detect", "Validation layer disabled by governance profile");
    }

    policy.integrityScoreBefore = ScoreService.calculate(firstPassIssues);
    logStep("Classify", `Profile ${executionProfile} detected ${firstPassIssues.length} issue(s)`);

    // 2) Correct/suggest/block.
    if (enableCorrection) {
      logStep("Correct", "Applying correction governance");
      CorrectionService.process(policy, firstPassIssues, actor, {
        autoApplyCorrections,
        autoApplyMinConfidence
      });
    } else {
      logStep("Correct", "Correction layer disabled by governance profile");
    }

    // 3) Re-validate exactly once (dedupe logic avoids duplicate issue records).
    if (enableValidation && enableRevalidation) {
      logStep("Re-validate", "Running validation pass 2");
      ValidationService.validate(policy, actor, {
        ruleConfigMap: options.ruleConfigMap
      });
    } else {
      logStep("Re-validate", "Re-validation skipped for current profile");
    }

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
