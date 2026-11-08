const EU27 = new Set("AUT BEL BGR HRV CYP CZE DNK EST FIN FRA DEU GRC HUN IRL ITA LVA LTU LUX MLT NLD POL PRT ROU SVK SVN ESP SWE".split(" "));
export type RegionalCell = { region: string; sector: string; gas: string; nativeMt: number };
export function regionForCountry(code: string) {
  if (!/^[A-Z]{3}$/.test(code)) throw new Error("Missing or invalid source country code");
  if (code === "AIR" || code === "SEA") return "International transport";
  if (EU27.has(code)) return "EU27";
  return ({ USA: "US", CHN: "China", IND: "India" } as Record<string, string>)[code] ?? "Rest of World";
}
export function aggregateRegionalInventory(rows: { country: string; sector: string; gas: string; nativeMt: number }[]): RegionalCell[] {
  const grouped = new Map<string, number[]>();
  for (const row of rows) {
    if (!row.sector || !row.gas || !Number.isFinite(row.nativeMt)) throw new Error("Invalid native inventory cell");
    const key = JSON.stringify([regionForCountry(row.country), row.sector, row.gas]);
    const values = grouped.get(key) ?? [];
    values.push(row.nativeMt);
    grouped.set(key, values);
  }
  return Array.from(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([key, values]) => {
    const [region, sector, gas] = JSON.parse(key);
    // Deterministic summation independent of source-row ordering; retain signed corrections.
    values.sort((a, b) => Math.abs(a) - Math.abs(b) || a - b);
    return { region, sector, gas, nativeMt: values.reduce((s, x) => s + x, 0) };
  });
}
export function reconcileRegionalInventory(cells: RegionalCell[], global: { gas: string; sector: string; nativeMt: number }[]) {
  const sum = new Map<string, number>();
  for (const c of cells) {
    const key = `${c.gas}|${c.sector}`;
    sum.set(key, (sum.get(key) ?? 0) + c.nativeMt);
  }
  const residuals = global.map(c => {
    const key = `${c.gas}|${c.sector}`;
    const total = sum.get(key);
    sum.delete(key);
    const absoluteErrorMt = total === undefined ? null : Math.abs(total - c.nativeMt);
    return { gas: c.gas, sector: c.sector, absoluteErrorMt,
      passed: absoluteErrorMt !== null && absoluteErrorMt <= 1e-9 * Math.max(Math.abs(c.nativeMt), 1e-12) };
  });
  return { passed: sum.size === 0 && residuals.every(r => r.passed), unexpectedCells: Array.from(sum.keys()), residuals };
}
