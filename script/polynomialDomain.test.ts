import test from "node:test";
import assert from "node:assert/strict";
import {freezePolynomialDomain,certifyPolynomialDomain,evaluateDeclaredPolynomial} from "../server/calculation/polynomialDomain";
const run=(coefficients:string[],target="0")=>certifyPolynomialDomain(freezePolynomialDomain({
 coefficients,target,lower:"-2",upper:"2",absoluteParameterWidth:"0.0001",
 maxNodes:10000,parameterMeaning:"Synthetic polynomial parameter",cashModelHash:"a".repeat(64)}));
test("exact values outside numerical display range refuse rather than serialize null or zero",()=>{
 assert.throws(()=>evaluateDeclaredPolynomial(["1e400"],"1"),/display range/);
 assert.throws(()=>evaluateDeclaredPolynomial(["1e-400"],"1"),/display range/);
 assert.equal(evaluateDeclaredPolynomial(["0"],"1").approximate,0);
});
test("exact rational endpoint and tangency witnesses, full-domain no-root and nonidentification",()=>{
 const r=run(["0","0","1"]);assert.equal(r.complete,true);
 assert.deepEqual(r.roots,[{value:"0/1",derivativeZero:true}]);
 assert.equal(run(["1","0","1"]).roots.length,0);
 assert.equal(run(["1","0","1"]).complete,true);
 assert.equal(run(["0"]).partitions[0].status,"nonidentified");
});
test("two irrational roots are independently bracketed; no grid uniqueness claim",()=>{
 const r=run(["-2","0","1"]);
 assert.equal(r.complete,true);
 assert.equal(r.partitions.filter(p=>p.status==="unique-root-bracket").length,2);
 assert.equal(r.marketIdentified,false);
});
test("budget exhaustion and mutated freeze never certify away missing intervals",()=>{
 const f=freezePolynomialDomain({coefficients:["-2","0","1"],target:"0",lower:"-2",upper:"2",
 absoluteParameterWidth:"0.00001",maxNodes:1,parameterMeaning:"fixture",cashModelHash:"b".repeat(64)});
 assert.equal(certifyPolynomialDomain(f).complete,false);
 f.material.target="1";assert.throws(()=>certifyPolynomialDomain(f),/Corrupt/);
});
