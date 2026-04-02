const ValidationService = require("../services/ValidationService");
const CorrectionService = require("../services/CorrectionService");
const ScoreService = require("../services/ScoreService");

class PolicyIntegrityEngine {
  static run(policy, actor = "demo.user") {
    console.log("\nRunning Policy Integrity Engine...");

    // 1) Detect + classify.
    const firstPassIssues = ValidationService.validate(policy, actor);
    policy.integrityScoreBefore = ScoreService.calculate(firstPassIssues);

    // 2) Correct/suggest/block.
    CorrectionService.process(policy, firstPassIssues, actor);

    // 3) Re-validate exactly once (dedupe logic avoids duplicate issue records).
    ValidationService.validate(policy, actor);

    // 4) Final scoring and audit snapshot.
    policy.integrityScoreAfter = ScoreService.calculate(policy.issues);
    policy.integrityScore = policy.integrityScoreAfter;
    policy.lastRunAt = new Date().toISOString();

    const blocked = policy.issues.filter((i) => i.status === "Blocked");

    return {
      policy,
      issues: policy.issues,
      corrections: policy.corrections,
      scoreBefore: policy.integrityScoreBefore,
      scoreAfter: policy.integrityScoreAfter,
      blocked,
      canProceed: blocked.length === 0
    };
  }
}

module.exports = PolicyIntegrityEngine;
