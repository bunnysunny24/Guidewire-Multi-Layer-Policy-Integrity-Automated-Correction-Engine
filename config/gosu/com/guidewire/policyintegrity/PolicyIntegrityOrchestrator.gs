package com.guidewire.policyintegrity

uses java.util.Date

class PolicyIntegrityOrchestrator {
  var _validationService = new ValidationService()
  var _correctionService = new CorrectionService()
  var _scoreService = new ScoreService()

  function execute(policy: Policy, actor: String) {
    // First pass: detect and classify.
    _validationService.run(policy, actor)

    var beforeScore = _scoreService.calculate(policy.IntegrityIssues.toTypedArray())

    // Correction pass: auto-fix, suggest, or block.
    _correctionService.run(policy, actor)

    // Single re-validation pass after correction to avoid loops.
    _validationService.run(policy, actor)

    var afterScore = _scoreService.calculate(policy.IntegrityIssues.toTypedArray())

    policy.IntegrityScore = afterScore
    policy.IntegrityScoreBefore = beforeScore
    policy.IntegrityScoreAfter = afterScore
    policy.IntegrityLastRunAt = new Date()
  }
}
