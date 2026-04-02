const Policy = require("../project/model/Policy");
const Customer = require("../project/model/Customer");

function toBoolean(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
  }
  return fallback;
}

function mapRequestToPolicy(input = {}) {
  const hasCustomer = toBoolean(input.hasCustomer, true);

  const customer = hasCustomer
    ? new Customer({
        id: input.customerId || "CUST-UI",
        name: input.customerName || "UI Customer",
        address: input.customerAddress || null
      })
    : null;

  return new Policy({
    id: input.id || `POL-UI-${Date.now()}`,
    premium: Number(input.premium ?? 0),
    coverage: Number(input.coverage ?? 0),
    status: input.status || "Active",
    customer,
    address: input.policyAddress || null,
    billingActive: toBoolean(input.billingActive, false),
    duplicateCustomerCandidate: toBoolean(input.duplicateCustomerCandidate, false),
    configValid: toBoolean(input.configValid, true)
  });
}

module.exports = {
  mapRequestToPolicy
};
