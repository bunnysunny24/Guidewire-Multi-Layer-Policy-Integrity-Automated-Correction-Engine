const rulesCatalog = [
  {
    ruleId: "VAL_PREMIUM_NEGATIVE",
    name: "Premium is non-negative",
    layer: "FieldValidation",
    defaultSeverity: "High",
    enabled: true
  },
  {
    ruleId: "VAL_POLICY_ADDRESS_MISSING",
    name: "Policy address is present",
    layer: "FieldValidation",
    defaultSeverity: "Low",
    enabled: true
  },
  {
    ruleId: "BUS_COVERAGE_PREMIUM_MISMATCH",
    name: "Coverage and premium consistency",
    layer: "BusinessValidation",
    defaultSeverity: "Medium",
    enabled: true
  },
  {
    ruleId: "BUS_POLICY_CONFIG_INVALID",
    name: "Policy configuration is valid",
    layer: "BusinessValidation",
    defaultSeverity: "Critical",
    enabled: true
  },
  {
    ruleId: "XENT_MISSING_CUSTOMER",
    name: "Policy has customer linkage",
    layer: "CrossEntityValidation",
    defaultSeverity: "Critical",
    enabled: true
  },
  {
    ruleId: "XENT_DUPLICATE_CUSTOMER",
    name: "Duplicate customer suspicion",
    layer: "CrossEntityValidation",
    defaultSeverity: "Low",
    enabled: true
  },
  {
    ruleId: "XSYS_BILLING_ACTIVE_ON_CANCELLED",
    name: "Cancelled policy cannot have active billing",
    layer: "CrossSystemValidation",
    defaultSeverity: "High",
    enabled: true
  }
];

function createRuleConfigMap(configList = []) {
  return configList.reduce((acc, item) => {
    acc[item.ruleId] = {
      enabled: item.enabled !== false,
      severity: item.severity || item.defaultSeverity || "Low"
    };
    return acc;
  }, {});
}

module.exports = {
  rulesCatalog,
  createRuleConfigMap
};
