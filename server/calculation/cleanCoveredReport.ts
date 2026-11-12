import {cleanCoveredSource as source} from "../../shared/cleanCoveredSource";
import {contentHash} from "./analysisManifest";
import {calculateCoveredPhysicalPaths,type PhysicalCell} from "./coveredPhysicalPaths";
export function buildCleanCoveredReport(){
 const payload={version:"epa-egrid-observed-activity-1",sourceHash:source.sha256,
   unitId:source.unitId,year:source.year,unit:"MWh",activity:source.generationMWh,geography:source.geography};
 const parentHash=contentHash(payload),intensity=source.co2Tonnes/source.generationMWh;
 const common={hash:source.sha256,publishedAt:null,availableBy:source.captureBound,
   availabilityBasis:"captured-upper-bound" as const,releaseDay:source.releaseDay,year:source.year,
   periodStart:"2023-01-01",periodEnd:"2023-12-31",geography:source.geography,kind:"observed" as const};
 const cell:PhysicalCell={issuer:"PacifiCorp conditional equity-share source case",unitId:"EPA6101/BW91",
   year:2023,geography:source.geography,scope:"1",gas:"CO2",activity:source.generationMWh,activityUnit:"MWh",
   intensity,intensityDenominator:"MWh",intensityNumerator:"tonnes-native-gas",ownership:source.ownership.fraction,
   basis:"full-unit-before-ownership",channel:"operational",parentResultHash:parentHash,
   parentActivityPointer:"/activity",parentYearPointer:"/year",parentUnitPointer:"/unit",
   activitySource:{...common,unit:"MWh",locator:source.locators.generatorMWh},
   intensitySource:{...common,kind:"derived-observation",unit:"tonnes-CO2/MWh",gas:"CO2",scope:"1",
     locator:`Derived ratio ${source.locators.unitCO2}/${source.locators.generatorMWh}; not independent intensity measurement`}};
 const assumptions={attribution:"80% equity-share only; not operational-control inventory",
   ownershipSource:source.ownership,period:"2023 calendar observed reconstruction",
   universe:"One provisional source case, not the accepted workbook population",
   selection:"One declared accounting case; not a statistical uncertainty interval",
   unitJoin:"Same ORISPL6101; publisher reports one unit and one generator; source/unit IDs explicit, no capacity allocation"};
 const covered=calculateCoveredPhysicalPaths({cutoff:source.captureBound,population:[cell.issuer],years:[2023],
   parents:[{hash:parentHash,payload}],cells:[cell],scenarios:[{id:"declared-equity-share",assumptions,cells:[cell]}]});
 return {version:"clean-covered-public-1",source,
   observed:{generationMWh:source.generationMWh,co2Tonnes:source.co2Tonnes},
   calculated:{nativeIntensityTonnesPerMWh:intensity,conditionalEquityShareCO2Tonnes:source.co2Tonnes*.8,conditionalEquityShareMWh:source.generationMWh*.8,
     unitPlantCO2Difference:source.co2Tonnes-source.plantCo2Tonnes,generatorPlantMWhDifference:source.generationMWh-source.plantGenerationMWh,
     reportedRateDifferenceKgPerMWh:intensity*1000-source.reportedRateKgPerMWh,
     facilityMinusElectricityUnitCO2Tonnes:source.comparison.facilityCo2Tonnes-source.co2Tonnes},
   covered,manufacturing:{status:"source-inputs-incomplete",actualResult:null,
     products:["solar-module-W-shipped","wind-turbine-kW-shipped","EV-shipped","battery-kWh-shipped"],
     reason:"Complete issuer/source economics and physical continuation are not qualified; no real manufacturing valuation inversion executed."},
   claims:["Observed2023 reconstruction, not a forecast or original-vintage backtest",
     "Emissions=netMWh × nativeCO2tonnes/netMWh × ownership once; ratio is accounting, not independent validation",
     "No avoided emissions, global expansion, common-equity claim, Tier2 or scientific/owner acceptance"],
   limitations:["No real qualified issuer case or accepted full-workbook population",
     "GHGRP facility and eGRID electricity-unit boundaries differ; AR4 CO2e is not native-gas mass",
     "362.1MW nameplate is not332MW net capability,266MW owned net or268MW planning nameplate",
     "Source-reported rounded output rate differs from ratio of annual mass/net generation; neither is tuned",
     "No complete global native-gas/history/member inputs for the four Stage7 measures",
     "Production/retirement/clean economic paths into a qualified future physical ensemble remain incomplete"]};
}
