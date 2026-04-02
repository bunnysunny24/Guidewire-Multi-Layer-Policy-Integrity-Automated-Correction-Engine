class Policy {
  constructor({
    id,
    premium = 0,
    coverage = 0,
    status = "Active",
    customer = null,
    address = null,
    billingActive = false,
    duplicateCustomerCandidate = false,
    configValid = true
  } = {}) {
    this.id = id || `POL-${Date.now()}`;
    this.premium = premium;
    this.coverage = coverage;
    this.status = status;
    this.customer = customer;
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
