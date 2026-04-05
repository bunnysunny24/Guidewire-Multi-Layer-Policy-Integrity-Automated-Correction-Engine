const PolicyCorrection = require("../entity/PolicyCorrection");
const Customer = require("../model/Customer");

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

    const beforeCount = policy.corrections.length;
    let correction = null;

    if (issue.autoFixable) {
      correction = this.applyAutoFix(policy, issue, actor, new Set());
    } else {
      correction = this.applySuggestedResolution(policy, issue, actor);
    }

    const afterCount = policy.corrections.length;
    if (afterCount > beforeCount) {
      return policy.corrections[afterCount - 1];
    }

    if (issue.status !== "Resolved") {
      issue.status = "Approved";
      if (issue.severity === "Critical") {
        issue.status = "Blocked";
      }
    }

    return correction;
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

      const correction = this.addCorrection(policy, {
        issueId: issue.issueKey,
        ruleId: issue.ruleId,
        correctionType: "AutoPremiumRecalculation",
        actionTaken: "Premium recalculated using coverage based formula",
        oldValue,
        newValue,
        correctedAt: now,
        correctedBy: actor
      });

      this.markIssueResolved(issue, now, actor);
      appliedFixes.add("AutoPremiumRecalculation");
      return correction;
    }

    if (issue.ruleId === "VAL_POLICY_ADDRESS_MISSING" && policy.customer?.address) {
      const oldValue = String(policy.address);
      const newValue = String(policy.customer.address);
      policy.address = policy.customer.address;

      const correction = this.addCorrection(policy, {
        issueId: issue.issueKey,
        ruleId: issue.ruleId,
        correctionType: "AutoAddressAutofill",
        actionTaken: "Policy address copied from customer profile",
        oldValue,
        newValue,
        correctedAt: now,
        correctedBy: actor
      });

      this.markIssueResolved(issue, now, actor);
      return correction;
    }

    if (issue.ruleId === "XSYS_BILLING_ACTIVE_ON_CANCELLED" && policy.status === "Cancelled") {
      const oldValue = String(policy.billingActive);
      const newValue = "false";
      policy.billingActive = false;

      const correction = this.addCorrection(policy, {
        issueId: issue.issueKey,
        ruleId: issue.ruleId,
        correctionType: "AutoBillingDeactivation",
        actionTaken: "Billing deactivated because policy is cancelled",
        oldValue,
        newValue,
        correctedAt: now,
        correctedBy: actor
      });

      this.markIssueResolved(issue, now, actor);
      return correction;
    }

    issue.status = "Suggested";
    issue.correctionMode = "Suggested";
    return null;
  }

  static applySuggestedResolution(policy, issue, actor) {
    const now = new Date().toISOString();

    if (issue.ruleId === "XENT_DUPLICATE_CUSTOMER") {
      const oldValue = String(Boolean(policy.duplicateCustomerCandidate));
      const newValue = "false";
      policy.duplicateCustomerCandidate = false;

      const correction = this.addCorrection(policy, {
        issueId: issue.issueKey,
        ruleId: issue.ruleId,
        correctionType: "SuggestedDuplicateResolution",
        actionTaken: "Duplicate customer candidate reviewed and cleared",
        oldValue,
        newValue,
        correctedAt: now,
        correctedBy: actor
      });

      this.markIssueResolved(issue, now, actor);
      return correction;
    }

    return null;
  }

  static applyManualResolution(policy, issue, actor = "reviewer.user", options = {}) {
    if (!issue) {
      return null;
    }

    const now = new Date().toISOString();

    if (issue.ruleId === "BUS_POLICY_CONFIG_INVALID") {
      const oldValue = String(Boolean(policy.configValid));
      policy.configValid = true;

      const correction = this.addCorrection(policy, {
        issueId: issue.issueKey,
        ruleId: issue.ruleId,
        correctionType: "ManualConfigNormalization",
        actionTaken: "Configuration validated and normalized by reviewer",
        oldValue,
        newValue: String(Boolean(policy.configValid)),
        correctedAt: now,
        correctedBy: actor
      });

      this.markIssueResolved(issue, now, actor);
      return correction;
    }

    if (issue.ruleId === "XENT_MISSING_CUSTOMER") {
      const fallbackName = options.customerName || policy.customerNameHint || "Recovered Customer";
      const fallbackAddress = options.customerAddress || policy.customerAddressHint || policy.address || null;
      const oldValue = policy.customer?.id || "null";

      policy.customer = new Customer({
        id: `CUST-MAN-${Date.now()}`,
        name: fallbackName,
        address: fallbackAddress
      });

      const correction = this.addCorrection(policy, {
        issueId: issue.issueKey,
        ruleId: issue.ruleId,
        correctionType: "ManualCustomerLinkResolution",
        actionTaken: "Customer linked by reviewer resolution",
        oldValue,
        newValue: policy.customer.id,
        correctedAt: now,
        correctedBy: actor
      });

      this.markIssueResolved(issue, now, actor);
      return correction;
    }

    const correction = this.addCorrection(policy, {
      issueId: issue.issueKey,
      ruleId: issue.ruleId,
      correctionType: "ManualIssueOverride",
      actionTaken: "Manual reviewer override applied",
      oldValue: issue.status,
      newValue: "Resolved",
      correctedAt: now,
      correctedBy: actor
    });

    this.markIssueResolved(issue, now, actor);
    return correction;
  }

  static addCorrection(policy, payload) {
    const correction = new PolicyCorrection(payload);
    policy.corrections.push(correction);
    return correction;
  }

  static markIssueResolved(issue, correctedAt, correctedBy) {
    issue.alreadyCorrected = true;
    issue.status = "Resolved";
    issue.correctedAt = correctedAt;
    issue.correctedBy = correctedBy;
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
