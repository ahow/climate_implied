import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import * as XLSX from "xlsx";
import {cleanCoveredSource as source} from "../shared/cleanCoveredSource";
import {buildCleanCoveredReport} from "../server/calculation/cleanCoveredReport";
const bytes=readFileSync("generated-artifacts/clean-covered/egrid2023_metric_rev2.xlsx");
assert.equal(createHash("sha256").update(bytes).digest("hex"),source.sha256);
const w=XLSX.read(bytes,{type:"buffer"});
function value(locator:string){const [sheet,cell]=locator.split("!");return w.Sheets[sheet][cell].v;}
assert.equal(value(source.locators.unitCO2),source.co2Tonnes);
assert.equal(value(source.locators.generatorMWh),source.generationMWh);
assert.equal(value(source.locators.plantCO2),source.plantCo2Tonnes);
assert.equal(value(source.locators.plantMWh),source.plantGenerationMWh);
assert.equal(value(source.locators.plantUnitCount),1);
assert.equal(value(source.locators.plantGeneratorCount),1);
assert.equal(w.Sheets.UNT23.E26188.v,source.orispl);
assert.equal(w.Sheets.GEN23.E26603.v,source.orispl);
assert.equal(w.Sheets.UNT23.F26188.v,source.unitId);
assert.equal(w.Sheets.GEN23.F26603.v,source.generatorId);
const report=buildCleanCoveredReport();
assert.equal(report.covered.scenarios[0].status,"conditional");
assert.equal(report.calculated.conditionalEquityShareCO2Tonnes,source.co2Tonnes*source.ownership.fraction);
assert.equal(report.calculated.unitPlantCO2Difference,0);
assert.equal(report.calculated.generatorPlantMWhDifference,0);
assert.equal(report.manufacturing.actualResult,null);
console.log(JSON.stringify({privateSourceAssertions:16,sourceHash:source.sha256,year:2023,
 co2Tonnes:source.co2Tonnes,netMWh:source.generationMWh,
 derivedTonnesPerMWh:report.calculated.nativeIntensityTonnesPerMWh,
 conditionalShareTonnes:report.calculated.conditionalEquityShareCO2Tonnes,
 boundary:"Source arithmetic only, not original-vintage authentication, forecast efficacy or issuer/owner acceptance"}));
