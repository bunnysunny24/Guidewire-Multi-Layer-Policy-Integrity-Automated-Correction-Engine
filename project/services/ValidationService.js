const PolicyIssue = require("../entity/PolicyIssue");
const { createRuleConfigMap, rulesCatalog } = require("./ruleCatalog");

class ValidationService {
  static validate(policy, actor = "system", options = {}) {
    const drafts = [];
    const ruleConfigMap = options.ruleConfigMap || createRuleConfigMap(rulesCatalog);

    const addDraft = (draft) => {
      const config = ruleConfigMap[draft.ruleId];
      if (config && config.enabled === false) {
        return;
      }
      if (config && config.severity) {
        draft.severity = config.severity;
      }
      drafts.push(draft);
    };

    // Layer 1: Field validation.
    if (policy.premium == null || policy.premium < 0) {
      addDraft({
        issueType: "FieldValidation",
        description: "Premium is missing or negative",
        severity: "High",
        ruleId: "VAL_PREMIUM_NEGATIVE",
        issueKey: "premium.invalid",
        autoFixable: true,
        correctionMode: "Auto",
        correctionConfidence: 0.98
      });
    }

    if (!policy.address && policy.customer && policy.customer.address) {
      addDraft({
        issueType: "FieldValidation",
        description: "Policy address missing; can be copied from customer address",
        severity: "Low",
        ruleId: "VAL_POLICY_ADDRESS_MISSING",
        issueKey: "address.missing",
        autoFixable: true,
        correctionMode: "Auto",
        correctionConfidence: 0.95
      });
    }

    // Layer 2: Business validation.
    if (policy.coverage > 100000 && policy.premium < 5000) {
      addDraft({
        issueType: "BusinessValidation",
        description: "Premium too low for high coverage",
        severity: "Medium",
        ruleId: "BUS_COVERAGE_PREMIUM_MISMATCH",
        issueKey: "premium.coverage.mismatch",
        autoFixable: true,
        correctionMode: "Auto",
        correctionConfidence: 0.9
      });
    }

    if (!policy.configValid) {
      addDraft({
        issueType: "BusinessValidation",
        description: "Invalid policy configuration detected",
        severity: "Critical",
        ruleId: "BUS_POLICY_CONFIG_INVALID",
        issueKey: "policy.config.invalid",
        autoFixable: false,
        correctionMode: "Manual"
      });
    }

    // Layer 3: Cross-entity validation.
    if (!policy.customer) {
      addDraft({
        issueType: "CrossEntityValidation",
        description: "Missing customer on policy",
        severity: "Critical",
        ruleId: "XENT_MISSING_CUSTOMER",
        issueKey: "customer.missing",
        autoFixable: false,
        correctionMode: "Manual"
      });
    }

    if (policy.duplicateCustomerCandidate) {
      addDraft({
        issueType: "CrossEntityValidation",
        description: "Possible duplicate customer; merge suggested",
        severity: "Low",
        ruleId: "XENT_DUPLICATE_CUSTOMER",
        issueKey: "customer.duplicate.suspected",
        autoFixable: false,
        correctionMode: "Suggested",
        correctionConfidence: 0.7
      });
    }

    // Layer 4: Cross-system validation (simulated).
    if (policy.status === "Cancelled" && policy.billingActive) {
      addDraft({
        issueType: "CrossSystemValidation",
        description: "Billing active for cancelled policy",
        severity: "High",
        ruleId: "XSYS_BILLING_ACTIVE_ON_CANCELLED",
        issueKey: "billing.active.cancelled",
        autoFixable: true,
        correctionMode: "Auto",
        correctionConfidence: 0.92
      });
    }

    const existingKeys = new Set(
      policy.issues.map((i) => `${i.ruleId}|${i.issueKey}`)
    );

    const createdIssues = [];
    const now = new Date().toISOString();

    for (const draft of drafts) {
      const dedupeKey = `${draft.ruleId}|${draft.issueKey}`;
      if (existingKeys.has(dedupeKey)) {
        continue;
      }

      const issue = new PolicyIssue({
        ...draft,
        detectedAt: now,
        detectedBy: actor
      });

      policy.issues.push(issue);
      createdIssues.push(issue);
      existingKeys.add(dedupeKey);
    }

    return createdIssues;
  }
}

module.exports = ValidationService;
