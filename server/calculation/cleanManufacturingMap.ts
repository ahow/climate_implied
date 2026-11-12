import { contentHash } from "./analysisManifest";
import { calculateCompanyFullCashflowCase, valueCompanyFullCashflowCase } from "./companyFullCashflowCase";

export type ManufacturedProduct = "solar-module-W-shipped" | "wind-turbine-kW-shipped" | "EV-shipped" | "battery-kWh-shipped";
export interface ManufacturingYear {
  year:number; units:number; capacityUnits:number; realizedPriceUsdPerUnit:number;
  cashVariableCostUsdPerUnit:number; fixedOperatingCostUsdMillion:number;
  capitalUsdPerUnit:number; fixedCapitalUsdMillion:number;
  evidenceIds:string[];
}
export interface ManufacturingCandidate {
  id:string; product:ManufacturedProduct;
  costBasis:"cash-costs-exclude-depreciation-separate-climate-costs-and-policy-credits";
  /** Existing strict whole-issuer accounting specification, with complete source
   * and assumption evidence. No new default tax/WC/financing coefficients. */
  accounting:Parameters<typeof calculateCompanyFullCashflowCase>[0];
  production:ManufacturingYear[];
}
export function calculateCleanManufacturing(candidate:ManufacturingCandidate) {
  const inputHash=contentHash(candidate), x=JSON.parse(JSON.stringify(candidate));
  if(x.costBasis!=="cash-costs-exclude-depreciation-separate-climate-costs-and-policy-credits")
    throw Error("Explicit no-double-counting cash-cost boundary required");
  if(!["solar-module-W-shipped","wind-turbine-kW-shipped","EV-shipped","battery-kWh-shipped"].includes(x.product))
    throw Error("Unsupported product/unit; shipments are not installed generation");
  // Existing schema/source/fiscal/claim checks run BEFORE deriving new rows.
  calculateCompanyFullCashflowCase(x.accounting);
  if(x.accounting.terminalGrowth<.025||x.accounting.terminalGrowth>.04||
    !Number.isFinite(x.accounting.terminalGrowth))throw Error("Original nominal terminal2.5–4% required");
  if(x.production.length!==5)throw Error("Five physical/accounting years required");
  const rows=x.production.map((p:ManufacturingYear,i:number)=>{
    const old=x.accounting.years[i];
    if(p.year!==old.year||old.nonClimateRevenue!==0)throw Error("Pure-play/full-issuer year boundary required; no mixed-segment margin allocation");
    for(const key of ["units","capacityUnits","realizedPriceUsdPerUnit","cashVariableCostUsdPerUnit",
      "fixedOperatingCostUsdMillion","capitalUsdPerUnit","fixedCapitalUsdMillion"] as const)
      if(!Number.isFinite(p[key])||p[key]<0)throw Error(`Missing/invalid manufacturing economics ${key}`);
    if(p.units>p.capacityUnits||p.units<=0||p.realizedPriceUsdPerUnit<=0)
      throw Error("Idle/overcapacity or zero-price branch needs separate economics; no fabricated margin");
    if(!p.evidenceIds.length||p.evidenceIds.some(id=>!x.accounting.evidence.some((e:{id:string})=>e.id===id)))
      throw Error("Missing operating evidence/assumption identity");
    const revenue=p.units*p.realizedPriceUsdPerUnit/1e6;
    const operatingProfit=revenue-p.units*p.cashVariableCostUsdPerUnit/1e6-p.fixedOperatingCostUsdMillion-old.depreciation;
    return {...old,climateRevenue:revenue,
      operatingMarginBeforeClimateCostsAndCredits:operatingProfit/revenue,
      capitalSpend:p.fixedCapitalUsdMillion+p.units*p.capitalUsdPerUnit/1e6,
      evidenceIds:Array.from(new Set([...old.evidenceIds,...p.evidenceIds]))};
  });
  const accounting={...x.accounting,years:rows};
  const ledger=calculateCompanyFullCashflowCase(accounting);
  const valuation=valueCompanyFullCashflowCase(accounting);
  return {version:"clean-manufacturing-map-1",inputHash,product:x.product,activity:x.production,
    ledger,valuation,accounting,claims:{marketImplied:false,installedGeneration:false,avoidedEmissions:false,ownerAccepted:false},
    boundary:"Conditional manufactured shipments and supplied whole-issuer cash assumptions; not installed capacity or Tier2"};
}
export function freezeManufacturingDomain(candidates:ManufacturingCandidate[],targetUsdMillion:number,toleranceUsdMillion:number){
  if(!candidates.length||new Set(candidates.map(c=>c.id)).size!==candidates.length||
    !Number.isFinite(targetUsdMillion)||targetUsdMillion<=0||!Number.isFinite(toleranceUsdMillion)||toleranceUsdMillion<0)
    throw Error("Complete distinct candidate domain and declared target/precision required");
  const material=JSON.parse(JSON.stringify({candidates,targetUsdMillion,toleranceUsdMillion}));
  const declaredAt=new Date().toISOString(),version="manufacturing-discrete-domain-1";
  return {version,declaredAt,hash:contentHash({version,declaredAt,material}),material,
    meaning:"Present-process declaration, not independently authenticated chronology or owner thresholds"};
}
export function invertManufacturingDomain(freeze:ReturnType<typeof freezeManufacturingDomain>){
  if(freeze.version!=="manufacturing-discrete-domain-1"||freeze.hash!==contentHash({version:freeze.version,declaredAt:freeze.declaredAt,material:freeze.material})||
    !Number.isFinite(Date.parse(freeze.declaredAt))||Date.parse(freeze.declaredAt)>Date.now())
    throw Error("Corrupt/future manufacturing declaration");
  const outcomes=freeze.material.candidates.map((candidate:ManufacturingCandidate)=>{
    try{
      const result=calculateCleanManufacturing(candidate);
      const residual=result.valuation.forwardWholeEquity-freeze.material.targetUsdMillion;
      return {id:candidate.id,result,residual,reason:null,withinDeclaredTolerance:Math.abs(residual)<=freeze.material.toleranceUsdMillion};
    }catch(error){return{id:candidate.id,result:null,residual:null,reason:String(error),withinDeclaredTolerance:false};}
  });
  const matched=outcomes.filter((o:{withinDeclaredTolerance:boolean})=>o.withinDeclaredTolerance);
  return {declarationHash:freeze.hash,outcomes,
    status:outcomes.some((o:{reason:string|null})=>o.reason)?"incomplete-domain":
      matched.length===0?"no-declared-candidate-root":matched.length===1?"one-declared-candidate-root":"multiple-declared-candidate-roots",
    marketImplied:false,tier2:false,continuousUniqueness:false,
    boundary:"Complete declared discrete domain only; missing candidates never become non-roots; no continuous or owner identification claim"};
}
