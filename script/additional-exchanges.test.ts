import test from "node:test";
import assert from "node:assert/strict";
import { assessMapping } from "../server/financialData/provider";
test("additional audited venues produce review candidates, not approvals",()=>{
  for (const [exchange,symbol,ticker,exchCode] of [
    ["ASX","QAN.AX","QAN","AT"],["JPX","3659.T","3659","JT"],
    ["SHH","600009.SS","600009","C1"],["SHZ","300413.SZ","300413","C2"],
  ]) {
    const profile={isin:"fixture",symbol,exchange,currency:"USD"};
    const figi={figi:"listing",shareClassFIGI:"class",marketSector:"Equity",ticker,exchCode};
    const result=assessMapping("fixture",[profile],[figi]);
    assert.equal(result.candidates.length,1);
    assert.equal(result.accepted,false);
    assert.equal(assessMapping("fixture",[profile],[{...figi,exchCode:"LN"}]).candidates.length,0);
    assert.equal(assessMapping("fixture",[{...profile,isAdr:true}],[figi]).candidates.length,0);
  }
});
test("Shanghai and Shenzhen are not interchangeable",()=>{
  const p={isin:"fixture",symbol:"600009.SS",exchange:"SHH",currency:"CNY"};
  assert.equal(assessMapping("fixture",[p],[{figi:"x",shareClassFIGI:"c",
    marketSector:"Equity",ticker:"600009",exchCode:"C2"}]).candidates.length,0);
});
