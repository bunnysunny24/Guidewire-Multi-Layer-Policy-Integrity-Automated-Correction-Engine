# Guidewire Multi-Layer Policy Integrity and Automated Correction Engine

This repository contains a Guidewire-style policy integrity solution with two parts:

1. A local, runnable simulation (Node.js backend + React-based UI) for demo and viva.
2. A Guidewire-structure scaffold (Gosu, rules, entity extensions, typelists, PCF) for architecture mapping.

The implemented flow is a governed closed loop:

Detect -> Classify -> Correct -> Re-validate once -> Score -> Audit

## Project Goals

- Detect policy integrity issues across multiple validation layers.
- Auto-fix only safe and deterministic cases.
- Suggest risky corrections for manual review.
- Block critical invalid states.
- Store auditable issue and correction history.
- Show weighted policy integrity score before and after correction.

## What Is Implemented

### 1) Local simulation (fully runnable)

- Frontend dashboard and policy input form:
  - `public/index.html`
  - `public/styles.css`
- API server and payload mapping:
  - `server/app.js`
  - `server/policyMapper.js`
- Core engine and domain model:
  - `project/engine/PolicyIntegrityEngine.js`
  - `project/services/ValidationService.js`
  - `project/services/CorrectionService.js`
  - `project/services/ScoreService.js`
  - `project/entity/PolicyIssue.js`
  - `project/entity/PolicyCorrection.js`
  - `project/model/Policy.js`
  - `project/model/Customer.js`
- Demo runners:
  - `project/demo/DemoRunner.js`
  - `DemoRunner.js`

### 2) Guidewire-style scaffold (non-runnable without PolicyCenter runtime)

- Entity and extension models:
  - `config/extensions/entity/PolicyIssue_Ext.eti`
  - `config/extensions/entity/PolicyCorrection_Ext.eti`
  - `config/extensions/entity/Policy.etx`
- Typelists:
  - `config/extensions/typelist/PISeverity.ttx`
  - `config/extensions/typelist/PICorrectionMode.ttx`
- Gosu services and orchestration:
  - `config/gosu/com/guidewire/policyintegrity/ValidationService.gs`
  - `config/gosu/com/guidewire/policyintegrity/CorrectionService.gs`
  - `config/gosu/com/guidewire/policyintegrity/ScoreService.gs`
  - `config/gosu/com/guidewire/policyintegrity/PolicyIntegrityOrchestrator.gs`
  - `config/gosu/com/guidewire/policyintegrity/PolicyIntegritySaveHook.gs`
  - `config/gosu/com/guidewire/policyintegrity/PolicyIntegrityConstants.gs`
- Rule and PCF placeholders:
  - `config/rules/PolicyIntegrityOnSave.gr`
  - `config/pcf/policy/PolicyIntegrityDashboard.pcf`

## Governance and Control Model

- AutoFixable: only safe issues are auto-corrected.
- CorrectionMode: Auto, Suggested, Manual.
- AlreadyCorrected: prevents correction loops.
- Idempotency: duplicate issue prevention using RuleId + IssueKey.
- Re-validation control: exactly one re-validation pass.

## Weighted Integrity Scoring

- Critical: -20
- High: -10
- Medium: -5
- Low: -2

Formula:

- score = clamp(100 - totalDeduction, 0, 100)

## Run Instructions

### Option A: UI demo (recommended)

1. Install dependencies:

   npm install

2. Start app:

   npm start

3. Open in browser:

   http://localhost:3000

If port 3000 is busy (PowerShell):

   $env:PORT=3001; npm start

Then open:

   http://localhost:3001

### Option B: Console demo

- node DemoRunner.js

or

- npm run demo

## API Endpoints

- GET /api/health
- GET /api/demo-cases
- POST /api/validate-policy

## Required Demo Cases

1. Case 1 - Auto Fix + Suggestion
2. Case 2 - Suggestion Only
3. Case 3 - Blocked

## Viva Positioning

Use this line:

This is a simulated Guidewire extension that reproduces PolicyCenter-like architecture, rule execution, governance controls, and auditable integrity scoring.

## Note on Scope

This repository does not replicate the proprietary Guidewire runtime. It simulates equivalent architecture and lifecycle behavior for demonstration and evaluation.
