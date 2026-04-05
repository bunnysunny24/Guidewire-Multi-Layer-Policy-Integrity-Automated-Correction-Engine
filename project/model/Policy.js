class Policy {
  constructor({
    id,
    premium = 0,
    coverage = 0,
    status = "Active",
    accountNumber = null,
    lineOfBusiness = null,
    productCode = null,
    offering = null,
    termType = null,
    effectiveDate = null,
    expirationDate = null,
    jurisdiction = null,
    producerCode = null,
    underwriter = null,
    submissionChannel = null,
    billingPlan = null,
    currency = null,
    customer = null,
    customerNameHint = null,
    customerAddressHint = null,
    address = null,
    billingActive = false,
    duplicateCustomerCandidate = false,
    configValid = true
  } = {}) {
    this.id = id || `POL-${Date.now()}`;
    this.premium = premium;
    this.coverage = coverage;
    this.status = status;
    this.accountNumber = accountNumber;
    this.lineOfBusiness = lineOfBusiness;
    this.productCode = productCode;
    this.offering = offering;
    this.termType = termType;
    this.effectiveDate = effectiveDate;
    this.expirationDate = expirationDate;
    this.jurisdiction = jurisdiction;
    this.producerCode = producerCode;
    this.underwriter = underwriter;
    this.submissionChannel = submissionChannel;
    this.billingPlan = billingPlan;
    this.currency = currency;
    this.customer = customer;
    this.customerNameHint = customerNameHint;
    this.customerAddressHint = customerAddressHint;
    this.address = address;
    this.billingActive = billingActive;
    this.duplicateCustomerCandidate = duplicateCustomerCandidate;
    this.configValid = configValid;

    this.issues = [];
    this.corrections = [];
    this.integrityScoreBefore = 100;
    this.integrityScoreAfter = 100;
    this.integrityScore = 100;
    this.lastRunAt = null;
  }
}

module.exports = Policy;
