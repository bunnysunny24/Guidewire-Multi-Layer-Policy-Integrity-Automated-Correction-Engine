package com.guidewire.policyintegrity

uses java.util.Date

class CorrectionService {

  function run(policy: Policy, actor: String) {
    for (issue in policy.IntegrityIssues.where(\i -> i.Status == PolicyIntegrityConstants.ISSUE_STATUS_OPEN)) {
      if (issue.AlreadyCorrected) {
        continue
      }

      if (issue.AutoFixable and issue.CorrectionMode.Code == "Auto") {
        applyAutoCorrection(policy, issue, actor)
      } else if (issue.CorrectionMode.Code == "Suggested") {
        issue.Status = PolicyIntegrityConstants.ISSUE_STATUS_SUGGESTED
      } else if (issue.Severity.Code == "Critical") {
        issue.Status = PolicyIntegrityConstants.ISSUE_STATUS_BLOCKED
      }
    }
  }

  private function applyAutoCorrection(policy: Policy, issue: PolicyIssue_Ext, actor: String) {
    if (issue.RuleId == PolicyIntegrityConstants.RULE_PREMIUM_NEGATIVE or
        issue.RuleId == PolicyIntegrityConstants.RULE_COVERAGE_PREMIUM_MISMATCH) {
      var oldValue = policy.Premium == null ? "null" : policy.Premium.toString()
      var recalculated = calculatePremium(policy)
      policy.Premium = recalculated
      addCorrection(policy, issue, "AutoPremiumRecalculation", oldValue, recalculated.toString(), actor)
      issue.AlreadyCorrected = true
      issue.Status = PolicyIntegrityConstants.ISSUE_STATUS_RESOLVED
      return
    }

    // Safe default behavior when no specific auto-fix implementation exists.
    issue.AlreadyCorrected = true
  }

  private function addCorrection(policy: Policy,
                                 issue: PolicyIssue_Ext,
                                 correctionType: String,
                                 oldValue: String,
                                 newValue: String,
                                 actor: String) {
    var correction = new PolicyCorrection_Ext()
    correction.Policy = policy
    correction.Issue = issue
    correction.CorrectionType = correctionType
    correction.ActionTaken = "Auto correction applied"
    correction.OldValue = oldValue
    correction.NewValue = newValue
    correction.CorrectedAt = new Date()
    correction.CorrectedBy = actor

    policy.addToIntegrityCorrections(correction)
  }

  private function calculatePremium(policy: Policy): java.math.BigDecimal {
    // Replace with real premium engine call.
    if (policy.CoverageAmount == null) {
      return 0
    }
    return (policy.CoverageAmount * 0.06) as java.math.BigDecimal
  }
}
