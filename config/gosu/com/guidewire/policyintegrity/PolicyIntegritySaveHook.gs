package com.guidewire.policyintegrity

class PolicyIntegritySaveHook {

  static function onPolicyPreUpdate(policy: Policy) {
    var actor = gw.api.system.BundleUserUtil.getCurrentUserName()
    var orchestrator = new PolicyIntegrityOrchestrator()
    orchestrator.execute(policy, actor)

    if (hasBlockingIssues(policy)) {
      throw new DisplayableException("Policy save blocked by critical integrity issues.")
    }
  }

  private static function hasBlockingIssues(policy: Policy): boolean {
    return policy.IntegrityIssues.HasElements and
      policy.IntegrityIssues.where(\i -> i.Status == PolicyIntegrityConstants.ISSUE_STATUS_BLOCKED).Count > 0
  }
}
