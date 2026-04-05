const express = require("express");
const path = require("path");
const PolicyIntegrityEngine = require("../project/engine/PolicyIntegrityEngine");
const CorrectionService = require("../project/services/CorrectionService");
const ScoreService = require("../project/services/ScoreService");
const { mapRequestToPolicy } = require("./policyMapper");
const { createRuleConfigMap } = require("../project/services/ruleCatalog");
const {
  state,
  initializePlatformStore,
  listPolicies,
  getPolicy,
  createPolicy,
  updatePolicy,
  persistPolicySnapshot,
  upsertPolicySnapshot,
  persistRulesSnapshot,
  deletePolicy,
  resetPlatformState,
  resetRuleOverrides,
  pushAudit,
  getGovernanceConfig,
  updateGovernanceConfig,
  getRoiAssumptions,
  updateRoiAssumptions,
  listIntegrationEvents,
  createIntegrationEvent
} = require("./platformStore");

const app = express();
const PORT = process.env.PORT || 3000;
const MYSQL_HOST = process.env.MYSQL_HOST || "localhost";
const MYSQL_PORT = Number(process.env.MYSQL_PORT || 3306);
const MYSQL_USER = process.env.MYSQL_USER || "root";
const MYSQL_DATABASE = process.env.MYSQL_DATABASE || "guidewire_policy_integrity";
const VALID_GOVERNANCE_MODES = new Set(["validation-only", "human-in-loop", "full-automation"]);
const VALID_ISSUE_ACTIONS = new Set(["approve", "reject"]);
const DEFAULT_INTEGRATION_TARGETS = ["PolicyCenter", "BillingCenter"];

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
    createdAt: policy.createdAt,
    updatedAt: policy.updatedAt,
    statusHistory: policy.statusHistory || [],
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

function normalizeGovernanceMode(mode) {
  if (!mode) {
    return null;
  }
  const value = String(mode).trim().toLowerCase();
  if (VALID_GOVERNANCE_MODES.has(value)) {
    return value;
  }
  return null;
}

function resolveGovernanceForRun(payload = {}) {
  const base = getGovernanceConfig();
  const requestedMode = normalizeGovernanceMode(payload.profile || payload.mode);
  const mode = requestedMode || base.mode || "full-automation";

  const governance = {
    ...base,
    mode
  };

  if (mode === "validation-only") {
    governance.enableValidation = true;
    governance.enableCorrection = false;
    governance.enableRevalidation = false;
    governance.autoApplyCorrections = false;
  } else if (mode === "human-in-loop") {
    governance.enableValidation = true;
    governance.enableCorrection = true;
    governance.enableRevalidation = true;
    governance.autoApplyCorrections = false;
  } else {
    governance.enableValidation = governance.enableValidation !== false;
    governance.enableCorrection = governance.enableCorrection !== false;
    governance.enableRevalidation = governance.enableRevalidation !== false;
    governance.autoApplyCorrections = governance.autoApplyCorrections !== false;
  }

  if (!governance.enableValidation) {
    governance.enableCorrection = false;
    governance.enableRevalidation = false;
  }

  if (!governance.enableCorrection) {
    governance.autoApplyCorrections = false;
  }

  const threshold = Number(governance.autoApplyMinConfidence);
  governance.autoApplyMinConfidence = Number.isFinite(threshold)
    ? Math.max(0, Math.min(1, threshold))
    : 0.9;

  governance.emitIntegrationEvents = governance.emitIntegrationEvents !== false;
  return governance;
}

function buildEngineOptions(governance) {
  return {
    ruleConfigMap: getPlatformRuleMap(),
    executionProfile: governance.mode,
    enableValidation: governance.enableValidation,
    enableCorrection: governance.enableCorrection,
    enableRevalidation: governance.enableRevalidation,
    autoApplyCorrections: governance.autoApplyCorrections,
    autoApplyMinConfidence: governance.autoApplyMinConfidence
  };
}

function governanceSnapshot(governance) {
  return {
    mode: governance.mode,
    enableValidation: governance.enableValidation,
    enableCorrection: governance.enableCorrection,
    enableRevalidation: governance.enableRevalidation,
    autoApplyCorrections: governance.autoApplyCorrections,
    autoApplyMinConfidence: governance.autoApplyMinConfidence,
    emitIntegrationEvents: governance.emitIntegrationEvents
  };
}

function collectAllIssues() {
  const issues = [];
  listPolicies().forEach((policy) => {
    policy.issues.forEach((issue) => {
      issues.push({
        policyId: policy.policyId,
        ...issue
      });
    });
  });
  return issues;
}

function collectAllCorrections() {
  const corrections = [];
  listPolicies().forEach((policy) => {
    policy.corrections.forEach((correction) => {
      corrections.push({
        policyId: policy.policyId,
        ...correction
      });
    });
  });
  return corrections;
}

function computeRoiSummary() {
  const policies = listPolicies();
  const issues = collectAllIssues();
  const corrections = collectAllCorrections();
  const assumptions = getRoiAssumptions();

  const resolvedIssues = issues.filter((item) => item.status === "Resolved").length;
  const suggestedIssues = issues.filter(
    (item) => item.status === "Suggested" || item.status === "Approved" || item.status === "Rejected"
  ).length;
  const blockedPolicies = policies.filter((policy) => policy.status === "BLOCKED").length;
  const criticalOpen = issues.filter((item) => item.severity === "Critical" && item.status !== "Resolved").length;
  const autoCorrections = corrections.filter((item) =>
    String(item.correctionType || "").toLowerCase().startsWith("auto")
  ).length;

  const avgScore = policies.length
    ? Math.round(policies.reduce((sum, policy) => sum + (policy.scoreAfter || 0), 0) / policies.length)
    : 0;

  const weeklyHoursSaved = (autoCorrections * assumptions.minutesPerAutoCorrection) / 60;
  const weeklyReviewHours = (suggestedIssues * assumptions.reviewMinutesPerSuggestedIssue) / 60;
  const netWeeklyHours = Math.max(0, weeklyHoursSaved - weeklyReviewHours);
  const riskCostAvoided = blockedPolicies * assumptions.blockedCaseCostAvoided;
  const issueReductionPercent = issues.length > 0 ? Math.round((resolvedIssues / issues.length) * 100) : 0;

  return {
    assumptions,
    totals: {
      policies: policies.length,
      issues: issues.length,
      corrections: corrections.length,
      resolvedIssues,
      suggestedIssues,
      blockedPolicies,
      criticalOpen,
      avgScore,
      autoCorrections
    },
    roi: {
      weeklyHoursSaved: Number(weeklyHoursSaved.toFixed(2)),
      weeklyReviewHours: Number(weeklyReviewHours.toFixed(2)),
      netWeeklyHours: Number(netWeeklyHours.toFixed(2)),
      issueReductionPercent,
      riskCostAvoided: Number(riskCostAvoided.toFixed(2))
    },
    strategicValue: {
      headline: "Closed-loop policy governance lowers downstream compliance and servicing risk.",
      profile: getGovernanceConfig().mode,
      executiveSummary:
        "Preventing policy defects before issuance reduces expensive back-office rework and audit exceptions."
    }
  };
}

function createIntegrationPayload(record, runResult, governance, actor, source) {
  return {
    source,
    actor,
    governance: governanceSnapshot(governance),
    policy: {
      policyId: record.policyId,
      status: record.status,
      scoreBefore: runResult.scoreBefore,
      scoreAfter: runResult.scoreAfter,
      canProceed: runResult.canProceed
    },
    metrics: {
      issueCount: runResult.issues.length,
      correctionCount: runResult.corrections.length,
      blockedCount: runResult.blocked.length
    },
    generatedAt: new Date().toISOString()
  };
}

async function emitIntegrationEvents(record, runResult, governance, actor, source, explicitTargets = []) {
  if (!governance.emitIntegrationEvents) {
    return [];
  }

  const targets = Array.isArray(explicitTargets) && explicitTargets.length > 0
    ? [...new Set(explicitTargets.map((item) => String(item || "").trim()).filter(Boolean))]
    : DEFAULT_INTEGRATION_TARGETS;

  const events = [];
  for (const target of targets) {
    const event = await createIntegrationEvent({
      policyId: record.policyId,
      targetSystem: target,
      eventType: "PolicyIntegrityEvaluated",
      status: "Published",
      payload: createIntegrationPayload(record, runResult, governance, actor, source)
    });
    events.push(event);
  }

  return events;
}

function computePolicyStatus(runResult) {
  if (!runResult.canProceed) {
    return "BLOCKED";
  }
  if (runResult.corrections.length > 0) {
    return "CORRECTED";
  }
  return "VALIDATED";
}

function applyRunResult(record, runResult) {
  const now = new Date().toISOString();

  record.issues = runResult.issues;
  record.corrections = runResult.corrections;
  record.logs = runResult.logs;
  record.scoreBefore = runResult.scoreBefore;
  record.scoreAfter = runResult.scoreAfter;
  record.canProceed = runResult.canProceed;
  record.status = computePolicyStatus(runResult);
  record.statusHistory = record.statusHistory || [];

  if (record.statusHistory.length === 0 || record.statusHistory[record.statusHistory.length - 1].status !== record.status) {
    record.statusHistory.push({
      status: record.status,
      at: now
    });
  }

  record.lastRunAt = now;
  record.updatedAt = now;
}

function recomputePolicyDerivedState(policy, options = {}) {
  const now = new Date().toISOString();
  const blocked = (policy.issues || []).filter((issue) => issue.status === "Blocked");

  policy.canProceed = blocked.length === 0;
  policy.scoreAfter = ScoreService.calculate(policy.issues || []);
  if (!Number.isFinite(Number(policy.scoreBefore))) {
    policy.scoreBefore = policy.scoreAfter;
  }

  const nextStatus = blocked.length > 0
    ? "BLOCKED"
    : (policy.corrections || []).length > 0
      ? "CORRECTED"
      : "VALIDATED";

  policy.statusHistory = Array.isArray(policy.statusHistory) ? policy.statusHistory : [];
  if (
    policy.statusHistory.length === 0 ||
    policy.statusHistory[policy.statusHistory.length - 1].status !== nextStatus
  ) {
    policy.statusHistory.push({
      status: nextStatus,
      at: now
    });
  }

  policy.status = nextStatus;
  if (options.touchLastRunAt) {
    policy.lastRunAt = now;
  }
  policy.updatedAt = now;
}

async function addRunAudits(record, runResult) {
  for (const log of runResult.logs) {
    await pushAudit(record.policyId, log.step, log.message, { step: log.step });
  }

  for (const issue of runResult.issues) {
    await pushAudit(record.policyId, "Validation", `Issue: ${issue.ruleId} (${issue.status})`, {
      ruleId: issue.ruleId,
      severity: issue.severity,
      status: issue.status
    });
  }

  for (const correction of runResult.corrections) {
    await pushAudit(record.policyId, "Correction", `${correction.correctionType} applied`, {
      correctionType: correction.correctionType,
      ruleId: correction.ruleId
    });
  }
}

app.post("/api/validate-policy", async (req, res) => {
  try {
    const actor = req.body.actor || "ui.user";
    const governance = resolveGovernanceForRun(req.body || {});
    const policy = mapRequestToPolicy(req.body);
    const result = PolicyIntegrityEngine.run(policy, actor, buildEngineOptions(governance));

    const now = new Date().toISOString();
    const persisted = await upsertPolicySnapshot({
      policyId: result.policy.id,
      input: req.body || {},
      status: computePolicyStatus(result),
      scoreBefore: result.scoreBefore,
      scoreAfter: result.scoreAfter,
      issues: result.issues,
      corrections: result.corrections,
      logs: result.logs,
      lastRunAt: now,
      canProceed: result.canProceed,
      updatedAt: now
    });

    await addRunAudits(persisted, result);
    const integrationEvents = await emitIntegrationEvents(
      persisted,
      result,
      governance,
      actor,
      "api/validate-policy"
    );
    await pushAudit(persisted.policyId, "Validation", "Direct validation endpoint executed", {
      source: "api/validate-policy",
      actor
    });

    res.json({
      policyId: result.policy.id,
      scoreBefore: result.scoreBefore,
      scoreAfter: result.scoreAfter,
      canProceed: result.canProceed,
      blockedCount: result.blocked.length,
      issues: result.issues,
      corrections: result.corrections,
      governance: governanceSnapshot(governance),
      integrationEvents,
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
    auditEvents: state.auditEvents.slice(0, 100),
    governance: getGovernanceConfig(),
    roiAssumptions: getRoiAssumptions(),
    roi: computeRoiSummary(),
    integrationEvents: listIntegrationEvents().slice(0, 100)
  });
});

app.get("/api/platform/governance", (req, res) => {
  res.json({ governance: getGovernanceConfig() });
});

app.patch("/api/platform/governance", async (req, res) => {
  try {
    const governance = await updateGovernanceConfig(req.body || {});
    res.json({ governance });
  } catch (error) {
    res.status(500).json({ message: "Failed to update governance profile", error: error.message });
  }
});

app.get("/api/platform/roi", (req, res) => {
  res.json(computeRoiSummary());
});

app.patch("/api/platform/roi-assumptions", async (req, res) => {
  try {
    const assumptions = await updateRoiAssumptions(req.body || {});
    res.json({ assumptions, roi: computeRoiSummary() });
  } catch (error) {
    res.status(500).json({ message: "Failed to update ROI assumptions", error: error.message });
  }
});

app.get("/api/platform/integration/events", (req, res) => {
  const { policyId, targetSystem } = req.query;
  let events = listIntegrationEvents();

  if (policyId) {
    events = events.filter((event) => event.policyId === policyId);
  }
  if (targetSystem) {
    events = events.filter((event) => event.targetSystem === targetSystem);
  }

  res.json({ events: events.slice(0, 200) });
});

app.post("/api/platform/policies", async (req, res) => {
  try {
    const payload = req.body || {};
    const created = await createPolicy(payload);
    res.status(201).json(platformPolicySummary(created));
  } catch (error) {
    res.status(500).json({ message: "Failed to create policy", error: error.message });
  }
});

app.put("/api/platform/policies/:policyId", async (req, res) => {
  try {
    const updated = await updatePolicy(req.params.policyId, req.body || {});
    if (!updated) {
      res.status(404).json({ message: "Policy not found" });
      return;
    }
    res.json(platformPolicySummary(updated));
  } catch (error) {
    res.status(500).json({ message: "Failed to update policy", error: error.message });
  }
});

app.delete("/api/platform/policies/:policyId", async (req, res) => {
  try {
    const deleted = await deletePolicy(req.params.policyId);
    if (!deleted) {
      res.status(404).json({ message: "Policy not found" });
      return;
    }
    res.json({ deleted: platformPolicySummary(deleted) });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete policy", error: error.message });
  }
});

app.post("/api/platform/policies/:policyId/run", async (req, res) => {
  try {
    const record = getPolicy(req.params.policyId);
    if (!record) {
      res.status(404).json({ message: "Policy not found" });
      return;
    }

    const actor = req.body.actor || "platform.user";
    const governance = resolveGovernanceForRun(req.body || {});
    const runtimePolicy = mapRequestToPolicy({ ...record.input, id: record.policyId });
    const runResult = PolicyIntegrityEngine.run(runtimePolicy, actor, buildEngineOptions(governance));

    applyRunResult(record, runResult);
    await persistPolicySnapshot(record);
    await addRunAudits(record, runResult);
    const integrationEvents = await emitIntegrationEvents(
      record,
      runResult,
      governance,
      actor,
      "api/platform/policies/:policyId/run"
    );

    res.json({
      policy: platformPolicySummary(record),
      issues: record.issues,
      corrections: record.corrections,
      logs: record.logs,
      scoreBefore: record.scoreBefore,
      scoreAfter: record.scoreAfter,
      canProceed: record.canProceed,
      governance: governanceSnapshot(governance),
      integrationEvents,
      summary: {
        open: record.issues.filter((i) => i.status === "Open").length,
        resolved: record.issues.filter((i) => i.status === "Resolved").length,
        suggested: record.issues.filter((i) => i.status === "Suggested").length,
        blocked: record.issues.filter((i) => i.status === "Blocked").length
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to run policy", error: error.message });
  }
});

app.post("/api/platform/run-all", async (req, res) => {
  try {
    const actor = req.body.actor || "platform.batch";
    const governance = resolveGovernanceForRun(req.body || {});
    const records = listPolicies();

    if (records.length === 0) {
      res.json({
        count: 0,
        runs: [],
        summary: { validated: 0, corrected: 0, blocked: 0 },
        governance: governanceSnapshot(governance)
      });
      return;
    }

    const runs = [];
    let integrationEventCount = 0;

    for (const record of records) {
      const runtimePolicy = mapRequestToPolicy({ ...record.input, id: record.policyId });
      const runResult = PolicyIntegrityEngine.run(runtimePolicy, actor, buildEngineOptions(governance));

      applyRunResult(record, runResult);
      await persistPolicySnapshot(record);
      await addRunAudits(record, runResult);
      const integrationEvents = await emitIntegrationEvents(
        record,
        runResult,
        governance,
        actor,
        "api/platform/run-all"
      );
      integrationEventCount += integrationEvents.length;

      runs.push({
        policyId: record.policyId,
        status: record.status,
        scoreBefore: record.scoreBefore,
        scoreAfter: record.scoreAfter,
        canProceed: record.canProceed,
        issueCount: record.issues.length,
        correctionCount: record.corrections.length,
        integrationEventCount: integrationEvents.length
      });
    }

    const summary = runs.reduce(
      (acc, run) => {
        if (run.status === "VALIDATED") {
          acc.validated += 1;
        }
        if (run.status === "CORRECTED") {
          acc.corrected += 1;
        }
        if (run.status === "BLOCKED") {
          acc.blocked += 1;
        }
        return acc;
      },
      { validated: 0, corrected: 0, blocked: 0 }
    );

    await pushAudit("GLOBAL", "Batch", `Executed run-all for ${runs.length} policy(s)`, {
      count: runs.length,
      summary,
      profile: governance.mode,
      integrationEventCount
    });

    res.json({
      count: runs.length,
      runs,
      summary,
      governance: governanceSnapshot(governance),
      integrationEventCount
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to run all policies", error: error.message });
  }
});

app.post("/api/platform/reset", async (req, res) => {
  try {
    await resetPlatformState();
    res.json({ message: "Platform reset complete" });
  } catch (error) {
    res.status(500).json({ message: "Failed to reset platform", error: error.message });
  }
});

app.get("/api/platform/issues", (req, res) => {
  const { severity, ruleId, policyId, search, status } = req.query;
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
  if (status) {
    issues = issues.filter((i) => i.status === status);
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

app.patch("/api/platform/rules/:ruleId", async (req, res) => {
  try {
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

    await persistRulesSnapshot();
    await pushAudit("GLOBAL", "Rules", `Rule updated: ${rule.ruleId}`, {
      enabled: rule.enabled,
      severity: rule.severity
    });

    res.json({ rule });
  } catch (error) {
    res.status(500).json({ message: "Failed to update rule", error: error.message });
  }
});

app.post("/api/platform/rules/reset", async (req, res) => {
  try {
    const rules = await resetRuleOverrides();
    res.json({ rules });
  } catch (error) {
    res.status(500).json({ message: "Failed to reset rules", error: error.message });
  }
});

app.post("/api/platform/integration/policies/:policyId/publish", async (req, res) => {
  try {
    const policy = getPolicy(req.params.policyId);
    if (!policy) {
      res.status(404).json({ message: "Policy not found" });
      return;
    }

    const actor = req.body.actor || "integration.user";
    const targets = Array.isArray(req.body.targets) ? req.body.targets : DEFAULT_INTEGRATION_TARGETS;
    const governance = getGovernanceConfig();
    const runResult = {
      issues: policy.issues,
      corrections: policy.corrections,
      scoreBefore: policy.scoreBefore,
      scoreAfter: policy.scoreAfter,
      blocked: policy.issues.filter((issue) => issue.status === "Blocked"),
      canProceed: policy.canProceed
    };

    const events = await emitIntegrationEvents(
      policy,
      runResult,
      governance,
      actor,
      "api/platform/integration/policies/:policyId/publish",
      targets
    );

    await pushAudit(policy.policyId, "Integration", `Published ${events.length} integration event(s)`, {
      targets,
      actor
    });

    res.json({
      policyId: policy.policyId,
      count: events.length,
      events
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to publish integration event", error: error.message });
  }
});

app.post("/api/platform/policies/:policyId/issues/:issueKey/action", async (req, res) => {
  try {
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

    const action = String(req.body.action || "").trim().toLowerCase();
    const actor = req.body.actor || "reviewer.user";
    if (!VALID_ISSUE_ACTIONS.has(action)) {
      res.status(400).json({ message: "Invalid action. Allowed: approve, reject" });
      return;
    }

    if (issue.status !== "Suggested") {
      res.status(409).json({
        message: "Issue action allowed only for Suggested issues",
        issue
      });
      return;
    }

    if (action === "approve") {
      const correction = CorrectionService.applyApprovedSuggestion(policy, issue, actor);
      recomputePolicyDerivedState(policy);
      await persistPolicySnapshot(policy);
      await pushAudit(policy.policyId, "Correction", `Suggestion approved for ${issue.ruleId}`, {
        issueKey: issue.issueKey,
        correctionType: correction ? correction.correctionType : null,
        actor
      });
    } else {
      issue.status = "Rejected";
      recomputePolicyDerivedState(policy);
      await persistPolicySnapshot(policy);
      await pushAudit(policy.policyId, "Correction", `Suggestion rejected for ${issue.ruleId}`, {
        issueKey: issue.issueKey,
        actor
      });
    }

    res.json({ issue, policy: platformPolicySummary(policy) });
  } catch (error) {
    res.status(500).json({ message: "Failed to process issue action", error: error.message });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

async function startServer() {
  try {
    await initializePlatformStore();
    app.listen(PORT, () => {
      console.log(`Policy Integrity UI running at http://localhost:${PORT}`);
      console.log(`MySQL persistence enabled: ${MYSQL_USER}@${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DATABASE}`);
    });
  } catch (error) {
    console.error("Failed to initialize platform store:", error.message);
    process.exit(1);
  }
}

startServer();
