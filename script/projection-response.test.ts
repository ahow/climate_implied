import test from "node:test";
import assert from "node:assert/strict";
import {projectionResponseSchema} from "../shared/projectionResponse";
import {legacyContext} from "../shared/calculationContract";
import {getCurrentIndicators,calculateEmissionsTrajectory,calculateTemperatureDistribution,getTemperatureStats} from "../server/calculation/forwardProjection";
import {historicalTrajectoryMetrics} from "../server/calculation/historicalMetrics";
test("actual cached projection shape validates without changing values; absent/unknown/nonfinite fields reject",()=>{
 const indicators=getCurrentIndicators(),trajectory=calculateEmissionsTrajectory(indicators,2024,2100,10);
 const pdf=calculateTemperatureDistribution(trajectory,10),stats=getTemperatureStats(pdf,trajectory);
 const metrics=historicalTrajectoryMetrics(trajectory);
 const value={calculation:{...legacyContext(2024,"all"),inputHash:"fixture",inputRevision:"fixture",runs:10,
   seeds:{emissions:2024*12345,temperaturePdf:42*12345,temperatureSummary:99*12345},warnings:[]},
   emissionsTrajectory:trajectory,temperatureDistribution:{median:stats.median,mean:stats.mean,p10:stats.p10,p90:stats.p90,pdf},
   indicators,metrics:{...metrics,temperatureRise:stats.median,emissionsStart:trajectory[0].p50,emissionsDecadeLater:trajectory[10].p50,emissions2100:trajectory.at(-1)!.p50}};
 assert.deepEqual(projectionResponseSchema.parse(value),value);
 assert.throws(()=>projectionResponseSchema.parse({...value,indicators:{}}));
 assert.throws(()=>projectionResponseSchema.parse({...value,extra:1}));
 assert.throws(()=>projectionResponseSchema.parse({...value,metrics:{...value.metrics,temperatureRise:Infinity}}));
 assert.throws(()=>projectionResponseSchema.parse({...value,calculation:{...value.calculation,inputRevision:undefined}}));
});
