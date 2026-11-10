import type { OutputFieldSemantic } from "./outputFieldSemantics";
import { nativeScenarioSemantics } from "./nativeScenarioSemantics";
const rows:[string,string,string,string][]=[
  ["promotion","Promotion decision","status","blocked-pending-calibration-and-Packages-3-4"],
  ["result.version","Native model version","identifier","EMISSIONS_ENGINE_VERSION"],
  ["result.key","Content-addressed calculation identity","hash","calculationKey(native-emissions,inventory,{scenario,endYear},engineVersion)"],
  ["result.validation","Extent of model validation","status","mechanism-tests-only; not heldout forecast validation"],
  ["result.temperature","Unsupported temperature output","unavailable","null; native emissions alone are not a climate response calculation"],
  ["result.inventoryYear","Inventory baseline year","calendar year","2024"],
  ["inputs.inventoryYear","Input inventory year","calendar year","2024"],
  ["inputs.indicatorYear","Dashboard input reference year","calendar year","2024;2023 additionally required for net capacity additions"],
  ["inputs.observationBoundary","Availability qualification","text","curated-or-approved-2024-values; no nowcast; not original-vintage evidence"],
  ["inputs.assumptions[]","Explicit diagnostic assumptions","text","resolveEmissionsInputs assumptions; fixed sales/net additions, assumed fleet turnover/load; no quantified target-count effect"],
  ["inputs.readiness.status","Evidence readiness","status","blocked-evidence-required"],
  ["inputs.readiness.mainCase","Intended future central case","scenario identifier","implemented-policies; not presently calibrated"],
  ["inputs.readiness.comparisonCase","Intended future comparison","scenario identifier","announced-commitments-delivered; not presently calibrated"],
  ["inputs.readiness.missing[]","Unmet evidence requirements","text","resolveEmissionsInputs.readiness.missing; not a probability distribution"],
  ["inputs.indicators[].key","Driver discriminator","identifier","INDICATORS.key; identifies exact indicator.<key> semantics"],
  ["inputs.indicators[].label","Driver display name","text","INDICATORS.label"],
  ["inputs.indicators[].unit","Driver-specific unit","unit identifier","INDICATORS.unit; interpret value with same-row key, not a common unit"],
  ["inputs.indicators[].year","Driver reference year","calendar year","2024"],
  ["inputs.indicators[].value","Retained driver value","same-row driver unit","retained2024 row[key]; not latest nowcast; underlying indicator.<key> definition governs numeric meaning"],
  ["inputs.indicators[].role","Mechanistic use classification","enum","capacity/sales=>mechanism-input; fossilCO2/concentration/growth=>validation; remaining drivers=>context"],
  ["inputs.indicators[].reason","Reason for inclusion or non-use","text","resolveEmissionsInputs reasons[key]; context drivers have no separately evidenced causal coefficient"],
  ["inventory.version","Inventory artifact version","identifier","inventory2024.version"],
  ["inventory.year","Inventory observation year","calendar year","2024"],
  ["inventory.status","Inventory acceptance status","status","candidate-not-promoted"],
  ["inventory.source","Published inventory reference","URL","inventory2024.source; distinct from engine source revision"],
  ["inventory.sourceRevision","Inventory builder source revision","Git revision","retained sourceRevision, not publication date"],
  ["inventory.boundary","Included/excluded emissions boundary","text","CO2-FFI, net bookkeeping LULUCF, anthropogenic CH4/N2O, UNFCCC F-gases; excludes ODS/additional natural-fire fluxes"],
  ["inventory.allocation.method","Fossil CO2 sector allocation","text","GCB fossil total / EDGAR fossil total; retain EDGAR sector proportions"],
  ["inventory.allocation.edgarCo2Mt","Pre-rescaling EDGAR fossil CO2 total","Mt CO2/year","sum native EDGAR fossil CO2 before GCB-total rescaling"],
  ["inventory.cells[].gas","Native chemical species","gas identifier","source Substance; HCFC excluded; CO2 land separately identified by sector"],
  ["inventory.cells[].sector","Inventory sector identifier","IPCC sector code","source sector; LULUCF denotes net land-use CO2"],
  ["inventory.cells[].nativeMt","Inventory cell mass","Mt of named gas/year","sum eligible source Gg/1000, with documented group allocation; signed land sinks allowed"],
  ["inventory.cells[].gwp100","Reporting conversion factor","kg CO2e/kg gas","retained AR6 GWP100 species factor; NOT a temperature-response coefficient"],
  ["inventory.cells[].origin","Cell source/processing lineage","text","retained cell.origin; does not establish historical publication availability"],
  ["inventory.reporting.gwp","Reporting convention","convention","AR6 GWP100"],
  ["inventory.reporting.totalGtCO2e","Published total reporting reference","Gt CO2e/year","56.8 reference; allocated native-cell sum is separately computed, not forced equal"],
  ["inventory.reporting.uncertainty90GtCO2e","Published total uncertainty magnitude","Gt CO2e/year","5.5 reported90% uncertainty magnitude; not simulated percentile, sector uncertainty or model interval"],
  ["result.trajectory[].year","Annual simulation coordinate","calendar year","2024..endYear inclusive"],
  ["result.trajectory[].status","Observation versus scenario flag","enum","2024=>inventory; subsequent years=>scenario-not-observation"],
  ["result.trajectory[].co2FossilMt","Non-land CO2 mass","Mt CO2/year","sum transformed CO2 cells with sectorOf(code)!=land"],
  ["result.trajectory[].co2LandUseMt","Net land-use CO2 mass","Mt CO2/year","sum transformed CO2 cells with sectorOf(code)=land; signed values permitted"],
  ["result.trajectory[].reportingGtCO2e","Annual reporting aggregate","Gt CO2e/year","sum(cell nativeMt * transformationFactor * cell.gwp100)/1000; no temperature inference"],
  ["result.trajectory[].nativeCellsMt[]","Optional transformed cell mass","Mt of cell gas/year","inventory.cells[index].nativeMt*cell transformationFactor; index order retained; absent unless includeCells=true"],
  ["result.trajectory[].evSalesShare","Conditional EV sales mix","fraction","s0/(s0+(1-s0)*exp(-evLogitGrowth*t)); exact0/1 fixed; no fitted saturation prior"],
  ["result.trajectory[].evFleetShare","Conditional passenger EV fleet share","fraction","fleet(t)=fleet(t-1)+(sales(t-1)-fleet(t-1))*fleetTurnover; initial fleet retained"],
  ["result.trajectory[].power.capacityGW","Renewable capacity stock","GW","initial capacity; subsequent capacity=previous*(1-retirement)+additions"],
  ["result.trajectory[].power.renewableTWh","Available renewable generation","TWh/year","capacityGW*8.76*capacityFactor"],
  ["result.trajectory[].power.nuclearTWh","Available nuclear generation","TWh/year","scenario.nuclearGenerationTWh or0; separate from renewable capacity"],
  ["result.trajectory[].power.totalEvTWh","Total passenger EV electricity load","TWh/year","fleet*transportActivity*fullElectricFleetDemandTWh"],
  ["result.trajectory[].power.evDemandTWh","Incremental EV demand versus baseline","TWh/year","totalEvTWh-initialFleet*fullElectricFleetDemandTWh; may be negative under explicit reversal"],
  ["result.trajectory[].power.demandTWh","Total electricity demand","TWh/year","(baselineFossil+baselineRenewables+nuclear-baselineEV)*(1+powerGrowth)^t+totalEV; negative/nonfinite rejects"],
  ["result.trajectory[].power.utilizedNuclearTWh","Nuclear used within demand","TWh/year","min(nuclearTWh,demandTWh)"],
  ["result.trajectory[].power.utilizedRenewableTWh","Renewables used after nuclear","TWh/year","min(renewableTWh,max(0,demandTWh-utilizedNuclearTWh)); excess curtailed, not negative fossil generation"],
  ["result.trajectory[].power.fossilTWh","Residual fossil generation","TWh/year","max(0,demandTWh-utilizedRenewableTWh-utilizedNuclearTWh)"],
];
for(const group of ["CH4","CO2-FFI","CO2-LULUCF","F-gases","N2O"]) rows.push([
  `inventory.reporting.components.${group}`,`${group} allocated reporting total`,"Gt CO2e/year","sum allocated group nativeMt*AR6 GWP100/1000"]);
for(const kind of ["metrics","report"]) for(const suffix of ["Url","Sha256"]) rows.push([
  `inventory.${kind}${suffix}`,`${kind} source ${suffix}`,suffix==="Url"?"URL":"SHA-256",
  suffix==="Url"?"Pinned source URL retained by inventory builder":"SHA256 of downloaded source bytes; not proof of original publication date"]);
for(const group of ["CO2","CH4","N2O","F-gases"]) {
  const file=`EDGAR_${group}_1970_2024.xlsx`;
  rows.push([`inventory.sourceHashes.${file}`,`${group} workbook content identity`,"SHA-256","SHA256 of retained source workbook bytes"]);
  rows.push([`inventory.omittedMissingCells.${file}`,`${group} omitted source cells`,"source rows","count blank/null2024 cells; omissions excluded from sum, not measured zero"]);
  if(["CH4","F-gases"].includes(group)) rows.push([`inventory.negativeSourceCells.${file}`,`${group} signed source cells`,"source rows","count negative finite2024 source values before grouping; not missing-value count"]);
}
const balance="CO2 power follows fossil generation ratio. Road technical displacement=(fleet-initialFleet)/(1-initialFleet*tailpipeReduction)*passengerFraction*tailpipeReduction. Other fossil CO2 uses activity*(1-max(positiveTechnical,policy,corporate)+max(0,-technical)). Scoped measures replace weaker reductions by min(currentFactor,referenceActivity*(1-maxEligibleMeasure+max(0,-technical))); never additive stacking. NonCO2/land persist absent explicit sector pathways/measures.";
export const nativeGasIds=["C2F6","C3F8","C4F10","C5F12","C6F14","CF4","CH4","CO2","HFC-125","HFC-134","HFC-134a","HFC-143","HFC-143a","HFC-152a","HFC-227ea","HFC-23","HFC-236fa","HFC-245fa","HFC-32","HFC-365mfc","HFC-41","HFC-43-10-mee","N2O","NF3","SF6","c-C4F8"];
export const nativeSectorIds=["power","transport","industry","buildings","agriculture","other","land"];
const calculationDependencies:Record<string,string[]>={
  "result.key":["inventory","result.scenario","endYear","EMISSIONS_ENGINE_VERSION"],
  "result.version":["EMISSIONS_ENGINE_VERSION"],
  "inputs.indicators[].value":["inputs.indicators[].key","historical[2024][key]"],
  "inputs.indicators[].role":["inputs.indicators[].key"],
  "inputs.indicators[].reason":["inputs.indicators[].key","inputs.indicators[].role"],
  "result.trajectory[].year":["inventory.year","endYear"],
  "result.trajectory[].status":["result.trajectory[].year","inventory.year"],
  "result.trajectory[].evSalesShare":["result.scenario.evSalesShare","result.scenario.evLogitGrowth","result.trajectory[].year"],
  "result.trajectory[].evFleetShare":["previousYear.evFleetShare","previousYear.evSalesShare","result.scenario.fleetTurnover"],
  "result.trajectory[].power.capacityGW":["previousYear.power.capacityGW","result.scenario.renewableRetirement","result.scenario.renewableAdditionsGW","result.scenario.renewableCapacityGW"],
  "result.trajectory[].power.renewableTWh":["result.trajectory[].power.capacityGW","result.scenario.capacityFactor"],
  "result.trajectory[].power.nuclearTWh":["result.scenario.nuclearGenerationTWh"],
  "result.trajectory[].power.totalEvTWh":["result.trajectory[].evFleetShare","result.scenario.fullElectricFleetDemandTWh","result.scenario.sectorPathways.transport","result.scenario.annualActivityGrowth","result.trajectory[].year"],
  "result.trajectory[].power.evDemandTWh":["result.trajectory[].power.totalEvTWh","result.scenario.evFleetShare","result.scenario.fullElectricFleetDemandTWh"],
  "result.trajectory[].power.demandTWh":["result.scenario.fossilGenerationTWh","result.scenario.renewableCapacityGW","result.scenario.capacityFactor","result.scenario.nuclearGenerationTWh","result.scenario.evFleetShare","result.scenario.fullElectricFleetDemandTWh","result.scenario.annualPowerDemandGrowth","result.trajectory[].power.totalEvTWh","result.trajectory[].year"],
  "result.trajectory[].power.utilizedNuclearTWh":["result.trajectory[].power.nuclearTWh","result.trajectory[].power.demandTWh"],
  "result.trajectory[].power.utilizedRenewableTWh":["result.trajectory[].power.renewableTWh","result.trajectory[].power.demandTWh","result.trajectory[].power.utilizedNuclearTWh"],
  "result.trajectory[].power.fossilTWh":["result.trajectory[].power.demandTWh","result.trajectory[].power.utilizedRenewableTWh","result.trajectory[].power.utilizedNuclearTWh"],
};
const cellDependencies=["inventory.cells[].nativeMt","inventory.cells[].sector","inventory.cells[].gas","result.scenario","result.trajectory[].power.fossilTWh","result.trajectory[].evFleetShare","result.trajectory[].year"];
for(const gas of nativeGasIds) rows.push([`result.trajectory[].nativeMt.${gas}`,`${gas} annual native mass`,`Mt ${gas}/year`,`sum transformed cells with gas=${gas}; ${balance}`]);
for(const sector of nativeSectorIds) rows.push([`result.trajectory[].sectorsGtCO2e.${sector}`,`${sector} annual reporting emissions`,"Gt CO2e/year",`sum transformed nativeMt*gwp100/1000 where sectorOf(code)=${sector}; ${balance}`]);
export const nativeOutputSemantics:OutputFieldSemantic[]=[
  ...nativeScenarioSemantics,
  ...rows.map(([path,meaning,unit,formula])=>({
    id:`native.${path}`,meaning,unit,formula,
    role:(path.startsWith("inventory.")||path.startsWith("inputs.")?"Input":path.startsWith("result.trajectory[].")?"Calculated":"Output") as OutputFieldSemantic["role"],
    dependencies:calculationDependencies[path]??(path.startsWith("inventory.")?[`inventory2024.json:${path.slice(10)}`]:
      path.startsWith("result.trajectory[].")?[...cellDependencies,...(path.includes("GtCO2e")?["inventory.cells[].gwp100"]:[])]:
      path.startsWith("inputs.indicators[].")?[`INDICATORS.${path.split(".").at(-1)}`]:
      [`${path.startsWith("inputs.")?"resolveEmissionsInputs":"projectNativeEmissions"}.${path}:declared literal`]),
    source:"Versioned candidate engine and retained IGCC/GCB/EDGAR/AR6 inventory artifacts; hashes in inventory response",
    period:"2024 inventory; annual conditional trajectory through2100 in API",geography:"Global; no regional or ensemble-member axis supplied by this endpoint",
    status:"Diagnostic, not calibrated forecast; temperature unavailable; promotion blocked",
    missingness:"Unknown scenario query rejects400; invalid engine or missing required dated inputs rejects422. No invented zero observations. Optional cell vector absent by default",
    uncertainty:"Deterministic scenario. Published inventory uncertainty is not model prediction uncertainty. No probability/member interpretation",
    scope:balance,asOfRule:"Retained artifact version identifies content; original input-publication dates remain unknown",
  })),
];
