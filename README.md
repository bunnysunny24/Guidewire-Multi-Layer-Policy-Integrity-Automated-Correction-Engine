# Guidewire Multi-Layer Policy Integrity and Automated Correction Engine

This project is a Guidewire-style PolicyCenter accelerator that validates policy data quality, applies governed corrections, scores integrity, and persists complete operational evidence.

Core lifecycle:

Detect -> Classify -> Correct -> Re-validate (once) -> Score -> Audit

## 1. Business Positioning

### Primary fit

- Guidewire PolicyCenter domain (core implementation)
- InsuranceSuite-wide impact (indirectly helps ClaimCenter and BillingCenter by improving upstream policy quality)

### Problem solved

- Inconsistent policy data causes downstream failures in underwriting, claims, and billing.
- Manual correction cycles increase delay and operational risk.

### Value delivered

- Multi-layer issue detection
- Safe auto-correction
- Governance controls for risky/critical outcomes
- Weighted integrity scoring
- Auditable history for operational/compliance review

## 2. What Is Implemented

### 2.1 Runnable platform (Node.js + web UI)

- Enterprise-style UI shell inspired by Guidewire workspace patterns
- Multi-policy workbench with run controls, filtering, sorting, and exports
- Full platform APIs with MySQL persistence
- Demo mode and seeded scenario support

### 2.2 Guidewire architecture scaffold (mapping layer)

- Entity extensions, typelists, Gosu orchestration classes, rule placeholders, and PCF placeholders
- Useful for architecture explanation and migration mapping

## 3. Functional Modules

- Dashboard
  - KPIs, severity/status charts, score deltas, batch summary
- Policy Workbench
  - Create/update/delete policies, run single or batch, demo-case loading
- Validation Center
  - Filter issues by severity/status/policy/text
- Correction Center
  - Track applied corrections, approve/reject suggestions
- Audit Logs
  - Timeline view + JSON export
- Rule Configuration
  - Enable/disable rules, override severity, reset defaults

## 4. Governance Model

- `autoFixable`: only safe deterministic rules are auto-fixed
- `correctionMode`: Auto, Suggested, Manual
- `alreadyCorrected`: prevents repeat correction loops
- Duplicate issue prevention via `ruleId + issueKey`
- Exactly one re-validation pass after correction
- Critical unresolved states become blocked

## 5. Integrity Scoring

Severity deduction model:

- Critical: -20
- High: -10
- Medium: -5
- Low: -2

Formula:

- `score = clamp(100 - totalDeduction, 0, 100)`

Resolved issues are excluded from deduction.

## 6. MySQL Persistence (Local Laptop)

This project now persists platform data in MySQL.

### Default DB connection behavior

- Host: `localhost`
- Port: `3306`
- User: `root`
- Password: `Bunny` (default fallback in code; override in environment for security)
- Database: `guidewire_policy_integrity`

### Persisted tables

- `platform_policies`
  - policy input, status/history, score, issues, corrections, logs, run timestamps
- `platform_rules`
  - rule toggles and severity overrides
- `platform_audit_events`
  - audit event stream with structured metadata

### Persistence coverage

The following flows write through to DB:

- Policy create/update/delete
- Single policy run
- Batch run all policies
- Suggestion approve/reject
- Rule update/reset
- Platform reset
- Direct `POST /api/validate-policy` snapshot + audit

Notes:

- UI state (active tab, local filter inputs) is not persisted by design.
- Business/platform state is persisted.

## 7. Repository Structure

### 7.1 Runnable simulation files

- Frontend
  - `public/index.html`
  - `public/styles.css`
- Backend
  - `server/app.js`
  - `server/platformStore.js`
  - `server/policyMapper.js`
- Engine and services
  - `project/engine/PolicyIntegrityEngine.js`
  - `project/services/ValidationService.js`
  - `project/services/CorrectionService.js`
  - `project/services/ScoreService.js`
  - `project/services/ruleCatalog.js`
- Domain model/entities
  - `project/model/Policy.js`
  - `project/model/Customer.js`
  - `project/entity/PolicyIssue.js`
  - `project/entity/PolicyCorrection.js`
- Demo runners
  - `DemoRunner.js`
  - `project/demo/DemoRunner.js`

### 7.2 Guidewire scaffold files

- Entity extensions
  - `config/extensions/entity/Policy.etx`
  - `config/extensions/entity/PolicyIssue_Ext.eti`
  - `config/extensions/entity/PolicyCorrection_Ext.eti`
- Typelists
  - `config/extensions/typelist/PISeverity.ttx`
  - `config/extensions/typelist/PICorrectionMode.ttx`
- Gosu services/orchestration
  - `config/gosu/com/guidewire/policyintegrity/ValidationService.gs`
  - `config/gosu/com/guidewire/policyintegrity/CorrectionService.gs`
  - `config/gosu/com/guidewire/policyintegrity/ScoreService.gs`
  - `config/gosu/com/guidewire/policyintegrity/PolicyIntegrityOrchestrator.gs`
  - `config/gosu/com/guidewire/policyintegrity/PolicyIntegritySaveHook.gs`
  - `config/gosu/com/guidewire/policyintegrity/PolicyIntegrityConstants.gs`
- Rule/PCF placeholders
  - `config/rules/PolicyIntegrityOnSave.gr`
  - `config/pcf/policy/PolicyIntegrityDashboard.pcf`

## 8. Setup and Run

### 8.1 Prerequisites

- Node.js 18+
- MySQL Server 8+

### 8.2 Install dependencies

```bash
npm install
```

### 8.3 Optional environment overrides (PowerShell)

```powershell
$env:PORT="3000"
$env:MYSQL_HOST="localhost"
$env:MYSQL_PORT="3306"
$env:MYSQL_USER="root"
$env:MYSQL_PASSWORD="Bunny"
$env:MYSQL_DATABASE="guidewire_policy_integrity"
```

### 8.4 Start server/UI

```bash
npm start
```

Open:

- `http://localhost:3000`

If `3000` is busy:

```powershell
$env:PORT="3001"; npm start
```

### 8.5 Console demo

```bash
npm run demo
```

## 9. API Reference

### 9.1 General APIs

- `GET /api/health`
- `GET /api/demo-cases`
- `POST /api/validate-policy`

### 9.2 Platform APIs

- `GET /api/platform/bootstrap`
- `POST /api/platform/policies`
- `PUT /api/platform/policies/:policyId`
- `DELETE /api/platform/policies/:policyId`
- `POST /api/platform/policies/:policyId/run`
- `POST /api/platform/run-all`
- `POST /api/platform/reset`
- `GET /api/platform/issues`
  - Query params: `severity`, `status`, `ruleId`, `policyId`, `search`
- `GET /api/platform/corrections`
- `GET /api/platform/audits`
  - Query params: `policyId`
- `GET /api/platform/rules`
- `PATCH /api/platform/rules/:ruleId`
- `POST /api/platform/rules/reset`
- `POST /api/platform/policies/:policyId/issues/:issueKey/action`

## 10. Required Demo Scenarios

1. Case 1 - Auto Fix + Suggestion
2. Case 2 - Suggestion Only
3. Case 3 - Blocked

## 11. DB Verification Commands

```sql
SHOW DATABASES;
USE guidewire_policy_integrity;
SHOW TABLES;

SELECT COUNT(*) AS policies FROM platform_policies;
SELECT COUNT(*) AS rules FROM platform_rules;
SELECT COUNT(*) AS audits FROM platform_audit_events;

SELECT policy_id, status, score_before, score_after, updated_at
FROM platform_policies
ORDER BY updated_at DESC
LIMIT 20;

SELECT event_id, policy_id, module, message, timestamp
FROM platform_audit_events
ORDER BY timestamp DESC
LIMIT 50;
```

## 12. Viva Positioning

Use this line:

This project demonstrates a Guidewire-style PolicyCenter integrity platform with governed validation, automated correction, weighted scoring, and auditable persistence, improving downstream reliability for the InsuranceSuite ecosystem.

## 13. Scope Note

This project is a high-fidelity simulation and architecture accelerator. It does not embed proprietary Guidewire runtime internals, but mirrors equivalent lifecycle controls and enterprise integration patterns for demonstration and evaluation.
