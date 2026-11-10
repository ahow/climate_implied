import {nativeGasIds,nativeSectorIds} from "./nativeOutputSemantics";
export const nativeExportColumns=[
  {column:"Year",path:["year"],id:"native.result.trajectory[].year"},
  {column:"Reporting emissions (GtCO2e, AR6 GWP100)",path:["reportingGtCO2e"],id:"native.result.trajectory[].reportingGtCO2e"},
  ...nativeGasIds.map(gas=>({column:`${gas} (Mt gas/year)`,path:["nativeMt",gas],id:`native.result.trajectory[].nativeMt.${gas}`})),
  ...nativeSectorIds.map(sector=>({column:`${sector} (GtCO2e/year)`,path:["sectorsGtCO2e",sector],id:`native.result.trajectory[].sectorsGtCO2e.${sector}`})),
];
export const nativeExportBindings=Object.fromEntries(nativeExportColumns.map(c=>[c.column,{
  id:c.id,transform:"Identity; missing/nonfinite stays blank; no probabilistic or temperature interpretation",
}]));
export function nativeExportRow(point:unknown):Record<string,number|null> {
  return Object.fromEntries(nativeExportColumns.map(c=>{
    let value:unknown=point;
    for(const key of c.path) value=value!==null&&typeof value==="object"?(value as Record<string,unknown>)[key]:undefined;
    return [c.column,typeof value==="number"&&Number.isFinite(value)?value:null];
  }));
}
