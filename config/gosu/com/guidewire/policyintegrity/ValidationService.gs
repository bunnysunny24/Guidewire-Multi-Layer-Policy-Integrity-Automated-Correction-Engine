package com.guidewire.policyintegrity

uses java.util.ArrayList
uses java.util.Date
uses java.util.List

class ValidationService {

  function run(policy: Policy, actor: String): List<PolicyIssue_Ext> {
    var created = new ArrayList<PolicyIssue_Ext>()

    for (draft in buildDraftIssues(policy)) {
      if (isDuplicateIssue(policy, draft.RuleId, draft.IssueKey)) {
        continue
      }

      var issue = new PolicyIssue_Ext()
      issue.Policy = policy
      issue.IssueType = draft.IssueType
      issue.Description = draft.Description
      issue.Severity = typekey.PISeverity.getTypeKey(draft.SeverityCode)
      issue.RuleId = draft.RuleId
      issue.AutoFixable = draft.AutoFixable
      issue.CorrectionMode = typekey.PICorrectionMode.getTypeKey(draft.CorrectionModeCode)
      issue.CorrectionConfidence = draft.CorrectionConfidence
      issue.AlreadyCorrected = false
      issue.DetectedAt = new Date()
      issue.DetectedBy = actor
      issue.Status = PolicyIntegrityConstants.ISSUE_STATUS_OPEN
      issue.IssueKey = draft.IssueKey

      policy.addToIntegrityIssues(issue)
      created.add(issue)
    }

    return created
  }

  private function buildDraftIssues(policy: Policy): List<IssueDraft> {
    var drafts = new ArrayList<IssueDraft>()

    // Layer 1: Field validation.
    if (policy.Premium == null or policy.Premium < 0) {
      drafts.add(IssueDraft.of(
        "FieldValidation",
        "Premium is missing or negative",
        "High",
        PolicyIntegrityConstants.RULE_PREMIUM_NEGATIVE,
        true,
        "Auto",
        0.98,
        "premium.invalid"
      ))
    }

    if (not hasText(policy.PolicyAddressText) and hasText(policy.CustomerAddressText)) {
      drafts.add(IssueDraft.of(
        "FieldValidation",
        "Policy address missing; can be copied from customer address",
        "Low",
        PolicyIntegrityConstants.RULE_POLICY_ADDRESS_MISSING,
        true,
        "Auto",
        0.95,
        "address.missing"
      ))
    }

    // Layer 2: Business validation.
    if (policy.CoverageAmount != null and policy.Premium != null and policy.CoverageAmount > 100000 and policy.Premium < 5000) {
      drafts.add(IssueDraft.of(
        "BusinessValidation",
        "Premium too low for high coverage",
        "Medium",
        PolicyIntegrityConstants.RULE_COVERAGE_PREMIUM_MISMATCH,
        true,
        "Auto",
        0.90,
        "premium.coverage.mismatch"
      ))
    }

    // Layer 3: Cross-entity validation.
    if (policy.Account == null) {
      drafts.add(IssueDraft.of(
        "CrossEntityValidation",
        "Missing customer/account on policy",
        "Critical",
        PolicyIntegrityConstants.RULE_MISSING_CUSTOMER,
        false,
        "Manual",
        null,
        "policy.customer.missing"
      ))
    }

    // Layer 4: Cross-system simulation.
    if (policy.Status != null and policy.Status.Code == "cancelled" and hasActiveBilling(policy)) {
      drafts.add(IssueDraft.of(
        "CrossSystemValidation",
        "Billing active for a cancelled policy",
        "High",
        PolicyIntegrityConstants.RULE_BILLING_ACTIVE_ON_CANCELLED,
        false,
        "Manual",
        null,
        "billing.active.cancelled"
      ))
    }

    // Suggestion case: possible duplicate customer.
    if (possibleDuplicateCustomer(policy)) {
      drafts.add(IssueDraft.of(
        "CrossEntityValidation",
        "Possible duplicate customer; merge suggested",
        "Low",
        PolicyIntegrityConstants.RULE_DUPLICATE_CUSTOMER,
        false,
        "Suggested",
        0.70,
        "customer.duplicate.suspected"
      ))
    }

    // Blocking case: invalid critical product configuration.
    if (invalidPolicyConfiguration(policy)) {
      drafts.add(IssueDraft.of(
        "BusinessValidation",
        "Invalid policy configuration detected",
        "Critical",
        PolicyIntegrityConstants.RULE_POLICY_CONFIG_INVALID,
        false,
        "Manual",
        null,
        "policy.configuration.invalid"
      ))
    }

    return drafts
  }

  private function isDuplicateIssue(policy: Policy, ruleId: String, issueKey: String): boolean {
    return policy.IntegrityIssues.HasElements and
      policy.IntegrityIssues.where(\i -> i.RuleId == ruleId and i.IssueKey == issueKey and i.Status == PolicyIntegrityConstants.ISSUE_STATUS_OPEN).Count > 0
  }

  private function hasActiveBilling(policy: Policy): boolean {
    // Simulation driver backed by extension column; replace with BillingCenter integration call.
    return policy.BillingActive == true
  }

  private function possibleDuplicateCustomer(policy: Policy): boolean {
    // Simulation driver backed by extension column; replace with fuzzy matching service.
    return policy.DuplicateCustomerCandidate == true
  }

  private function invalidPolicyConfiguration(policy: Policy): boolean {
    // Simulation driver backed by extension column; replace with product model validation.
    return policy.ConfigValid == false
  }

  private function hasText(value: String): boolean {
    return value != null and value.trim().length() > 0
  }
}

class IssueDraft {
  var IssueType: String
  var Description: String
  var SeverityCode: String
  var RuleId: String
  var AutoFixable: boolean
  var CorrectionModeCode: String
  var CorrectionConfidence: java.math.BigDecimal
  var IssueKey: String

  static function of(issueType: String,
                     description: String,
                     severityCode: String,
                     ruleId: String,
                     autoFixable: boolean,
                     correctionModeCode: String,
                     correctionConfidence: java.math.BigDecimal,
                     issueKey: String): IssueDraft {
    var draft = new IssueDraft()
    draft.IssueType = issueType
    draft.Description = description
    draft.SeverityCode = severityCode
    draft.RuleId = ruleId
    draft.AutoFixable = autoFixable
    draft.CorrectionModeCode = correctionModeCode
    draft.CorrectionConfidence = correctionConfidence
    draft.IssueKey = issueKey
    return draft
  }
}
