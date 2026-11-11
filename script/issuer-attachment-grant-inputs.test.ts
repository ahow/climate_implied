import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { attachmentInventory, nativeAttachmentReader, workbookMeasurements, reconcileFslrAnnualInterimGrants,
  reconcileXplr2025Funding } from "../server/calculation/issuerAttachmentGrantInputs";
test("synthetic accession inventory preserves filename/content distinction and fails closed", () => {
  const d = { directory: { name: "/Archives/edgar/data/1/abc", item: [{ name: "Financial_Report.xlsx" }, { name: "ex101.htm" }] } };
  const r = attachmentInventory(d, "1", "abc");
  assert.equal(r.listedFiles, 2); assert.deepEqual(r.spreadsheetNames, ["Financial_Report.xlsx"]);
  assert.equal(r.filenamesAloneCertifyIrrModel, false);
  assert.throws(() => attachmentInventory(d, "2", "abc"));
  assert.throws(() => attachmentInventory({ directory: { ...d.directory, item: [{ name: "../secret.xlsx" }] } }, "1", "abc"));
});
test("synthetic workbook IRRtext is not an IRRformula or actual model certification", () => {
  const b = new ExcelJS.Workbook(), s = b.addWorksheet("Financial notes");
  s.getCell("A1").value = "Internal Rate of Return: see attached model";
  assert.equal(workbookMeasurements(b).xirrFormulaCells, 0);
  assert.deepEqual(workbookMeasurements(b).namedIrrModelSheets, []);
  s.getCell("A2").value = { formula: "XIRR(B1:B3,C1:C3)", result: .1 };
  assert.equal(workbookMeasurements(b).xirrFormulaCells, 1);
  assert.equal(workbookMeasurements(b).noXirrFormulaAloneProvesAbsence, false);
});
test("synthetic native reader enforces entity/USD/period/dimension, not value matching", () => {
  const xml = `<xbrli:context id="a"><xbrli:identifier>0000000001</xbrli:identifier><xbrli:startDate>2025-01-01</xbrli:startDate><xbrli:endDate>2025-12-31</xbrli:endDate></xbrli:context><ix:nonFraction name="t:Cash" unitRef="usd" contextRef="a" scale="3" sign="-">12</ix:nonFraction>`;
  assert.equal(nativeAttachmentReader(xml, "0000000001")("t:Cash", "2025-12-31", "2025-01-01"), -12000);
  for (const [body, entity, end] of [[xml, "0000000002", "2025-12-31"],
    [xml.replace('unitRef="usd"', 'unitRef="eur"'), "0000000001", "2025-12-31"],
    [xml, "0000000001", "2026-06-30"]])
    assert.throws(() => nativeAttachmentReader(body, entity)("t:Cash", end, "2025-01-01"));
});
test("synthetic annual/interim cash bridge keeps subsequent India receipt and programme scope unknown", () => {
  const r = reconcileFslrAnnualInterimGrants({
    annual2025: { cfo: 1000, incomeGrants: [500, 20, 10, 0], grantCfoEffect: -100,
      openingGrantReceivables: 300, closingGrantReceivables: 400, specific45xNarrative: 500, specific45xNarrativeRoundingBound: 50 },
    interim2026h1: { cfo: -100, incomeGrants: [200, 1, 2], grantCfoEffect: -120, closingGrantReceivables: 550,
      treasury2024OriginRefund: 10, indiaFirstReceiptMonth: "2026-07", indiaFirstReceiptCashUsd: null,
      indiaReceiptBelongsToSixMonthCashPeriod: false, recognitionFramework: "synthetic" }
  }, { annual2025: 400, interim2026h1: 50 });
  assert.equal(r.annual2025.cfoLessSelectedCreditCashUsd, 600);
  assert.equal(r.annual2025.grantRecognitionCfoLessSelectedCashResidualUsd, 30);
  assert.equal(r.interim2026h1.grantRecognitionCfoLessSelectedCashResidualUsd, 33);
  assert.equal(r.interim2026h1.bookCfoResidualUsd, 30);
  assert.equal(r.interim2026h1.indiaFirstReceiptCashUsd, null);
  assert.equal(r.interim2026h1.firstIndiaReceiptIsAfterJune30CashPeriod, true);
  assert.equal(r.amountAppliedToOriginal32CashRowsUsd, 0);
  assert.equal(r.annual2025.coarse45xScopeDifferenceIsCertifiedOtherGrants, false);
});
test("synthetic actual buyout funding closes without treating CFOas LLCAvailableCash", () => {
  const s = { cfo: 20, investingCash: 10, financingCash: -30, commonProceeds: 0, debtProceeds: 100, debtRepayments: 50,
    debtFees: 5, partnerContributions: 10, partnerDistributions: 15, classBPayments: 10, classBBuyouts: 50,
    classBProceeds: 0, dmiSaleProceeds: 0, dmiProceeds: 10, dmiPayments: 5, dmiBuyouts: 10, otherFinancing: -5, cashChange: 0,
    neeCategoryDistributions: 7, neeCategoryContributionsEquityMovement: 3, renewablesIiBuyoutCashNarrative: 30,
    pipelinesBuyoutCashNarrative: 20, renewablesIiRemainingExternalUnitsBoughtMonth: "synthetic" };
  const r = reconcileXplr2025Funding(s);
  assert.equal(r.financingResidualUsd, 0); assert.equal(r.cashResidualUsd, 0);
  assert.equal(r.actualLlcAvailableCashUsd, null); assert.equal(r.actualProjectIrr, null);
  assert.equal(r.neeCommonCashAddedUsd, 0);
  assert.equal(r.oldConditionalClaim965And1882Preserved, true);
  assert.throws(() => reconcileXplr2025Funding({ ...s, debtProceeds: 101 }));
});
