const express = require("express");
const path = require("path");
const PolicyIntegrityEngine = require("../project/engine/PolicyIntegrityEngine");
const { mapRequestToPolicy } = require("./policyMapper");

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

app.post("/api/validate-policy", (req, res) => {
  try {
    const actor = req.body.actor || "ui.user";
    const policy = mapRequestToPolicy(req.body);
    const result = PolicyIntegrityEngine.run(policy, actor);

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

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.listen(PORT, () => {
  console.log(`Policy Integrity UI running at http://localhost:${PORT}`);
});
