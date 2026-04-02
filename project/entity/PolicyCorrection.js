class PolicyCorrection {
  constructor({
    issueId,
    ruleId,
    correctionType,
    actionTaken,
    oldValue,
    newValue,
    correctedAt,
    correctedBy
  }) {
    this.issueId = issueId;
    this.ruleId = ruleId;
    this.correctionType = correctionType;
    this.actionTaken = actionTaken;
    this.oldValue = oldValue;
    this.newValue = newValue;
    this.correctedAt = correctedAt;
    this.correctedBy = correctedBy;
  }
}

module.exports = PolicyCorrection;
