import { createHash } from "node:crypto";
/** S13-003. All money is GROSS unit nominal USD million; ownership is applied once.
 * Conditional asset CF only. No hidden balance-sheet, common-equity or tax bridge.
 */
export interface RetirementYear {
  year: number;
  capacityFactor: number;
  priceUsdMWh: number;
  variableCostUsdMWh: number;
  fixedOpex: number;
  maintenanceCapex: number;
  replacementPowerCash: number;
  replacementCapex: number;
  cashTaxes: number;
  deltaWorkingCapital: number;
  recoveryCash: number;
}
export interface RetirementUnit {
  id: string; legalEntity: string; site: string; fullUnitNetMW: number; ownership: number;
  announcedYear: number | null; legallyCommittedLatestYear: number | null;
  retirementYear: number;
  unrecoveredBookValue: number;
  decommissioningCash: number; decommissioningPaymentYear: number;
  sourceIds: string[];
  years: RetirementYear[];
}
export interface RetirementInput {
  issuer: string; currency: "USD"; basis: "unit-unlevered"; fiscal: "calendar";
  startYear: number; endYear: number; discountRate: number; terminalValue: 0;
  sources: { id: string; publishedAt: string; locator: string; sha256: string }[];
  cutoff: string; assumptionId: string; units: RetirementUnit[];
  cashConvention: "energy-revenue-excludes-separate-capital-recovery";
  recoveryBasis: "cash-collections-not-book-amortization";
  decommissioningBasis: "payments-not-provision";
}
const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const exactInstant = (value: string) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
  Number.isFinite(Date.parse(value));
const requireValue = (ok: unknown, why: string) => { if (!ok) throw new Error(why); };
export function calculateUtilityRetirement(input: RetirementInput) {
  requireValue(input.currency === "USD" && input.basis === "unit-unlevered" && input.fiscal === "calendar",
    "Unsupported currency/fiscal/cash-flow basis");
  requireValue(Number.isInteger(input.startYear) && Number.isInteger(input.endYear) &&
    input.endYear >= input.startYear && input.endYear - input.startYear <= 100, "Invalid horizon");
  requireValue(finite(input.discountRate) && input.discountRate > 0 && input.discountRate < 1 &&
    input.terminalValue === 0 && input.assumptionId, "Explicit admissible discount/terminal/assumption required");
  const cutoff = Date.parse(input.cutoff);
  requireValue(exactInstant(input.cutoff), "Exact cutoff timestamp required");
  requireValue(cutoff <= Date.UTC(input.startYear, 0, 1), "Full-year prospective cash flow starts before source cutoff; stub/revised history unsupported");
  requireValue(input.cashConvention === "energy-revenue-excludes-separate-capital-recovery" &&
    input.recoveryBasis === "cash-collections-not-book-amortization" &&
    input.decommissioningBasis === "payments-not-provision", "Cash/recovery double-counting convention missing");
  const sources = new Set<string>();
  for (const s of input.sources) {
    requireValue(!sources.has(s.id) && s.id && s.locator && /^[0-9a-f]{64}$/.test(s.sha256) &&
      exactInstant(s.publishedAt) && Date.parse(s.publishedAt) <= cutoff, "Missing/future/conflicting source; publication day is not exact availability");
    sources.add(s.id);
  }
  requireValue(input.units.length > 0, "Empty covered fleet");
  const ids = new Set<string>();
  const rows = input.units.flatMap(u => {
    requireValue(u.id && !ids.has(u.id) && u.legalEntity === input.issuer && u.site, "Duplicate/wrong legal-entity unit");
    ids.add(u.id);
    requireValue(finite(u.fullUnitNetMW) && u.fullUnitNetMW > 0 && finite(u.ownership) && u.ownership > 0 && u.ownership <= 1,
      "Invalid gross capacity/ownership");
    requireValue(u.sourceIds.length > 0 && u.sourceIds.every(id => sources.has(id)), "Unbound unit source");
    requireValue(Number.isInteger(u.retirementYear) && u.retirementYear >= input.startYear &&
      u.retirementYear <= input.endYear, "Retirement outside explicit horizon");
    requireValue((u.announcedYear === null || Number.isInteger(u.announcedYear)) &&
      (u.legallyCommittedLatestYear === null || (Number.isInteger(u.legallyCommittedLatestYear) &&
        u.retirementYear <= u.legallyCommittedLatestYear)), "Legally committed date violated");
    requireValue(finite(u.unrecoveredBookValue) && u.unrecoveredBookValue >= 0 &&
      finite(u.decommissioningCash) && u.decommissioningCash >= 0 &&
      Number.isInteger(u.decommissioningPaymentYear) && u.decommissioningPaymentYear >= u.retirementYear &&
      u.decommissioningPaymentYear <= input.endYear, "Missing/out-of-horizon liability or book balance");
    requireValue(u.years.length === input.endYear - input.startYear + 1, "Missing annual cash inputs");
    return u.years.map((y, i) => {
      requireValue(y.year === input.startYear + i, "Noncontiguous or unordered fiscal years");
      for (const field of ["capacityFactor", "priceUsdMWh", "variableCostUsdMWh", "fixedOpex", "maintenanceCapex",
        "replacementPowerCash", "replacementCapex", "cashTaxes", "deltaWorkingCapital", "recoveryCash"] as const)
        requireValue(finite(y[field]), `Missing/nonfinite ${field}`);
      requireValue(y.capacityFactor >= 0 && y.capacityFactor <= 1 &&
        [y.variableCostUsdMWh,y.fixedOpex,y.maintenanceCapex,y.replacementPowerCash,y.replacementCapex,y.recoveryCash].every(v => v >= 0),
      "Invalid cost/activity domain");
      const operating = y.year < u.retirementYear;
      requireValue(operating || (y.capacityFactor === 0 && y.fixedOpex === 0 && y.maintenanceCapex === 0),
        "Retired unit has undeclared continuing operation costs/activity");
      const leap = y.year % 4 === 0 && (y.year % 100 !== 0 || y.year % 400 === 0);
      const grossGenerationMWh = operating ? u.fullUnitNetMW * (leap ? 8784 : 8760) * y.capacityFactor : 0;
      const revenue = grossGenerationMWh * y.priceUsdMWh / 1e6;
      const variableCost = grossGenerationMWh * y.variableCostUsdMWh / 1e6;
      const decommissioning = y.year === u.decommissioningPaymentYear ? u.decommissioningCash : 0;
      const grossCashFlow = revenue - variableCost - y.fixedOpex - y.maintenanceCapex -
        y.replacementPowerCash - y.replacementCapex - y.cashTaxes - y.deltaWorkingCapital +
        y.recoveryCash - decommissioning;
      const ownedCashFlow = grossCashFlow * u.ownership;
      return { unitId: u.id, year: y.year, operating, grossGenerationMWh,
        ownedGenerationMWh: grossGenerationMWh * u.ownership, revenue, variableCost,
        fixedOpex:y.fixedOpex, maintenanceCapex:y.maintenanceCapex,
        replacementPowerCash:y.replacementPowerCash,replacementCapex:y.replacementCapex,
        cashTaxes:y.cashTaxes,deltaWorkingCapital:y.deltaWorkingCapital,recoveryCash:y.recoveryCash,
        decommissioning, grossCashFlow, ownership:u.ownership, ownedCashFlow,
        discountedCashFlow: ownedCashFlow / (1 + input.discountRate) ** (i + 1),
        unrecoveredBookValueDisclosureOnly:u.unrecoveredBookValue };
    });
  });
  return { claim: "Conditional unit-attributable unlevered cash flow, not common equity or market-implied retirement",
    rows, valueUsdMillion:rows.reduce((sum,r)=>sum+r.discountedCashFlow,0),
    commonEquityValue:null, marketImpliedRetirement:null };
}
/** A finite, fully declared candidate set is exhaustively tested. All feasible roots are returned.
 * No uniqueness claim beyond this discrete domain, no dates interpolated from sampled NPVs.
 */
export function freezeUtilityRetirement(candidates: { id:string; input:RetirementInput }[],
  target: { valueUsdMillion:number; basis:"unit-unlevered"; currency:"USD"; assumptionId:string },
  toleranceUsdMillion:number) {
  const serialized=JSON.stringify({candidates,target,toleranceUsdMillion},(_key,value)=>{
    if (typeof value==="number" && !Number.isFinite(value) || value===undefined)
      throw new Error("Nonfinite/undefined frozen material");
    return value;
  });
  return Object.freeze({version:"retirement-discrete-domain-1" as const,
    frozenAt:new Date().toISOString(),
    materialSha256:createHash("sha256").update(serialized).digest("hex"),
    material:JSON.parse(serialized) as {candidates: typeof candidates;target:typeof target;toleranceUsdMillion:number},
    meaning:"Present-process declaration, not independent signature or historical precommitment"});
}
export function invertUtilityRetirement(freeze: ReturnType<typeof freezeUtilityRetirement>) {
  requireValue(freeze.version==="retirement-discrete-domain-1" &&
    Number.isFinite(Date.parse(freeze.frozenAt)) && Date.parse(freeze.frozenAt)<=Date.now() &&
    createHash("sha256").update(JSON.stringify(freeze.material)).digest("hex")===freeze.materialSha256,
    "Missing/corrupt/future pre-inversion domain");
  const {candidates,target,toleranceUsdMillion}=freeze.material;
  requireValue(candidates.length > 0 && new Set(candidates.map(c=>c.id)).size === candidates.length, "Invalid candidate domain");
  requireValue(finite(target.valueUsdMillion) && target.basis === "unit-unlevered" && target.currency === "USD" &&
    finite(toleranceUsdMillion) && toleranceUsdMillion > 0, "Unsupported target/tolerance");
  const results = candidates.map(c => {
    requireValue(c.input.assumptionId === target.assumptionId, "Target assumption mismatch");
    const result = calculateUtilityRetirement(c.input);
    return { id:c.id, valueUsdMillion:result.valueUsdMillion, residualUsdMillion:result.valueUsdMillion-target.valueUsdMillion };
  });
  const roots = results.filter(r=>Math.abs(r.residualUsdMillion)<=toleranceUsdMillion);
  return { status: roots.length===1 ? "unique-within-declared-discrete-domain" : roots.length ? "nonidentified-multiple" : "no-root",
    roots, results, domainSha256:freeze.materialSha256, frozenAt:freeze.frozenAt,
    marketImpliedRetirement:null, scope:"Conditional candidate-set matching only; declaration is not independent approval" };
}
