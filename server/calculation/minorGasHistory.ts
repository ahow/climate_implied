export const ADDITIONAL_GASES = ["HFC-41", "HFC-134", "HFC-143"] as const;
type SourceRow = { Substance: string; Country_code_A3: string; ipcc_code_2006_for_standard_report: string } & Record<string, unknown>;

/** Audit source cells before constructing explicitly assumed sensitivity cases. */
export function auditMinorGasHistory(rows: SourceRow[]) {
  const selected = rows.filter(r => (ADDITIONAL_GASES as readonly string[]).includes(r.Substance));
  const keys = selected.map(r => JSON.stringify([r.Substance, r.Country_code_A3, r.ipcc_code_2006_for_standard_report]));
  if (new Set(keys).size !== keys.length) throw new Error("Duplicate gas/country/sector history");
  const gases = Object.fromEntries(ADDITIONAL_GASES.map(gas => {
    const source = selected.filter(r => r.Substance === gas);
    if (!source.length) throw new Error(`Missing source species ${gas}`);
    return [gas, Array.from({ length: 55 }, (_, i) => {
      const year = 1970 + i;
      let reportedSubtotalMt = 0;
      const missingCells: { country: string; sector: string }[] = [];
      for (const row of source) {
        const raw = row[`Y_${year}`];
        if (raw === undefined || raw === null || raw === "") {
          missingCells.push({ country: row.Country_code_A3, sector: row.ipcc_code_2006_for_standard_report });
        } else {
          if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0)
            throw new Error("Invalid native historical emissions");
          reportedSubtotalMt += raw / 1000; // Native Gg to Mt, not GWP weighted.
        }
      }
      return { year, reportedSubtotalMt, valueMt: missingCells.length ? null : reportedSubtotalMt, missingCells };
    })];
  }));
  return { gases, selectedRows: selected.length, sourceYears: [1970, 2024],
    unavailableBefore1970: true, productionEligible: false };
}

export function minorGasSensitivityHistory(rows: SourceRow[], method: "zero-missing" | "carry-forward" | "historical-peak-stress", url: string) {
  if (!["zero-missing", "carry-forward", "historical-peak-stress"].includes(method))
    throw new Error("Unknown sensitivity method");
  const audit = auditMinorGasHistory(rows);
  const years = Array.from({ length: 274 }, (_, i) => 1750 + i);
  const gases = Object.fromEntries(ADDITIONAL_GASES.map(gas => {
    const selected = rows.filter(r => r.Substance === gas);
    const values = years.map(year => {
      if (year < 1970) return 0; // Explicit common sensitivity assumption, NOT a source observation.
      return selected.reduce((total, row) => {
        const value = row[`Y_${year}`];
        if (typeof value === "number") return total + value / 1000;
        if (method === "zero-missing") return total;
        if (method === "historical-peak-stress") {
          const prior = Array.from({ length: year - 1970 }, (_, i) => row[`Y_${1970 + i}`])
            .filter((v): v is number => typeof v === "number");
          if (!prior.length) throw new Error("No prior observations for peak stress");
          return total + Math.max(...prior) / 1000;
        }
        for (let previous = year - 1; previous >= 1970; previous--) {
          const prior = row[`Y_${previous}`];
          if (typeof prior === "number") return total + prior / 1000;
        }
        throw new Error("No prior observation for carry-forward sensitivity");
      }, 0);
    });
    return [gas, values];
  }));
  return { unit: "Mt gas/year", years, gases,
    source: { url, basis: "EDGAR native history with explicit unapproved sensitivity assumptions",
      method, observedHistoryComplete: false, pre1970: "assumed zero for this sensitivity, not observed",
      missing1970Onward: method, historyApproval: "not-approved" },
    audit, productionEligible: false };
}
