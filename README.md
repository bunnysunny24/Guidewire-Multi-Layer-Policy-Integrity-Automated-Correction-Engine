# Guidewire Policy Integrity Engine (PIE)

Guidewire Multi-Layer Policy Integrity and Automated Correction Engine with persisted governance, ROI evidence, and integration proof points.

Core lifecycle:

Detect -> Classify -> Correct -> Re-validate (once) -> Score -> Audit

## 1. What This Project Is

This is a PolicyCenter-style accelerator that demonstrates how insurers can:

- detect policy data issues across multiple validation layers,
- apply governed corrections safely,
- keep humans in control when needed,
- measure measurable ROI,
- and publish integration-ready events for enterprise adoption.

It is built as a runnable platform (Node.js + web UI + MySQL) and also includes Guidewire scaffold artifacts (Gosu, typelists, entity extensions, rules, PCF) for architecture mapping.

## 2. Strategic Adoption Design (All 6 Implemented)

### 2.1 Modular engine rollout

Execution can run in rollout profiles:

- Validation Only
- Human-in-the-Loop
- Full Automation

This allows incremental adoption instead of all-or-nothing rollout.

### 2.2 Human-in-the-loop automation

- Suggested issues can be approved/rejected.
- Approval path supports correction execution for auto-fixable suggestions.
- Manual/blocked issues can be resolved by reviewer action when deterministic manual resolution is available.
- Confidence threshold controls when auto-fix is allowed.

### 2.3 ROI evidence generation

The platform computes and exposes:

- weekly manual hours saved,
- weekly review hours,
- net weekly hours,
- issue reduction percentage,
- blocked-case risk cost avoided.

ROI assumptions are configurable and persisted.

### 2.4 Integration proof-of-concept

- Integration events are produced for PolicyCenter and BillingCenter targets.
- Event stream is queryable by policy and target system.
- Manual publish endpoint exists for demo-driven PoC runs.

### 2.5 Strategic value framing

Dashboard and ROI summary explicitly position the platform as closed-loop policy governance that reduces downstream compliance and servicing risk.

### 2.6 Market differentiation

This solution is framed as:

- Guidewire Policy Integrity Engine (PIE)
- Closed-Loop Policy Governance Engine

The emphasis is proactive risk reduction, not just correction tooling.

## 3. Functional Modules (UI)

- Dashboard
  - KPI cards, severity/status charts, before/after score proof, batch summary, ROI highlights
- Adoption Studio
  - rollout profile controls, confidence threshold, ROI assumption tuning, integration publish controls
  - governance draft/apply workflow (edit safely, then commit)
  - readiness snapshot (active profile, pending draft, threshold, integration flags)
  - integration stream filters (search, policy, target, status) backed by API queries
  - integration payload inspector for selected event rows
- Policy Workbench
  - create/update/delete policy, run selected policy, run all policies, guided demo, demo case load/seed
  - Guidewire-style policy creation fields (account, LOB/product, term dates, jurisdiction, producer, underwriter, submission channel, billing plan, currency)
  - advanced policy filters (lifecycle status, policy state, LOB, customer-linked flag, producer, jurisdiction, effective date range)
- Validation Center
  - filter issues by severity/status/policy/search + correction mode, auto-fixability, and confidence range
- Correction Center
  - applied correction history + suggestion queue + manual resolution queue
  - queue filters (policy, severity, rule, search) + bulk approve/resolve actions
- Audit Logs
  - timeline + filtered export
  - filters by policy, module, search, and date range
- Rule Configuration
  - enable/disable rule, severity override, reset defaults, optional auto re-run

## 4. Governance Model

### 4.1 Issue-level controls

- autoFixable
- correctionMode (Auto, Suggested, Manual)
- correctionConfidence
- alreadyCorrected

Duplicate issue records are prevented via ruleId + issueKey dedupe.

### 4.2 Profile behavior matrix

- Validation Only
  - validation on, correction off, re-validation off, auto-fix off
- Human-in-the-Loop
  - validation on, correction on, re-validation on, auto-fix off
- Full Automation
  - validation/correction/re-validation on, auto-fix allowed by confidence threshold

### 4.3 Blocking behavior

Unresolved critical conditions transition policy status to BLOCKED.

## 5. Integrity Scoring

Severity deductions:

- Critical: -20
- High: -10
- Medium: -5
- Low: -2

Formula:

- score = clamp(100 - totalDeduction, 0, 100)

Resolved issues do not deduct score.

## 6. ROI Model

Default assumptions:

- minutesPerAutoCorrection = 12
- reviewMinutesPerSuggestedIssue = 6
- blockedCaseCostAvoided = 220

Computed outputs:

- weeklyHoursSaved
- weeklyReviewHours
- netWeeklyHours
- issueReductionPercent
- riskCostAvoided

## 7. Integration PoC Model

Default targets:

- PolicyCenter
- BillingCenter

Event type:

- PolicyIntegrityEvaluated

Event payload includes:

- source and actor
- governance snapshot
- policy score/status snapshot
- issue/correction/blocked metrics
- generation timestamp

## 8. Persistence (MySQL)

### 8.1 Default connection

- Host: localhost
- Port: 3306
- User: root
- Password: Bunny
- Database: guidewire_policy_integrity

You can override via environment variables:

- MYSQL_HOST
- MYSQL_PORT
- MYSQL_USER
- MYSQL_PASSWORD
- MYSQL_DATABASE
- AUDIT_MEMORY_CACHE_SIZE (default: 2000)
- INTEGRATION_MEMORY_CACHE_SIZE (default: 2000)

### 8.2 Persisted tables

- platform_policies
  - policy input, scores, status history, issues, corrections, logs, run timestamps
- platform_rules
  - rule enabled/severity overrides
- platform_audit_events
  - full action timeline
- platform_settings
  - governance profile config + ROI assumptions
- platform_integration_events
  - integration event history for PoC evidence

### 8.3 Coverage guarantee

Persisted flows include:

- policy create/update/delete,
- single run,
- run-all,
- direct validate endpoint,
- suggestion approve/reject,
- rules update/reset,
- governance update,
- ROI assumption update,
- integration publish,
- full platform reset.

UI-only local state (active tab, transient filter values) is intentionally not persisted.

### 8.4 Operational limits and retention

- `/api/platform/bootstrap` returns up to 100 audit events and 100 integration events.
- `/api/platform/audits` returns up to 200 events per request.
- `/api/platform/integration/events` returns up to 200 events per request.
- In-memory audit/integration caches are capped by `AUDIT_MEMORY_CACHE_SIZE` and `INTEGRATION_MEMORY_CACHE_SIZE`.

## 9. Repository Map

### 9.1 Runnable simulation

- Frontend
  - public/index.html
  - public/styles.css
- Backend
  - server/app.js
  - server/platformStore.js
  - server/policyMapper.js
- Engine/services
  - project/engine/PolicyIntegrityEngine.js
  - project/services/ValidationService.js
  - project/services/CorrectionService.js
  - project/services/ScoreService.js
  - project/services/ruleCatalog.js
- Domain entities/models
  - project/model/Policy.js
  - project/model/Customer.js
  - project/entity/PolicyIssue.js
  - project/entity/PolicyCorrection.js
- Tests
  - test/engine-and-services.test.js

### 9.2 Guidewire scaffold

- Entity extensions
  - config/extensions/entity/Policy.etx
  - config/extensions/entity/PolicyIssue_Ext.eti
  - config/extensions/entity/PolicyCorrection_Ext.eti
- Typelists
  - config/extensions/typelist/PISeverity.ttx
  - config/extensions/typelist/PICorrectionMode.ttx
- Gosu
  - config/gosu/com/guidewire/policyintegrity/ValidationService.gs
  - config/gosu/com/guidewire/policyintegrity/CorrectionService.gs
  - config/gosu/com/guidewire/policyintegrity/ScoreService.gs
  - config/gosu/com/guidewire/policyintegrity/PolicyIntegrityOrchestrator.gs
  - config/gosu/com/guidewire/policyintegrity/PolicyIntegritySaveHook.gs
  - config/gosu/com/guidewire/policyintegrity/PolicyIntegrityConstants.gs
- Rule/PCF placeholders
  - config/rules/PolicyIntegrityOnSave.gr
  - config/pcf/policy/PolicyIntegrityDashboard.pcf

## 10. Setup and Run

### 10.1 Prerequisites

- Node.js 18+
- MySQL 8+

### 10.2 Install

```bash
npm install
```

### 10.3 Optional environment overrides (PowerShell)

```powershell
$env:PORT="3000"
$env:MYSQL_HOST="localhost"
$env:MYSQL_PORT="3306"
$env:MYSQL_USER="root"
$env:MYSQL_PASSWORD="Bunny"
$env:MYSQL_DATABASE="guidewire_policy_integrity"
$env:AUDIT_MEMORY_CACHE_SIZE="2000"
$env:INTEGRATION_MEMORY_CACHE_SIZE="2000"
```

### 10.4 Start app

```bash
npm start
```

Startup behavior:

- The platform creates the MySQL database and required tables if missing.
- If MySQL initialization fails, server startup fails fast and exits.

Open:

- http://localhost:3000

### 10.5 Console demo runner

```bash
npm run demo
```

### 10.6 Automated tests

```bash
npm test
```

Current suite validates:

- full-automation auto-fix and suggestion behavior,
- validation-only no-correction behavior,
- critical blocking behavior,
- reviewer approval flow for suggested auto-fixable issues.
- full-automation billing deactivation for cancelled policies,
- duplicate-customer suggestion approval resolution path,
- manual resolution for blocked invalid configuration issues,
- manual resolution for missing-customer issues.

## 11. API Reference

### 11.1 Core

- GET /api/health
- GET /api/demo-cases
- POST /api/validate-policy
  - optional request fields: actor, profile (validation-only | human-in-loop | full-automation), mode

### 11.2 Platform bootstrap and analytics

- GET /api/platform/bootstrap
  - returns policies, rules, auditEvents, governance, roiAssumptions, roi, integrationEvents
  - auditEvents and integrationEvents are each capped to latest 100 records
- GET /api/platform/roi
- PATCH /api/platform/roi-assumptions

### 11.3 Governance

- GET /api/platform/governance
- PATCH /api/platform/governance
  - supported fields: mode, enableValidation, enableCorrection, enableRevalidation, autoApplyCorrections, autoApplyMinConfidence, emitIntegrationEvents

### 11.4 Policy operations

- GET /api/platform/policies
  - query: `search`, `lifecycleStatus`, `policyState`, `lineOfBusiness`, `producerCode`, `jurisdiction`, `hasCustomer`, `effectiveFrom`, `effectiveTo`
- POST /api/platform/policies
  - payload supports Guidewire-style metadata fields in addition to simulation fields:
    - `accountNumber`, `lineOfBusiness`, `productCode`, `offering`, `termType`
    - `effectiveDate`, `expirationDate`, `jurisdiction`
    - `producerCode`, `underwriter`, `submissionChannel`, `billingPlan`, `currency`
    - customer and simulation fields (`hasCustomer`, `customerName`, `customerAddress`, `policyAddress`, `premium`, `coverage`, etc.)
- PUT /api/platform/policies/:policyId
- DELETE /api/platform/policies/:policyId
- POST /api/platform/policies/:policyId/run
  - optional body: actor, profile, mode
- POST /api/platform/run-all
  - optional body: actor, profile, mode
  - response includes per-policy run list, status summary, and `integrationEventCount`
- POST /api/platform/reset

### 11.5 Issue/correction/audit/rule operations

- GET /api/platform/issues
  - query: severity, status, ruleId, policyId, search, correctionMode, autoFixable, minConfidence, maxConfidence
- GET /api/platform/corrections
- GET /api/platform/audits
  - query: policyId, module, search, fromDate, toDate, limit
  - returns latest 200 events after optional filtering
- GET /api/platform/rules
- PATCH /api/platform/rules/:ruleId
- POST /api/platform/rules/reset
- POST /api/platform/policies/:policyId/issues/:issueKey/action
  - body: action = approve | reject | resolve, optional actor, optional customerName/customerAddress for manual customer-link resolution
  - returns `400` for invalid action values
  - returns `409` when action is not valid for the issue status
  - returns `422` when a manual resolution is requested but cannot be applied
  - successful response returns both updated issue and policy summary

### 11.6 Integration PoC operations

- GET /api/platform/integration/events
  - query: policyId, targetSystem, status, search, limit
  - returns latest 200 events after optional filtering
- POST /api/platform/integration/policies/:policyId/publish
  - body: optional actor, optional targets array

### 11.7 ID and status semantics

- Platform-created policies use `POL-PLT-<counter>` IDs.
- Audit events use `AUD-<counter>` IDs.
- Integration events use `INT-<counter>` IDs.
- Policy status lifecycle is tracked in history: `NEW -> VALIDATED | CORRECTED | BLOCKED` (with timestamps).

## 12. Demo Script For Company Stakeholders

Use this sequence in presentation:

1. Seed demo cases from Workbench.
2. Show Adoption Studio profile = Validation Only and run-all.
3. Switch to Human-in-the-Loop and show suggestion queue approvals.
4. Switch to Full Automation and tune confidence threshold.
5. Open Dashboard to show score delta and ROI cards.
6. Publish integration payload for selected policy to PolicyCenter/BillingCenter.
7. Show Audit Logs and Integration Events as adoption evidence.
8. Show MySQL table data for persistence proof.

## 13. SQL Verification

```sql
SHOW DATABASES;
USE guidewire_policy_integrity;
SHOW TABLES;

SELECT COUNT(*) AS policies FROM platform_policies;
SELECT COUNT(*) AS rules FROM platform_rules;
SELECT COUNT(*) AS audits FROM platform_audit_events;
SELECT COUNT(*) AS settings FROM platform_settings;
SELECT COUNT(*) AS integration_events FROM platform_integration_events;

SELECT policy_id, status, score_before, score_after, updated_at
FROM platform_policies
ORDER BY updated_at DESC
LIMIT 20;

SELECT event_id, policy_id, module, message, timestamp
FROM platform_audit_events
ORDER BY timestamp DESC
LIMIT 50;

SELECT integration_event_id, policy_id, target_system, event_type, status, created_at
FROM platform_integration_events
ORDER BY created_at DESC
LIMIT 50;
```

## 14. Executive Pitch Line

Guidewire Policy Integrity Engine (PIE) is a closed-loop policy governance platform that reduces policy defects, shortens manual correction cycles, strengthens compliance evidence, and integrates with InsuranceSuite workflows through low-risk phased adoption.

## 15. Scope Note

This repository is a high-fidelity simulation and architecture accelerator. It mirrors enterprise Guidewire patterns and integration behavior for demo, design, and evaluation without embedding proprietary Guidewire runtime internals.

Guidewire scaffold caveats:

- Gosu simulation parity now uses Policy extension driver fields: `PolicyAddressText`, `CustomerAddressText`, `BillingActive`, `DuplicateCustomerCandidate`, `ConfigValid`.
- Replace simulation-driver checks with real product-model, customer-resolution, and BillingCenter integrations in production.
- Treat Gosu/PCF/rule artifacts as accelerator scaffolding to be completed and bound in a live InsuranceSuite environment.

## 16. Complete Learning Path (From Zero To Demo-Ready)

Use this sequence if you want to learn the complete application quickly and present it confidently.

### 16.1 Fast path (20-30 minutes)

1. Read sections 1, 2, and 4 to understand purpose and governance.
2. Start the app and seed a few policies in Policy Workbench.
3. Run all policies and review Dashboard status bars and ROI cards.
4. Open Validation Center and Correction Center to show issue -> action -> outcome flow.
5. Open Audit Logs and Integration events to show traceability and enterprise readiness.

### 16.2 Deep path (60-90 minutes)

1. Walk the backend execution in `server/app.js` (`resolveGovernanceForRun`, `computePolicyStatus`, `computeRoiSummary`).
2. Walk the engine and services:
   - `project/engine/PolicyIntegrityEngine.js`
   - `project/services/ValidationService.js`
   - `project/services/CorrectionService.js`
   - `project/services/ScoreService.js`
3. Inspect persistence/state and schema in `server/platformStore.js`.
4. Review UI module renderers and handlers in `public/index.html`.
5. Run `npm test` and read test scenarios in `test/engine-and-services.test.js`.

## 17. End-To-End Runtime Flow

When user clicks **Validate Policy**, **Run**, or **Run All**, this is what happens:

1. UI sends request to backend route (`/api/platform/policies/:policyId/run` or `/api/platform/run-all`).
2. Backend resolves governance profile and controls (`validation-only`, `human-in-loop`, `full-automation`).
3. Policy payload is mapped into domain model via `server/policyMapper.js`.
4. Engine executes lifecycle:
   - Detect (validation pass 1)
   - Classify (score before)
   - Correct/Suggest/Block
   - Re-validate once
   - Score (final)
   - Audit log entries
5. Backend computes status (`VALIDATED`, `CORRECTED`, `BLOCKED`) and persists snapshot.
6. Audit events and integration events are written (if enabled).
7. UI refreshes bootstrap state and all modules update from persisted backend state.

## 18. Full Feature Inventory

### 18.1 Engine and rule features

- 4 validation layers: Field, Business, Cross-Entity, Cross-System.
- 7 rules in `project/services/ruleCatalog.js`:
  - `VAL_PREMIUM_NEGATIVE`
  - `VAL_POLICY_ADDRESS_MISSING`
  - `BUS_COVERAGE_PREMIUM_MISMATCH`
  - `BUS_POLICY_CONFIG_INVALID`
  - `XENT_MISSING_CUSTOMER`
  - `XENT_DUPLICATE_CUSTOMER`
  - `XSYS_BILLING_ACTIVE_ON_CANCELLED`
- Rule enable/disable and severity override.
- Dedupe logic by `ruleId|issueKey`.
- Single re-validation pass to avoid correction loops.

### 18.2 Governance and automation features

- Profile-based execution behavior.
- Threshold-based auto-apply for low-risk auto-fix rules.
- Human suggestion queue and approve/reject actions.
- Cross-system auto-fix for cancelled policies with active billing (`AutoBillingDeactivation`).
- Reviewer approval flow can resolve duplicate-customer suggestions (`SuggestedDuplicateResolution`).
- Integration event toggle and target selection.

### 18.3 UI features

- Dashboard with KPI cards and four charts.
- Adoption Studio for governance, ROI assumptions, integration publish.
- Policy Workbench with policy CRUD, run single, run all, reset, export snapshot.
- Validation Center with filterable issue table.
- Correction Center with applied corrections and suggestion queue actions.
- Correction Center with applied corrections, suggestion queue, and manual resolution queue.
- Audit Logs with timeline and export.
- Rule Configuration with live override and optional auto re-run.

### 18.4 Persistence and operational features

- MySQL-backed persistence with automatic schema creation.
- In-memory caches with configurable caps.
- Persisted settings: governance profile and ROI assumptions.
- Persisted evidence: policy snapshots, audits, integration events.

### 18.5 Quality and verification features

- Automated tests for key lifecycle and governance behavior (`npm test`).
- Defensive API responses for invalid issue-action requests (`400`, `409`).

## 19. Data Dictionary (All Input And Output Fields)

### 19.1 Policy input fields (Workbench/API)

| Field | Type | Meaning | Typical values |
|---|---|---|---|
| `premium` | number | Policy premium used in field/business checks | `-500`, `8000` |
| `coverage` | number | Coverage amount used in premium consistency rule | `100000`, `200000` |
| `status` | string | Policy state for cross-system rule | `Active`, `Cancelled` |
| `hasCustomer` | boolean | Whether customer object is created | `true`, `false` |
| `customerName` | string | Customer display name | `Aarav Sharma` |
| `customerAddress` | string | Source for address auto-fill rule | `12 Green Street` |
| `policyAddress` | string/null | Policy address value | empty or populated |
| `duplicateCustomerCandidate` | boolean | Triggers duplicate suggestion rule | `true`, `false` |
| `billingActive` | boolean | Used by cancelled+billing cross-system rule | `true`, `false` |
| `configValid` | boolean | Critical blocker flag | `true`, `false` |
| `actor` | string | User/system identity for audit trails | `ui.user`, `demo.mode` |

### 19.2 PolicyIssue fields

- Identity: `ruleId`, `issueKey`, `issueType`.
- Severity/governance: `severity`, `autoFixable`, `correctionMode`, `correctionConfidence`.
- Lifecycle: `status`, `alreadyCorrected`.
- Audit: `detectedAt`, `detectedBy`, `correctedAt`, `correctedBy`.

Status values used in platform:

- `Open`
- `Resolved`
- `Suggested`
- `Blocked`
- `Approved`
- `Rejected`

### 19.3 PolicyCorrection fields

- Linkage: `issueId`, `ruleId`.
- Action details: `correctionType`, `actionTaken`, `oldValue`, `newValue`.
- Audit details: `correctedAt`, `correctedBy`.

### 19.4 Policy status semantics

- `NEW`: created or updated but not run yet.
- `VALIDATED`: run completed; no corrections and no blockers.
- `CORRECTED`: at least one correction exists and no blockers.
- `BLOCKED`: one or more blocking issues exist.

## 20. Module-By-Module Explanation

### 20.1 Dashboard

Purpose:

- Executive summary of quality, correction outcomes, confidence, and ROI.

What it shows:

- Status counts (`VALIDATED`, `CORRECTED`, `BLOCKED`).
- Before vs after score for latest run.
- Auto-correction examples.
- Severity distribution, status chart, score trend, issue trend.

How to read it:

- If `BLOCKED` is zero, risk cost avoided remains `$0`.
- If `CORRECTED` is high, automation is actively fixing low-risk issues.

### 20.2 Adoption Studio

Purpose:

- Governance control center and ROI tuning.

What each control does:

- Execution Profile: switches behavior matrix.
- Auto-Apply Minimum Confidence: threshold for auto-fix.
- Emit integration events: enables/disables event creation.
- Auto-apply low-risk corrections: toggles correction auto-application.
- ROI assumptions: changes labor/risk model calculations.

### 20.3 Policy Workbench

Purpose:

- Main authoring and execution screen for policy records.

Capabilities:

- Create, update, delete policy.
- Run selected policy.
- Run all policies.
- Seed demo pack and guided demo.
- Export selected snapshot.
- Reset full platform state.

### 20.4 Validation Center

Purpose:

- Operational queue for detected issues.

Capabilities:

- Filter by severity, status, policy, search.
- Review rule-level and policy-level issue details.

### 20.5 Correction Center

Purpose:

- Operational queue for remediation and reviewer decisions.

Capabilities:

- View applied corrections history.
- Review suggestion queue.
- Approve/reject suggestions.
- Resolve blocked/manual issues through reviewer-driven manual resolution action.

Behavior details:

- `approve` and `reject` require issue status `Suggested`.
- `resolve` is used for blocked/manual unresolved issues.
- Invalid action values return `400`.
- Invalid action/state combinations return `409`.
- Unsupported manual resolution attempts return `422`.
- Approving `XENT_DUPLICATE_CUSTOMER` clears duplicate candidate flag and records a correction.
- Resolving `BUS_POLICY_CONFIG_INVALID` applies `ManualConfigNormalization`.
- Resolving `XENT_MISSING_CUSTOMER` applies `ManualCustomerLinkResolution` (uses customer hints or provided customer payload).

### 20.6 Audit Logs

Purpose:

- Explainability and evidence trail.

Capabilities:

- Filter by selected policy.
- View timeline by module/step.
- Export audit JSON.

### 20.7 Rule Configuration

Purpose:

- Change rule runtime behavior without code changes.

Capabilities:

- Change severity override.
- Enable/disable rules.
- Re-run selected policy.
- Restore defaults.
- Optional auto re-run after rule update.

## 21. Policy Creation Cookbook (For Testing And Demo)

Use these exact policy shapes to produce reliable outcomes.

### 21.1 VALIDATED scenario

- `premium`: `8000`
- `coverage`: `100000`
- `status`: `Active`
- `hasCustomer`: `true`
- `customerAddress`: `12 Green Street`
- `policyAddress`: `12 Green Street`
- `duplicateCustomerCandidate`: `false`
- `billingActive`: `false`
- `configValid`: `true`

Expected result:

- Status: `VALIDATED`
- Issues: `0`
- Corrections: `0`

### 21.2 CORRECTED scenario

- `premium`: `-500`
- `coverage`: `200000`
- `status`: `Active`
- `hasCustomer`: `true`
- `customerAddress`: `12 Green Street`
- `policyAddress`: empty
- `duplicateCustomerCandidate`: `false`
- `billingActive`: `false`
- `configValid`: `true`

Expected result:

- Status: `CORRECTED`
- Typical corrections:
  - `AutoPremiumRecalculation`
  - `AutoAddressAutofill`

### 21.3 BLOCKED scenario

- `premium`: `9000`
- `coverage`: `100000`
- `status`: `Active`
- `hasCustomer`: `true`
- `policyAddress`: `12 Green Street`
- `duplicateCustomerCandidate`: `false`
- `billingActive`: `false`
- `configValid`: `false`

Expected result:

- Status: `BLOCKED`
- Critical issue: `BUS_POLICY_CONFIG_INVALID`

### 21.4 Suggestion-only scenario

- Use same as validated but set `duplicateCustomerCandidate=true`.

Expected result:

- Issue `XENT_DUPLICATE_CUSTOMER` in `Suggested` status.
- On approval from Correction Center, issue resolves and correction `SuggestedDuplicateResolution` is recorded.

### 21.5 Cancelled billing auto-fix scenario

- `premium`: `6000`
- `coverage`: `100000`
- `status`: `Cancelled`
- `hasCustomer`: `true`
- `customerAddress`: `12 Green Street`
- `policyAddress`: `12 Green Street`
- `duplicateCustomerCandidate`: `false`
- `billingActive`: `true`
- `configValid`: `true`

Expected result:

- Status: `CORRECTED`
- Issue `XSYS_BILLING_ACTIVE_ON_CANCELLED` resolved
- Correction `AutoBillingDeactivation`

## 22. Graph Interpretation Guide

### 22.1 Policy Status chart

- `VALIDATED` bar: clean outcomes with no correction and no blocker.
- `CORRECTED` bar: successful correction outcomes.
- `BLOCKED` bar: unresolved critical/manual blockers.

### 22.2 Why risk money can be `$0`

`Risk Cost Avoided = blockedPolicies * blockedCaseCostAvoided`

If blocked count is zero, the risk card stays at `$0`.

### 22.3 Confidence indicators

- Threshold is governance `autoApplyMinConfidence`.
- Above threshold: candidates eligible for auto-apply.
- Below threshold: candidates moved to suggestion/manual flow.

## 23. API Payload Examples

### 23.1 Create policy

```http
POST /api/platform/policies
Content-Type: application/json
```

```json
{
  "premium": -500,
  "coverage": 200000,
  "status": "Active",
  "hasCustomer": true,
  "customerName": "Aarav Sharma",
  "customerAddress": "12 Green Street",
  "policyAddress": null,
  "duplicateCustomerCandidate": true,
  "billingActive": false,
  "configValid": true,
  "actor": "ui.user"
}
```

### 23.2 Run selected policy

```http
POST /api/platform/policies/:policyId/run
Content-Type: application/json
```

```json
{
  "actor": "ui.user",
  "profile": "full-automation"
}
```

### 23.3 Run all policies

```http
POST /api/platform/run-all
Content-Type: application/json
```

```json
{
  "actor": "platform.batch",
  "profile": "full-automation"
}
```

### 23.4 Approve suggestion

```http
POST /api/platform/policies/:policyId/issues/:issueKey/action
Content-Type: application/json
```

```json
{
  "action": "approve",
  "actor": "reviewer.user"
}
```

### 23.5 Publish integration payload

```http
POST /api/platform/integration/policies/:policyId/publish
Content-Type: application/json
```

```json
{
  "actor": "integration.user",
  "targets": ["PolicyCenter", "BillingCenter"]
}
```

## 24. Troubleshooting And FAQ

### 24.1 Why all policies look CORRECTED

- You are likely running only auto-fixable scenarios.
- Create one clean policy and one blocker policy to diversify status chart.

### 24.2 Why BLOCKED stays zero

- No critical unresolved issue exists in test data.
- Set `configValid=false` or `hasCustomer=false` and re-run.

### 24.3 Why suggestion queue is empty

- Confidence threshold may allow auto-fix, or data has no suggestion rules triggered.
- Set `duplicateCustomerCandidate=true` for suggestion example.

### 24.4 Why integration events are missing

- Check governance toggle `emitIntegrationEvents`.
- Check selected targets and publish action in Adoption Studio.

### 24.5 Why run result changed after rule edits

- Rule Configuration may auto-rerun selected policy when enabled.
- Severity and enable/disable changes immediately affect scoring and issue generation.

## 25. What Is Tested Today

Current automated tests verify:

- Full automation auto-fix path and suggestion retention.
- Validation-only no-correction behavior.
- Critical blocking behavior.
- Suggestion approval applying correction.
- Full-automation billing deactivation for cancelled policies.
- Duplicate-customer suggestion approval resolution path.
- Manual resolution for blocked invalid configuration issues.
- Manual resolution for blocked missing-customer issues.

## 26. Productionization Checklist

Before live InsuranceSuite rollout:

1. Replace simulation driver checks with real service integrations.
2. Bind `PolicyIntegrityOnSave.gr` to actual pre-update lifecycle in tenant.
3. Add authentication, authorization, and role-based controls.
4. Add API integration tests and UI regression tests.
5. Add environment-specific secrets handling.
6. Add monitoring and alerting around run failures and integration publish failures.

## 27. Glossary

- PIE: Policy Integrity Engine.
- Auto-fixable: issue can be remediated automatically by deterministic logic.
- Suggested: issue requires human decision.
- Blocked: policy cannot proceed because critical unresolved issue exists.
- Governance profile: execution behavior pack (validation-only, human-in-loop, full-automation).