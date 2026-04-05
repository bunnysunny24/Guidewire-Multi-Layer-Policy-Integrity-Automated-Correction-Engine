const PolicyCorrection = require("../entity/PolicyCorrection");

class CorrectionService {
  static process(policy, issues, actor = "system", options = {}) {
    const autoApplyCorrections = options.autoApplyCorrections !== false;
    const thresholdRaw = Number(options.autoApplyMinConfidence);
    const autoApplyMinConfidence = Number.isFinite(thresholdRaw)
      ? Math.max(0, Math.min(1, thresholdRaw))
      : 0;
    const appliedFixes = new Set();

    for (const issue of issues) {
      if (issue.alreadyCorrected) {
        continue;
      }

      if (issue.autoFixable && issue.correctionMode === "Auto") {
        const confidence = Number(issue.correctionConfidence || 0);
        const canAutoApply = autoApplyCorrections && confidence >= autoApplyMinConfidence;
        if (canAutoApply) {
          this.applyAutoFix(policy, issue, actor, appliedFixes);
        } else {
          issue.correctionMode = "Suggested";
          issue.status = "Suggested";
        }
        continue;
      }

      if (issue.correctionMode === "Suggested") {
        issue.status = "Suggested";
        continue;
      }

      if (issue.severity === "Critical") {
        issue.status = "Blocked";
      }
    }
  }

  static applyApprovedSuggestion(policy, issue, actor = "reviewer.user") {
    if (!issue || issue.status !== "Suggested") {
      return null;
    }

    issue.status = "Approved";
    const beforeCount = policy.corrections.length;

    if (issue.autoFixable) {
      this.applyAutoFix(policy, issue, actor, new Set());
    }

    const afterCount = policy.corrections.length;
    if (afterCount > beforeCount) {
      return policy.corrections[afterCount - 1];
    }

    if (issue.severity === "Critical") {
      issue.status = "Blocked";
    }

    return null;
  }

  static applyAutoFix(policy, issue, actor, appliedFixes) {
    const now = new Date().toISOString();

    if (
      issue.ruleId === "VAL_PREMIUM_NEGATIVE" ||
      issue.ruleId === "BUS_COVERAGE_PREMIUM_MISMATCH"
    ) {
      if (appliedFixes.has("AutoPremiumRecalculation")) {
        issue.alreadyCorrected = true;
        issue.status = "Resolved";
        issue.correctedAt = now;
        issue.correctedBy = actor;
        return;
      }

      const oldValue = String(policy.premium);
      const newValue = String(this.calculatePremium(policy));
      policy.premium = Number(newValue);

      policy.corrections.push(
        new PolicyCorrection({
          issueId: issue.issueKey,
          ruleId: issue.ruleId,
          correctionType: "AutoPremiumRecalculation",
          actionTaken: "Premium recalculated using coverage based formula",
          oldValue,
          newValue,
          correctedAt: now,
          correctedBy: actor
        })
      );

      issue.alreadyCorrected = true;
      issue.status = "Resolved";
      issue.correctedAt = now;
      issue.correctedBy = actor;
      appliedFixes.add("AutoPremiumRecalculation");
      return;
    }

    if (issue.ruleId === "VAL_POLICY_ADDRESS_MISSING" && policy.customer?.address) {
      const oldValue = String(policy.address);
      const newValue = String(policy.customer.address);
      policy.address = policy.customer.address;

      policy.corrections.push(
        new PolicyCorrection({
          issueId: issue.issueKey,
          ruleId: issue.ruleId,
          correctionType: "AutoAddressAutofill",
          actionTaken: "Policy address copied from customer profile",
          oldValue,
          newValue,
          correctedAt: now,
          correctedBy: actor
        })
      );

      issue.alreadyCorrected = true;
      issue.status = "Resolved";
      issue.correctedAt = now;
      issue.correctedBy = actor;
      return;
    }

    issue.status = "Suggested";
    issue.correctionMode = "Suggested";
  }

  static calculatePremium(policy) {
    if (!policy.coverage || policy.coverage <= 0) {
      return 1000;
    }

    const calculated = policy.coverage * 0.06;
    return Math.max(1000, Math.round(calculated));
  }
}

module.exports = CorrectionService;
