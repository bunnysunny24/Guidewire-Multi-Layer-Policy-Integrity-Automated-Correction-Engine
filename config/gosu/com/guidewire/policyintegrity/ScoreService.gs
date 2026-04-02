package com.guidewire.policyintegrity

class ScoreService {

  function calculate(issues: PolicyIssue_Ext[]): int {
    var score = 100

    for (issue in issues.where(\i -> i.Status != PolicyIntegrityConstants.ISSUE_STATUS_RESOLVED)) {
      score -= deductionFor(issue.Severity.Code)
    }

    return clamp(score, 0, 100)
  }

  private function deductionFor(severity: String): int {
    if (severity == "Critical") {
      return 20
    }
    if (severity == "High") {
      return 10
    }
    if (severity == "Medium") {
      return 5
    }
    return 2
  }

  private function clamp(value: int, low: int, high: int): int {
    if (value < low) {
      return low
    }
    if (value > high) {
      return high
    }
    return value
  }
}
