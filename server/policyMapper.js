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
    accountNumber: input.accountNumber || null,
    lineOfBusiness: input.lineOfBusiness || null,
    productCode: input.productCode || null,
    offering: input.offering || null,
    termType: input.termType || null,
    effectiveDate: input.effectiveDate || null,
    expirationDate: input.expirationDate || null,
    jurisdiction: input.jurisdiction || null,
    producerCode: input.producerCode || null,
    underwriter: input.underwriter || null,
    submissionChannel: input.submissionChannel || null,
    billingPlan: input.billingPlan || null,
    currency: input.currency || null,
    customer,
    customerNameHint: input.customerName || null,
    customerAddressHint: input.customerAddress || null,
    address: input.policyAddress || null,
    billingActive: toBoolean(input.billingActive, false),
    duplicateCustomerCandidate: toBoolean(input.duplicateCustomerCandidate, false),
    configValid: toBoolean(input.configValid, true)
  });
}

module.exports = {
  mapRequestToPolicy
};
