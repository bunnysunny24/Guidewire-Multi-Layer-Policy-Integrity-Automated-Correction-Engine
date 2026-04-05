const test = require("node:test");
const assert = require("node:assert/strict");

const PolicyIntegrityEngine = require("../project/engine/PolicyIntegrityEngine");
const CorrectionService = require("../project/services/CorrectionService");
const Policy = require("../project/model/Policy");
const Customer = require("../project/model/Customer");

function buildCustomer() {
  return new Customer({
    id: "CUST-T1",
    name: "Test Customer",
    address: "12 Green Street"
  });
}

function findIssueByRule(issues, ruleId) {
  return issues.find((issue) => issue.ruleId === ruleId);
}

test("full-automation resolves auto-fixable issues and keeps suggestion queue", () => {
  const policy = new Policy({
    id: "POL-T1",
    premium: -500,
    coverage: 200000,
    customer: buildCustomer(),
    address: null,
    duplicateCustomerCandidate: true,
    configValid: true
  });

  const result = PolicyIntegrityEngine.run(policy, "test.user", {
    executionProfile: "full-automation",
    autoApplyMinConfidence: 0.9
  });

  assert.equal(result.scoreBefore, 81);
  assert.equal(result.scoreAfter, 98);
  assert.equal(result.canProceed, true);
  assert.equal(result.corrections.length, 2);

  assert.equal(findIssueByRule(result.issues, "VAL_PREMIUM_NEGATIVE").status, "Resolved");
  assert.equal(findIssueByRule(result.issues, "VAL_POLICY_ADDRESS_MISSING").status, "Resolved");
  assert.equal(findIssueByRule(result.issues, "BUS_COVERAGE_PREMIUM_MISMATCH").status, "Resolved");
  assert.equal(findIssueByRule(result.issues, "XENT_DUPLICATE_CUSTOMER").status, "Suggested");

  const dedupeKeys = result.issues.map((issue) => `${issue.ruleId}|${issue.issueKey}`);
  assert.equal(new Set(dedupeKeys).size, dedupeKeys.length);
});

test("validation-only mode does not apply corrections", () => {
  const policy = new Policy({
    id: "POL-T2",
    premium: -500,
    coverage: 200000,
    customer: buildCustomer(),
    address: null,
    duplicateCustomerCandidate: false,
    configValid: true
  });

  const result = PolicyIntegrityEngine.run(policy, "test.user", {
    executionProfile: "validation-only",
    enableValidation: true,
    enableCorrection: false,
    enableRevalidation: false,
    autoApplyCorrections: false
  });

  assert.equal(result.corrections.length, 0);
  assert.equal(result.issues.some((issue) => issue.status === "Open"), true);
  assert.equal(result.scoreBefore, result.scoreAfter);
});

test("critical manual issue blocks progression", () => {
  const policy = new Policy({
    id: "POL-T3",
    premium: 9000,
    coverage: 100000,
    customer: buildCustomer(),
    address: "12 Green Street",
    configValid: false
  });

  const result = PolicyIntegrityEngine.run(policy, "test.user");

  const issue = findIssueByRule(result.issues, "BUS_POLICY_CONFIG_INVALID");
  assert.ok(issue);
  assert.equal(issue.status, "Blocked");
  assert.equal(result.canProceed, false);
});

test("approved suggestion applies correction for auto-fixable suggested issue", () => {
  const policy = new Policy({
    id: "POL-T4",
    premium: -500,
    coverage: 200000,
    customer: buildCustomer(),
    address: "12 Green Street",
    duplicateCustomerCandidate: false,
    configValid: true
  });

  const result = PolicyIntegrityEngine.run(policy, "test.user", {
    executionProfile: "human-in-loop",
    enableValidation: true,
    enableCorrection: true,
    enableRevalidation: true,
    autoApplyCorrections: true,
    autoApplyMinConfidence: 0.99
  });

  const issue = findIssueByRule(result.issues, "VAL_PREMIUM_NEGATIVE");
  assert.ok(issue);
  assert.equal(issue.status, "Suggested");

  const beforeCorrections = result.policy.corrections.length;
  const correction = CorrectionService.applyApprovedSuggestion(result.policy, issue, "reviewer.user");

  assert.ok(correction);
  assert.equal(issue.status, "Resolved");
  assert.equal(result.policy.corrections.length, beforeCorrections + 1);
});

test("full-automation auto-fixes billing active on cancelled policy", () => {
  const policy = new Policy({
    id: "POL-T5",
    premium: 6000,
    coverage: 100000,
    status: "Cancelled",
    customer: buildCustomer(),
    address: "12 Green Street",
    billingActive: true,
    configValid: true
  });

  const result = PolicyIntegrityEngine.run(policy, "test.user", {
    executionProfile: "full-automation",
    autoApplyMinConfidence: 0.9
  });

  const issue = findIssueByRule(result.issues, "XSYS_BILLING_ACTIVE_ON_CANCELLED");
  assert.ok(issue);
  assert.equal(issue.status, "Resolved");
  assert.equal(result.policy.billingActive, false);
  assert.equal(result.corrections.some((item) => item.correctionType === "AutoBillingDeactivation"), true);
});

test("approving duplicate suggestion clears duplicate candidate and records correction", () => {
  const policy = new Policy({
    id: "POL-T6",
    premium: 8000,
    coverage: 100000,
    customer: buildCustomer(),
    address: "12 Green Street",
    duplicateCustomerCandidate: true,
    configValid: true
  });

  const result = PolicyIntegrityEngine.run(policy, "test.user", {
    executionProfile: "human-in-loop",
    enableValidation: true,
    enableCorrection: true,
    enableRevalidation: true,
    autoApplyCorrections: false
  });

  const issue = findIssueByRule(result.issues, "XENT_DUPLICATE_CUSTOMER");
  assert.ok(issue);
  assert.equal(issue.status, "Suggested");

  const correction = CorrectionService.applyApprovedSuggestion(result.policy, issue, "reviewer.user");
  assert.ok(correction);
  assert.equal(correction.correctionType, "SuggestedDuplicateResolution");
  assert.equal(result.policy.duplicateCustomerCandidate, false);
  assert.equal(issue.status, "Resolved");
});

test("manual resolve fixes blocked config issue", () => {
  const policy = new Policy({
    id: "POL-T7",
    premium: 9000,
    coverage: 100000,
    customer: buildCustomer(),
    address: "12 Green Street",
    configValid: false
  });

  const result = PolicyIntegrityEngine.run(policy, "test.user", {
    executionProfile: "full-automation"
  });

  const issue = findIssueByRule(result.issues, "BUS_POLICY_CONFIG_INVALID");
  assert.ok(issue);
  assert.equal(issue.status, "Blocked");

  const correction = CorrectionService.applyManualResolution(result.policy, issue, "reviewer.user");
  assert.ok(correction);
  assert.equal(correction.correctionType, "ManualConfigNormalization");
  assert.equal(result.policy.configValid, true);
  assert.equal(issue.status, "Resolved");
});

test("manual resolve links customer for missing-customer issue", () => {
  const policy = new Policy({
    id: "POL-T8",
    premium: 8000,
    coverage: 100000,
    customer: null,
    customerNameHint: "Recovered Customer",
    customerAddressHint: "45 Lake Street",
    address: "45 Lake Street",
    configValid: true
  });

  const result = PolicyIntegrityEngine.run(policy, "test.user", {
    executionProfile: "full-automation"
  });

  const issue = findIssueByRule(result.issues, "XENT_MISSING_CUSTOMER");
  assert.ok(issue);
  assert.equal(issue.status, "Blocked");

  const correction = CorrectionService.applyManualResolution(result.policy, issue, "reviewer.user");
  assert.ok(correction);
  assert.equal(correction.correctionType, "ManualCustomerLinkResolution");
  assert.ok(result.policy.customer);
  assert.equal(result.policy.customer.name, "Recovered Customer");
  assert.equal(issue.status, "Resolved");
});
