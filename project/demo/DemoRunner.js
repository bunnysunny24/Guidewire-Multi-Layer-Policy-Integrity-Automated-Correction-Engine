const Policy = require("../model/Policy");
const Customer = require("../model/Customer");
const PolicyIntegrityEngine = require("../engine/PolicyIntegrityEngine");

function printResult(title, result) {
  console.log(`\n=== ${title} ===`);
  console.log(`Score Before: ${result.scoreBefore}`);
  console.log(`Score After : ${result.scoreAfter}`);
  console.log(`Can Proceed : ${result.canProceed}`);

  console.log("Issues:");
  for (const issue of result.issues) {
    console.log(
      `- [${issue.severity}] ${issue.ruleId} | mode=${issue.correctionMode} | status=${issue.status}`
    );
  }

  console.log("Corrections:");
  for (const correction of result.corrections) {
    console.log(
      `- ${correction.correctionType}: ${correction.oldValue} -> ${correction.newValue}`
    );
  }
}

function runDemo() {
  const customer = new Customer({
    id: "CUST-001",
    name: "Aarav Sharma",
    address: "12 Green Street"
  });

  // Case 1: Auto-fix + suggestion.
  const policyAutoFix = new Policy({
    id: "POL-1001",
    premium: -500,
    coverage: 200000,
    customer,
    address: null,
    duplicateCustomerCandidate: true,
    configValid: true
  });

  const result1 = PolicyIntegrityEngine.run(policyAutoFix, "demo.user");
  printResult("Case 1 - Auto Fix + Suggestion", result1);

  // Case 2: Suggest only.
  const policySuggestOnly = new Policy({
    id: "POL-1002",
    premium: 8000,
    coverage: 150000,
    customer,
    address: "12 Green Street",
    duplicateCustomerCandidate: true,
    configValid: true
  });

  const result2 = PolicyIntegrityEngine.run(policySuggestOnly, "demo.user");
  printResult("Case 2 - Suggestion Only", result2);

  // Case 3: Block (critical non-auto-fixable issue).
  const policyBlocked = new Policy({
    id: "POL-1003",
    premium: 9000,
    coverage: 100000,
    customer,
    configValid: false
  });

  const result3 = PolicyIntegrityEngine.run(policyBlocked, "demo.user");
  printResult("Case 3 - Blocked", result3);
}

runDemo();
