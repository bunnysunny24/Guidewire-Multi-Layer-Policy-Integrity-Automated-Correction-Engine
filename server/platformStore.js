const mysql = require("mysql2/promise");
const { rulesCatalog } = require("../project/services/ruleCatalog");

const MYSQL_HOST = process.env.MYSQL_HOST || "localhost";
const MYSQL_PORT = Number(process.env.MYSQL_PORT || 3306);
const MYSQL_USER = process.env.MYSQL_USER || "root";
const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || "Bunny";
const MYSQL_DATABASE = process.env.MYSQL_DATABASE || "guidewire_policy_integrity";
const AUDIT_MEMORY_CACHE_SIZE = Number(process.env.AUDIT_MEMORY_CACHE_SIZE || 2000);

let pool = null;
let initialized = false;
let policyCounter = 1000;
let eventCounter = 1;

function createRulesState() {
  return rulesCatalog.map((rule) => ({
    ruleId: rule.ruleId,
    name: rule.name,
    layer: rule.layer,
    enabled: rule.enabled,
    severity: rule.defaultSeverity
  }));
}

const state = {
  policies: [],
  rules: createRulesState(),
  auditEvents: []
};

function ensureInitialized() {
  if (!initialized || !pool) {
    throw new Error("Platform store is not initialized. Call initializePlatformStore() first.");
  }
}

function asText(value) {
  return JSON.stringify(value ?? null);
}

function parseJson(text, fallback) {
  if (text == null || text === "") {
    return fallback;
  }

  try {
    return JSON.parse(text);
  } catch (_error) {
    return fallback;
  }
}

function toIso(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function extractMaxCounter(items, prefix) {
  return items.reduce((max, item) => {
    if (!item || typeof item !== "string") {
      return max;
    }

    if (!item.startsWith(prefix)) {
      return max;
    }

    const value = Number(item.slice(prefix.length));
    if (!Number.isFinite(value)) {
      return max;
    }

    return Math.max(max, value);
  }, 0);
}

async function ensureDatabase() {
  const bootstrapConnection = await mysql.createConnection({
    host: MYSQL_HOST,
    port: MYSQL_PORT,
    user: MYSQL_USER,
    password: MYSQL_PASSWORD
  });

  try {
    await bootstrapConnection.query(`CREATE DATABASE IF NOT EXISTS \`${MYSQL_DATABASE}\``);
  } finally {
    await bootstrapConnection.end();
  }
}

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS platform_policies (
      policy_id VARCHAR(64) PRIMARY KEY,
      input_json LONGTEXT NOT NULL,
      status VARCHAR(32) NOT NULL,
      status_history_json LONGTEXT NOT NULL,
      score_before INT NOT NULL,
      score_after INT NOT NULL,
      issues_json LONGTEXT NOT NULL,
      corrections_json LONGTEXT NOT NULL,
      logs_json LONGTEXT NOT NULL,
      last_run_at DATETIME NULL,
      can_proceed TINYINT(1) NOT NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL
    ) ENGINE=InnoDB;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS platform_rules (
      rule_id VARCHAR(100) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      layer VARCHAR(100) NOT NULL,
      enabled TINYINT(1) NOT NULL,
      severity VARCHAR(20) NOT NULL,
      updated_at DATETIME NOT NULL
    ) ENGINE=InnoDB;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS platform_audit_events (
      event_id VARCHAR(64) PRIMARY KEY,
      policy_id VARCHAR(64) NOT NULL,
      module VARCHAR(80) NOT NULL,
      message VARCHAR(255) NOT NULL,
      timestamp DATETIME NOT NULL,
      meta_json LONGTEXT NOT NULL,
      INDEX idx_policy_timestamp (policy_id, timestamp)
    ) ENGINE=InnoDB;
  `);
}

async function upsertRule(rule) {
  await pool.execute(
    `
      INSERT INTO platform_rules (rule_id, name, layer, enabled, severity, updated_at)
      VALUES (?, ?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        layer = VALUES(layer),
        enabled = VALUES(enabled),
        severity = VALUES(severity),
        updated_at = NOW()
    `,
    [rule.ruleId, rule.name, rule.layer, rule.enabled ? 1 : 0, rule.severity]
  );
}

async function upsertPolicy(policy) {
  await pool.execute(
    `
      INSERT INTO platform_policies (
        policy_id,
        input_json,
        status,
        status_history_json,
        score_before,
        score_after,
        issues_json,
        corrections_json,
        logs_json,
        last_run_at,
        can_proceed,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        input_json = VALUES(input_json),
        status = VALUES(status),
        status_history_json = VALUES(status_history_json),
        score_before = VALUES(score_before),
        score_after = VALUES(score_after),
        issues_json = VALUES(issues_json),
        corrections_json = VALUES(corrections_json),
        logs_json = VALUES(logs_json),
        last_run_at = VALUES(last_run_at),
        can_proceed = VALUES(can_proceed),
        created_at = VALUES(created_at),
        updated_at = VALUES(updated_at)
    `,
    [
      policy.policyId,
      asText(policy.input),
      policy.status,
      asText(policy.statusHistory || []),
      policy.scoreBefore ?? 100,
      policy.scoreAfter ?? 100,
      asText(policy.issues || []),
      asText(policy.corrections || []),
      asText(policy.logs || []),
      policy.lastRunAt ? new Date(policy.lastRunAt) : null,
      policy.canProceed ? 1 : 0,
      policy.createdAt ? new Date(policy.createdAt) : new Date(),
      policy.updatedAt ? new Date(policy.updatedAt) : new Date()
    ]
  );
}

async function insertAuditEvent(event) {
  await pool.execute(
    `
      INSERT INTO platform_audit_events (
        event_id,
        policy_id,
        module,
        message,
        timestamp,
        meta_json
      )
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        policy_id = VALUES(policy_id),
        module = VALUES(module),
        message = VALUES(message),
        timestamp = VALUES(timestamp),
        meta_json = VALUES(meta_json)
    `,
    [
      event.eventId,
      event.policyId,
      event.module,
      event.message,
      new Date(event.timestamp),
      asText(event.meta || {})
    ]
  );
}

async function loadStateFromDb() {
  const [policyRows] = await pool.query(`
    SELECT
      policy_id,
      input_json,
      status,
      status_history_json,
      score_before,
      score_after,
      issues_json,
      corrections_json,
      logs_json,
      last_run_at,
      can_proceed,
      created_at,
      updated_at
    FROM platform_policies
    ORDER BY updated_at DESC
  `);

  state.policies = policyRows.map((row) => ({
    policyId: row.policy_id,
    input: parseJson(row.input_json, {}),
    status: row.status,
    statusHistory: parseJson(row.status_history_json, []),
    scoreBefore: row.score_before,
    scoreAfter: row.score_after,
    issues: parseJson(row.issues_json, []),
    corrections: parseJson(row.corrections_json, []),
    logs: parseJson(row.logs_json, []),
    lastRunAt: toIso(row.last_run_at),
    canProceed: Boolean(row.can_proceed),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  }));

  const [ruleRows] = await pool.query(`
    SELECT rule_id, name, layer, enabled, severity
    FROM platform_rules
  `);

  const dbRuleMap = ruleRows.reduce((acc, row) => {
    acc[row.rule_id] = {
      ruleId: row.rule_id,
      name: row.name,
      layer: row.layer,
      enabled: Boolean(row.enabled),
      severity: row.severity
    };
    return acc;
  }, {});

  state.rules = createRulesState().map((catalogRule) => {
    const fromDb = dbRuleMap[catalogRule.ruleId];
    if (!fromDb) {
      return catalogRule;
    }
    return {
      ...catalogRule,
      enabled: fromDb.enabled,
      severity: fromDb.severity
    };
  });

  for (const rule of state.rules) {
    await upsertRule(rule);
  }

  const [auditRows] = await pool.query(
    `
      SELECT event_id, policy_id, module, message, timestamp, meta_json
      FROM platform_audit_events
      ORDER BY timestamp DESC, event_id DESC
      LIMIT ?
    `,
    [AUDIT_MEMORY_CACHE_SIZE]
  );

  state.auditEvents = auditRows.map((row) => ({
    eventId: row.event_id,
    policyId: row.policy_id,
    module: row.module,
    message: row.message,
    timestamp: toIso(row.timestamp),
    meta: parseJson(row.meta_json, {})
  }));

  const maxPolicy = extractMaxCounter(state.policies.map((item) => item.policyId), "POL-PLT-");
  policyCounter = Math.max(1000, maxPolicy || 1000);

  const maxAudit = extractMaxCounter(state.auditEvents.map((item) => item.eventId), "AUD-");
  eventCounter = Math.max(1, (maxAudit || 0) + 1);
}

async function initializePlatformStore() {
  if (initialized) {
    return state;
  }

  await ensureDatabase();

  pool = mysql.createPool({
    host: MYSQL_HOST,
    port: MYSQL_PORT,
    user: MYSQL_USER,
    password: MYSQL_PASSWORD,
    database: MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  await ensureSchema();
  await loadStateFromDb();
  initialized = true;
  return state;
}

function nextPolicyId() {
  policyCounter += 1;
  return `POL-PLT-${policyCounter}`;
}

async function pushAudit(policyId, module, message, meta = {}) {
  ensureInitialized();

  const event = {
    eventId: `AUD-${eventCounter++}`,
    policyId,
    module,
    message,
    timestamp: new Date().toISOString(),
    meta
  };

  state.auditEvents.unshift(event);
  if (state.auditEvents.length > AUDIT_MEMORY_CACHE_SIZE) {
    state.auditEvents.length = AUDIT_MEMORY_CACHE_SIZE;
  }

  await insertAuditEvent(event);
  return event;
}

function listPolicies() {
  return state.policies;
}

function getPolicy(policyId) {
  return state.policies.find((policy) => policy.policyId === policyId) || null;
}

async function createPolicy(input) {
  ensureInitialized();

  const now = new Date().toISOString();
  const policy = {
    policyId: nextPolicyId(),
    input,
    status: "NEW",
    createdAt: now,
    updatedAt: now,
    statusHistory: [
      {
        status: "NEW",
        at: now
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
  await upsertPolicy(policy);
  await pushAudit(policy.policyId, "Workbench", "Policy created", { policyId: policy.policyId });
  return policy;
}

async function updatePolicy(policyId, input) {
  ensureInitialized();

  const policy = getPolicy(policyId);
  if (!policy) {
    return null;
  }

  policy.input = input;
  policy.updatedAt = new Date().toISOString();

  if (policy.status !== "NEW") {
    policy.status = "NEW";
    policy.statusHistory.push({
      status: "NEW",
      at: policy.updatedAt
    });
  }

  await upsertPolicy(policy);
  await pushAudit(policyId, "Workbench", "Policy updated", { policyId });
  return policy;
}

async function persistPolicySnapshot(policy) {
  ensureInitialized();
  await upsertPolicy(policy);
}

async function upsertPolicySnapshot(snapshot) {
  ensureInitialized();

  if (!snapshot || !snapshot.policyId) {
    throw new Error("policyId is required for snapshot persistence");
  }

  const now = new Date().toISOString();
  const existing = getPolicy(snapshot.policyId);
  const nextStatus = snapshot.status || existing?.status || "NEW";
  const baseHistory = Array.isArray(existing?.statusHistory) ? [...existing.statusHistory] : [];
  const statusHistory = Array.isArray(snapshot.statusHistory) ? [...snapshot.statusHistory] : baseHistory;

  if (statusHistory.length === 0) {
    statusHistory.push({
      status: nextStatus,
      at: snapshot.updatedAt || now
    });
  } else if (statusHistory[statusHistory.length - 1].status !== nextStatus) {
    statusHistory.push({
      status: nextStatus,
      at: snapshot.updatedAt || now
    });
  }

  const record = {
    policyId: snapshot.policyId,
    input: snapshot.input ?? existing?.input ?? {},
    status: nextStatus,
    statusHistory,
    scoreBefore: snapshot.scoreBefore ?? existing?.scoreBefore ?? 100,
    scoreAfter: snapshot.scoreAfter ?? existing?.scoreAfter ?? 100,
    issues: snapshot.issues ?? existing?.issues ?? [],
    corrections: snapshot.corrections ?? existing?.corrections ?? [],
    logs: snapshot.logs ?? existing?.logs ?? [],
    lastRunAt: snapshot.lastRunAt ?? existing?.lastRunAt ?? null,
    canProceed: snapshot.canProceed ?? existing?.canProceed ?? true,
    createdAt: existing?.createdAt ?? snapshot.createdAt ?? now,
    updatedAt: snapshot.updatedAt ?? now
  };

  if (existing) {
    const index = state.policies.findIndex((policy) => policy.policyId === snapshot.policyId);
    if (index !== -1) {
      state.policies[index] = record;
    }
  } else {
    state.policies.unshift(record);
  }

  await upsertPolicy(record);
  return record;
}

async function deletePolicy(policyId) {
  ensureInitialized();

  const index = state.policies.findIndex((policy) => policy.policyId === policyId);
  if (index === -1) {
    return null;
  }

  const [removed] = state.policies.splice(index, 1);
  await pool.execute("DELETE FROM platform_policies WHERE policy_id = ?", [policyId]);
  await pushAudit("GLOBAL", "Workbench", `Policy deleted: ${policyId}`, { policyId });
  return removed;
}

async function resetPlatformState() {
  ensureInitialized();

  policyCounter = 1000;
  eventCounter = 1;
  state.policies = [];
  state.rules = createRulesState();
  state.auditEvents = [];

  await pool.query("DELETE FROM platform_audit_events");
  await pool.query("DELETE FROM platform_policies");
  await pool.query("DELETE FROM platform_rules");

  for (const rule of state.rules) {
    await upsertRule(rule);
  }

  await pushAudit("GLOBAL", "Platform", "Platform state reset", {});
}

async function resetRuleOverrides() {
  ensureInitialized();

  state.rules = createRulesState();
  await pool.query("DELETE FROM platform_rules");
  for (const rule of state.rules) {
    await upsertRule(rule);
  }

  await pushAudit("GLOBAL", "Rules", "Rule overrides reset to defaults", {});
  return state.rules;
}

async function upsertPolicyRecord(policyId, input) {
  if (!policyId) {
    return createPolicy(input);
  }
  return updatePolicy(policyId, input);
}

async function persistRulesSnapshot() {
  ensureInitialized();
  for (const rule of state.rules) {
    await upsertRule(rule);
  }
}

module.exports = {
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
  upsertPolicy: upsertPolicyRecord,
  pushAudit
};
