const express = require("express");
const path = require("path");
const PolicyIntegrityEngine = require("../project/engine/PolicyIntegrityEngine");
const { mapRequestToPolicy } = require("./policyMapper");
const { createRuleConfigMap } = require("../project/services/ruleCatalog");
const {
  state,
  listPolicies,
  getPolicy,
  createPolicy,
  updatePolicy,
  pushAudit
} = require("./platformStore");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "policy-integrity-sim", timestamp: new Date().toISOString() });
});

app.get("/api/demo-cases", (req, res) => {
  res.json({
    cases: [
      {
        name: "Case 1 - Auto Fix + Suggestion",
        payload: {
          premium: -500,
          coverage: 200000,
          status: "Active",
          hasCustomer: true,
          customerName: "Aarav Sharma",
          customerAddress: "12 Green Street",
          policyAddress: null,
          duplicateCustomerCandidate: true,
          billingActive: false,
          configValid: true
        }
      },
      {
        name: "Case 2 - Suggestion Only",
        payload: {
          premium: 8000,
          coverage: 150000,
          status: "Active",
          hasCustomer: true,
          customerName: "Aarav Sharma",
          customerAddress: "12 Green Street",
          policyAddress: "12 Green Street",
          duplicateCustomerCandidate: true,
          billingActive: false,
          configValid: true
        }
      },
      {
        name: "Case 3 - Blocked",
        payload: {
          premium: 9000,
          coverage: 100000,
          status: "Active",
          hasCustomer: true,
          customerName: "Aarav Sharma",
          customerAddress: "12 Green Street",
          policyAddress: null,
          duplicateCustomerCandidate: false,
          billingActive: false,
          configValid: false
        }
      }
    ]
  });
});

function platformPolicySummary(policy) {
  return {
    policyId: policy.policyId,
    status: policy.status,
    scoreBefore: policy.scoreBefore,
    scoreAfter: policy.scoreAfter,
    canProceed: policy.canProceed,
    lastRunAt: policy.lastRunAt,
    input: policy.input,
    issueCount: policy.issues.length,
    correctionCount: policy.corrections.length
  };
}

function getPlatformRuleMap() {
  return createRuleConfigMap(state.rules);
}

function computePolicyStatus(runResult) {
  if (!runResult.canProceed) {
    return "INVALID";
  }
  if (runResult.corrections.length > 0) {
    return "CORRECTED";
  }
  return "VALID";
}

app.post("/api/validate-policy", (req, res) => {
  try {
    const actor = req.body.actor || "ui.user";
    const policy = mapRequestToPolicy(req.body);
    const result = PolicyIntegrityEngine.run(policy, actor, {
      ruleConfigMap: getPlatformRuleMap()
    });

    res.json({
      policyId: result.policy.id,
      scoreBefore: result.scoreBefore,
      scoreAfter: result.scoreAfter,
      canProceed: result.canProceed,
      blockedCount: result.blocked.length,
      issues: result.issues,
      corrections: result.corrections,
      summary: {
        open: result.issues.filter((i) => i.status === "Open").length,
        resolved: result.issues.filter((i) => i.status === "Resolved").length,
        suggested: result.issues.filter((i) => i.status === "Suggested").length,
        blocked: result.issues.filter((i) => i.status === "Blocked").length
      }
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to run policy integrity simulation",
      error: error.message
    });
  }
});

app.get("/api/platform/bootstrap", (req, res) => {
  const policies = listPolicies().map(platformPolicySummary);
  res.json({
    policies,
    rules: state.rules,
    auditEvents: state.auditEvents.slice(0, 100)
  });
});

app.post("/api/platform/policies", (req, res) => {
  const payload = req.body || {};
  const created = createPolicy(payload);
  res.status(201).json(platformPolicySummary(created));
});

app.put("/api/platform/policies/:policyId", (req, res) => {
  const updated = updatePolicy(req.params.policyId, req.body || {});
  if (!updated) {
    res.status(404).json({ message: "Policy not found" });
    return;
  }
  res.json(platformPolicySummary(updated));
});

app.post("/api/platform/policies/:policyId/run", (req, res) => {
  const record = getPolicy(req.params.policyId);
  if (!record) {
    res.status(404).json({ message: "Policy not found" });
    return;
  }

  const actor = req.body.actor || "platform.user";
  const runtimePolicy = mapRequestToPolicy({ ...record.input, id: record.policyId });
  const runResult = PolicyIntegrityEngine.run(runtimePolicy, actor, {
    ruleConfigMap: getPlatformRuleMap()
  });

  record.issues = runResult.issues;
  record.corrections = runResult.corrections;
  record.logs = runResult.logs;
  record.scoreBefore = runResult.scoreBefore;
  record.scoreAfter = runResult.scoreAfter;
  record.canProceed = runResult.canProceed;
  record.status = computePolicyStatus(runResult);
  record.lastRunAt = new Date().toISOString();

  runResult.logs.forEach((log) => {
    pushAudit(record.policyId, log.step, log.message, { step: log.step });
  });

  runResult.issues.forEach((issue) => {
    pushAudit(record.policyId, "Validation", `Issue: ${issue.ruleId} (${issue.status})`, {
      ruleId: issue.ruleId,
      severity: issue.severity,
      status: issue.status
    });
  });

  runResult.corrections.forEach((correction) => {
    pushAudit(record.policyId, "Correction", `${correction.correctionType} applied`, {
      correctionType: correction.correctionType,
      ruleId: correction.ruleId
    });
  });

  res.json({
    policy: platformPolicySummary(record),
    issues: record.issues,
    corrections: record.corrections,
    logs: record.logs,
    scoreBefore: record.scoreBefore,
    scoreAfter: record.scoreAfter,
    canProceed: record.canProceed,
    summary: {
      open: record.issues.filter((i) => i.status === "Open").length,
      resolved: record.issues.filter((i) => i.status === "Resolved").length,
      suggested: record.issues.filter((i) => i.status === "Suggested").length,
      blocked: record.issues.filter((i) => i.status === "Blocked").length
    }
  });
});

app.get("/api/platform/issues", (req, res) => {
  const { severity, ruleId, policyId, search } = req.query;
  let issues = [];

  listPolicies().forEach((policy) => {
    policy.issues.forEach((issue) => {
      issues.push({
        policyId: policy.policyId,
        status: issue.status,
        ...issue
      });
    });
  });

  if (severity) {
    issues = issues.filter((i) => i.severity === severity);
  }
  if (ruleId) {
    issues = issues.filter((i) => i.ruleId === ruleId);
  }
  if (policyId) {
    issues = issues.filter((i) => i.policyId === policyId);
  }
  if (search) {
    const s = String(search).toLowerCase();
    issues = issues.filter((i) =>
      i.description.toLowerCase().includes(s) ||
      i.ruleId.toLowerCase().includes(s) ||
      i.policyId.toLowerCase().includes(s)
    );
  }

  res.json({ issues });
});

app.get("/api/platform/corrections", (req, res) => {
  const corrections = [];
  listPolicies().forEach((policy) => {
    policy.corrections.forEach((correction) => {
      corrections.push({
        policyId: policy.policyId,
        ...correction
      });
    });
  });
  res.json({ corrections });
});

app.get("/api/platform/audits", (req, res) => {
  const { policyId } = req.query;
  let events = state.auditEvents;
  if (policyId) {
    events = events.filter((e) => e.policyId === policyId);
  }
  res.json({ events: events.slice(0, 200) });
});

app.get("/api/platform/rules", (req, res) => {
  res.json({ rules: state.rules });
});

app.patch("/api/platform/rules/:ruleId", (req, res) => {
  const rule = state.rules.find((r) => r.ruleId === req.params.ruleId);
  if (!rule) {
    res.status(404).json({ message: "Rule not found" });
    return;
  }

  if (typeof req.body.enabled === "boolean") {
    rule.enabled = req.body.enabled;
  }
  if (typeof req.body.severity === "string") {
    rule.severity = req.body.severity;
  }

  pushAudit("GLOBAL", "Rules", `Rule updated: ${rule.ruleId}`, {
    enabled: rule.enabled,
    severity: rule.severity
  });

  res.json({ rule });
});

app.post("/api/platform/policies/:policyId/issues/:issueKey/action", (req, res) => {
  const policy = getPolicy(req.params.policyId);
  if (!policy) {
    res.status(404).json({ message: "Policy not found" });
    return;
  }

  const issue = policy.issues.find((i) => i.issueKey === req.params.issueKey);
  if (!issue) {
    res.status(404).json({ message: "Issue not found" });
    return;
  }

  const action = req.body.action;
  if (action === "approve" && issue.status === "Suggested") {
    issue.status = "Approved";
    pushAudit(policy.policyId, "Correction", `Suggestion approved for ${issue.ruleId}`);
  }
  if (action === "reject" && issue.status === "Suggested") {
    issue.status = "Rejected";
    pushAudit(policy.policyId, "Correction", `Suggestion rejected for ${issue.ruleId}`);
  }

  res.json({ issue });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.listen(PORT, () => {
  console.log(`Policy Integrity UI running at http://localhost:${PORT}`);
});
