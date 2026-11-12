import { contentHash } from "./analysisManifest";

/** Conditional covered-population accounting, not an accepted physical ensemble.
 * Scope/gas/period/geography boundaries remain separate; no automatic global scale. */
export interface PhysicalCell {
  issuer: string; unitId: string; year: number; geography: string;
  scope: "1" | "2-location" | "3-downstream";
  gas: "CO2" | "CH4" | "N2O";
  activity: number; activityUnit: "MWh" | "boe" | "vehicle" | "vehicle-km" | "kWh-delivered" | "kWh-charged" | "module-W-shipped" | "battery-kWh-shipped";
  intensity: number; intensityDenominator: PhysicalCell["activityUnit"];
  intensityNumerator: "tonnes-native-gas";
  ownership: number;
  basis: "full-unit-before-ownership";
  channel: "operational" | "downstream";
  activitySource: Source; intensitySource: Source;
  parentResultHash: string;
  parentActivityPointer: string;
  parentYearPointer:string;
  parentUnitPointer:string;
}
interface Source { hash: string; locator: string; publishedAt: string|null; availableBy?:string;availabilityBasis?:"captured-upper-bound";releaseDay?:string;year: number; periodStart:string;periodEnd:string;geography: string; unit:string; kind:"observed"|"derived-observation"|"conditional-assumption"; gas?:PhysicalCell["gas"]; scope?:PhysicalCell["scope"] }
export interface CoveredPathInput {
  cutoff: string;
  population: string[];
  years: number[];
  parents:{hash:string;payload:unknown}[];
  cells: {issuer:string;unitId:string;year:number;scope:PhysicalCell["scope"];gas:PhysicalCell["gas"];geography:string;channel:PhysicalCell["channel"]}[];
  scenarios: { id: string; assumptions: Record<string, unknown>; cells: PhysicalCell[] }[];
}
const hash = (x: unknown) => typeof x === "string" && /^[a-f0-9]{64}$/.test(x);
const instant = (x: string) => /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(x) && Number.isFinite(Date.parse(x));
const finite = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const unique = <T>(x:T[]) => new Set(x).size === x.length;
function available(source:Source){
 if(source.publishedAt!==null)return source.publishedAt;
 if(source.availabilityBasis==="captured-upper-bound"&&source.availableBy&&source.releaseDay&&
   /^\d{4}-\d\d-\d\d$/.test(source.releaseDay)&&source.releaseDay<=source.availableBy.slice(0,10))return source.availableBy;
 return "";
}
function pointer(value:unknown,path:string){
 if(typeof path!=="string"||!path.startsWith("/"))return undefined;
 for(const part of path.slice(1).split("/").map(p=>p.replace(/~1/g,"/").replace(/~0/g,"~")))
  value=value&&typeof value==="object"&&Object.hasOwn(value,part)?(value as Record<string,unknown>)[part]:undefined;
 return value;
}
export function calculateCoveredPhysicalPaths(raw: CoveredPathInput) {
  // Canonical hash rejects unsupported/nonfinite JSON; clone prevents caller mutation.
  const inputHash=contentHash(raw), input:CoveredPathInput=JSON.parse(JSON.stringify(raw));
  if (!instant(input.cutoff) || !input.population.length || !unique(input.population) ||
      input.population.some(x=>!x.trim()) || !input.years.length || !unique(input.years) ||
      input.years.some(x=>!Number.isInteger(x)) || !input.scenarios.length ||
      !unique(input.scenarios.map(x=>x.id))) throw Error("Invalid complete declared population/scenario domain");
  if(!Array.isArray(input.parents)||!unique(input.parents.map(p=>p.hash))||
    input.parents.some(p=>!hash(p.hash)||contentHash(p.payload)!==p.hash))
    throw Error("Corrupt/conflicting parent domain");
  const coordinate=(c:CoveredPathInput["cells"][number])=>JSON.stringify([c.issuer,c.unitId,c.year,c.scope,c.gas]);
  if(!input.cells.length||!unique(input.cells.map(coordinate))||input.cells.some(c=>!input.population.includes(c.issuer)||!input.years.includes(c.year)))
    throw Error("Invalid complete cell domain");
  const scenarios=input.scenarios.map(s=>{
    const reasons:string[]=[], seen=new Set<string>(), ownership=new Map<string,number>();
    const unitBases=new Map<string,string>();
    if(!s.id || !Object.keys(s.assumptions).length) reasons.push("Missing explicit assumption set");
    const rows=s.cells.map(c=>{
      const key=JSON.stringify([c.issuer,c.unitId,c.year,c.scope,c.gas]);
      const declared=input.cells.find(d=>coordinate(d)===key);
      if(!declared||declared.geography!==c.geography||declared.channel!==c.channel)reasons.push(`Undeclared cell/boundary ${key}`);
      const parent=input.parents.find(p=>p.hash===c.parentResultHash);
      const activity=pointer(parent?.payload,c.parentActivityPointer);
      if(!parent||contentHash(parent.payload)!==parent.hash||activity!==c.activity)
        reasons.push(`Missing/corrupt/mismatched activity parent ${key}`);
      const unit=pointer(parent?.payload,c.parentUnitPointer);
      const equivalent:Record<string,string>={"solar-module-W-shipped":"module-W-shipped","EV-shipped":"vehicle"};
      if(pointer(parent?.payload,c.parentYearPointer)!==c.year||
        typeof unit!=="string"||(equivalent[unit]??unit)!==c.activityUnit)
        reasons.push(`Parent period/unit mismatch ${key}`);
      if(seen.has(key))reasons.push(`Duplicate cell ${key}`);seen.add(key);
      if(!input.population.includes(c.issuer)||!input.years.includes(c.year)||!c.unitId||!c.geography)
        reasons.push(`Outside declared population/period ${key}`);
      if(!["1","2-location","3-downstream"].includes(c.scope)||!["CO2","CH4","N2O"].includes(c.gas)||
        !["MWh","boe","vehicle","vehicle-km","kWh-delivered","kWh-charged","module-W-shipped","battery-kWh-shipped"].includes(c.activityUnit)||
        c.activityUnit!==c.intensityDenominator||c.intensityNumerator!=="tonnes-native-gas"||
        c.basis!=="full-unit-before-ownership"||!hash(c.parentResultHash))
        reasons.push(`Incompatible physical/parent identity ${key}`);
      if(!finite(c.activity)||c.activity<0||!finite(c.intensity)||c.intensity<0||
        !finite(c.ownership)||c.ownership<=0||c.ownership>1)reasons.push(`Missing/invalid quantity ${key}`);
      if((c.scope==="3-downstream" ? c.channel!=="downstream" : c.channel!=="operational"))
        reasons.push(`Scope/channel mismatch ${key}`);
      for(const source of [c.activitySource,c.intensitySource]){
        if(!source||!hash(source.hash)||!source.locator||!instant(available(source))||
          Date.parse(available(source))>Date.parse(input.cutoff)||source.year!==c.year||source.geography!==c.geography||
          source.periodStart!==`${c.year}-01-01`||source.periodEnd!==`${c.year}-12-31`)
          reasons.push(`Missing/future/incompatible source ${key}`);
        if(source&&(!["observed","derived-observation","conditional-assumption"].includes(source.kind)||
          (source.kind!=="conditional-assumption"&&Date.parse(available(source))<Date.UTC(c.year+1,0,1))))
          reasons.push(`Annual observation/assumption basis mismatch ${key}`);
      }
      if(c.activitySource?.unit!==c.activityUnit||c.intensitySource?.unit!==`tonnes-${c.gas}/${c.activityUnit}`||
        c.intensitySource?.gas!==c.gas||c.intensitySource?.scope!==c.scope)
        reasons.push(`Source unit/gas/scope mismatch ${key}`);
      const unitKey=JSON.stringify([c.unitId,c.year,c.scope,c.gas]);
      const base=contentHash({activity:c.activity??null,intensity:c.intensity??null,activityUnit:c.activityUnit??null,activitySource:c.activitySource??null,intensitySource:c.intensitySource??null,geography:c.geography??null});
      if(unitBases.has(unitKey)&&unitBases.get(unitKey)!==base)reasons.push(`Conflicting shared-unit basis ${unitKey}`);
      unitBases.set(unitKey,base);
      ownership.set(unitKey,(ownership.get(unitKey)??0)+c.ownership);
      const emissionsTonnes=c.activity*c.intensity*c.ownership;
      if(!finite(emissionsTonnes))reasons.push(`Nonfinite emissions ${key}`);
      return {...c,emissionsTonnes,
        lineage:{activity:c.activitySource,intensity:c.intensitySource,parentResultHash:c.parentResultHash},
        formula:"full-unit activity × compatible native-gas intensity × ownership (once)"};
    });
    for(const [key,share]of Array.from(ownership))if(share>1+1e-12)reasons.push(`Overlapping ownership ${key}`);
    for(const c of input.cells)if(!seen.has(coordinate(c)))reasons.push(`Missing declared cell ${coordinate(c)}`);
    for(const issuer of input.population)for(const year of input.years)
      if(!s.cells.some(c=>c.issuer===issuer&&c.year===year))reasons.push(`Missing issuer-period ${issuer}/${year}`);
    const totals:Record<string,number>={};
    if(!reasons.length)for(const row of rows){
      const key=JSON.stringify([row.year,row.geography,row.scope,row.gas,row.channel]);
      totals[key]=(totals[key]??0)+row.emissionsTonnes;
    }
    return {id:s.id,assumptions:s.assumptions,assumptionHash:contentHash(s.assumptions),
      status:reasons.length?"unavailable":"conditional",reasons,rows:reasons.length?null:rows,
      totals:reasons.length?null:totals};
  });
  const keys=Array.from(new Set(input.cells.map(c=>JSON.stringify([c.year,c.geography,c.scope,c.gas,c.channel])))).sort();
  const ranges=keys.map(key=>{
    const values=scenarios.map(s=>s.totals?.[key]);
    const missing=scenarios.filter((_,i)=>values[i]===undefined).map(s=>s.id);
    return {key,missingScenarioIds:missing,min:missing.length?null:Math.min(...values as number[]),
      max:missing.length?null:Math.max(...values as number[])};
  });
  return {version:"covered-physical-paths-1",inputHash,population:input.population,years:input.years,
    scenarios,ranges,expanded:null,expansionReason:"No evidenced sector-region expansion model/denominator",
    claim:"Conditional native-gas accounting; scopes/channels are not additive; no avoided-emissions or market inference",
    stage7:{status:"unavailable",reason:"Covered emissions alone do not identify a complete global member path; no expansion or accepted ensemble supplied",
      warming2100:{median:null,mean:null,p10:null,p90:null},
      netZeroYears:{ghg:null,co2:null},
      probabilityNetZero2050:{ghg:null,co2:null},
      reductionRates:{period2024_2030:null,period2030_2050:null,period2050_2100:null}},
    scientificAcceptance:false};
}
