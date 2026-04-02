class PolicyIssue {
  constructor({
    issueType,
    description,
    severity,
    ruleId,
    issueKey,
    autoFixable,
    correctionMode,
    correctionConfidence = null,
    detectedAt,
    detectedBy
  }) {
    this.issueType = issueType;
    this.description = description;
    this.severity = severity;
    this.ruleId = ruleId;
    this.issueKey = issueKey;

    this.autoFixable = Boolean(autoFixable);
    this.correctionMode = correctionMode;
    this.correctionConfidence = correctionConfidence;

    this.status = "Open";
    this.alreadyCorrected = false;

    this.detectedAt = detectedAt;
    this.detectedBy = detectedBy;
    this.correctedAt = null;
    this.correctedBy = null;
  }
}

module.exports = PolicyIssue;
