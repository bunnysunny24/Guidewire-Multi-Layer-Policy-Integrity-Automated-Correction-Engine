class ScoreService {
  static calculate(issues) {
    const score = issues.reduce((acc, issue) => {
      if (issue.status === "Resolved") {
        return acc;
      }
      return acc - this.getDeduction(issue.severity);
    }, 100);

    return Math.max(0, Math.min(100, score));
  }

  static getDeduction(severity) {
    switch (severity) {
      case "Critical":
        return 20;
      case "High":
        return 10;
      case "Medium":
        return 5;
      case "Low":
        return 2;
      default:
        return 0;
    }
  }
}

module.exports = ScoreService;
