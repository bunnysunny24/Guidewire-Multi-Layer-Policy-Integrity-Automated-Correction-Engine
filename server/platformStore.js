const { rulesCatalog } = require("../project/services/ruleCatalog");

let policyCounter = 1000;
let eventCounter = 1;

const state = {
  policies: [],
  rules: rulesCatalog.map((rule) => ({
    ruleId: rule.ruleId,
    name: rule.name,
    layer: rule.layer,
    enabled: rule.enabled,
    severity: rule.defaultSeverity
  })),
  auditEvents: []
};

function nextPolicyId() {
  policyCounter += 1;
  return `POL-PLT-${policyCounter}`;
}

function pushAudit(policyId, module, message, meta = {}) {
  state.auditEvents.unshift({
    eventId: `AUD-${eventCounter++}`,
    policyId,
    module,
    message,
    timestamp: new Date().toISOString(),
    meta
  });
}

function listPolicies() {
  return state.policies;
}

function getPolicy(policyId) {
  return state.policies.find((p) => p.policyId === policyId) || null;
}

function createPolicy(input) {
  const policy = {
    policyId: nextPolicyId(),
    input,
    status: "NEW",
    statusHistory: [
      {
        status: "NEW",
        at: new Date().toISOString()
      }
    ],
    scoreBefore: 100,
    scoreAfter: 100,
    issues: [],
    corrections: [],
    logs: [],
    lastRunAt: null,
    canProceed: true
  };

  state.policies.unshift(policy);
  pushAudit(policy.policyId, "Workbench", "Policy created", { policyId: policy.policyId });
  return policy;
}

function updatePolicy(policyId, input) {
  const policy = getPolicy(policyId);
  if (!policy) {
    return null;
  }
  policy.input = input;
  if (policy.status !== "NEW") {
    policy.status = "NEW";
    policy.statusHistory.push({
      status: "NEW",
      at: new Date().toISOString()
    });
  }
  pushAudit(policyId, "Workbench", "Policy updated", { policyId });
  return policy;
}

function upsertPolicy(policyId, input) {
  if (!policyId) {
    return createPolicy(input);
  }
  return updatePolicy(policyId, input);
}

module.exports = {
  state,
  listPolicies,
  getPolicy,
  createPolicy,
  updatePolicy,
  upsertPolicy,
  pushAudit
};
