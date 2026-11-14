import {calculateOperatingCohorts,type CohortSpecification} from "./operatingCohorts";
import type {AccrualSchedule} from "./cohortCashLedger";
/** Same daily-prefix rule for finite and funded paths; not a legal retirement. */
export function assessCohortRecognition(specification:CohortSpecification,accrual:AccrualSchedule,law?:string){
 if(law===undefined)return null;
 if(law!=="earned-service-prefix-1"||specification.timing!=="utc-civil-day-service"||accrual.version!=="dated-accrual-2")
  throw Error("Explicit supported daily recognition law required");
 if(accrual.entries.some(e=>e.kind==="payable"&&!e.component))
  throw Error("Classify payable components before physical recognition assessment");
 const checks=[];
 for(const on of Array.from(new Set(accrual.entries.map(e=>e.on))).sort()){
  const year=Number(on.slice(0,4)),yearStart=`${year}-01-01`;
  const cap=new Date(Date.parse(on)+86400000).toISOString().slice(0,10);
  const cohorts=specification.cohorts.filter(c=>c.dated!.commissionedOn<cap&&c.dated!.retiredOn>yearStart)
   .map(c=>{const retiredOn=c.dated!.retiredOn<cap?c.dated!.retiredOn:cap;
    return {...c,retiredYear:Number(retiredOn.slice(0,4)),dated:{...c.dated!,retiredOn}};});
  const annual=specification.years.find(y=>y.year===year)!;
  const prefix=cohorts.length?calculateOperatingCohorts({...specification,liquidation:undefined,years:[annual],cohorts}).rows[0]:null;
  for(const component of ["revenue","variableCost","energyCost"] as const){
   const recognized=accrual.entries.filter(e=>e.on.startsWith(`${year}-`)&&e.on<=on&&
    (component==="revenue"?e.kind==="revenue":e.kind==="payable"&&e.component===component)).reduce((v,e)=>v+e.usd,0);
   const earned=prefix?.[component]??0;
   if(recognized-earned>1e-9*Math.max(1,Math.abs(earned),Math.abs(recognized)))
    throw Error(`Recognition precedes modeled physical service: ${on}/${component}`);
   checks.push({on,component,recognizedUsd:recognized,earnedThroughDayUsd:earned,unrecognizedUsd:earned-recognized});
  }
 }
 return {version:law,checks,
  boundary:"End-of-UTC-day service prefix; delayed recognition allowed. Not legal/GAAP acceptance, intraday proof or complete balance-sheet accounting."};
}
