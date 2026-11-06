export function calculationReadiness() {
  return {
    defaultEngine: "legacy-dashboard",
    candidateEnabled: false,
    checks: [
      { id: "scientific-validation", label: "Independent scientific validation", passed: false,
        reason: "Complete native-gas scenarios, updated historical forcing and independent FaIR comparison are not yet verified." },
    ],
    limitations: ["A successful build or reference execution does not authorize scientific default promotion."],
  };
}
