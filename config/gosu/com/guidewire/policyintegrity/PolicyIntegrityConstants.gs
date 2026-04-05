package com.guidewire.policyintegrity

class PolicyIntegrityConstants {
  static final var RULE_PREMIUM_NEGATIVE = "VAL_PREMIUM_NEGATIVE"
  static final var RULE_POLICY_ADDRESS_MISSING = "VAL_POLICY_ADDRESS_MISSING"
  static final var RULE_COVERAGE_PREMIUM_MISMATCH = "BUS_COVERAGE_PREMIUM_MISMATCH"
  static final var RULE_MISSING_CUSTOMER = "XENT_MISSING_CUSTOMER"
  static final var RULE_BILLING_ACTIVE_ON_CANCELLED = "XSYS_BILLING_ACTIVE_ON_CANCELLED"
  static final var RULE_DUPLICATE_CUSTOMER = "XENT_DUPLICATE_CUSTOMER"
  static final var RULE_POLICY_CONFIG_INVALID = "BUS_POLICY_CONFIG_INVALID"

  static final var ISSUE_STATUS_OPEN = "Open"
  static final var ISSUE_STATUS_RESOLVED = "Resolved"
  static final var ISSUE_STATUS_SUGGESTED = "Suggested"
  static final var ISSUE_STATUS_BLOCKED = "Blocked"
}
