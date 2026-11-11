import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import express from "express";
import ExcelJS from "exceljs";
import { createHash } from "node:crypto";
import { conditionalCompanySummary, conditionalExportCells, getConditionalCompanySummary } from "../shared/companyConditionalData";
import { CONDITIONAL_COMPANY_ROUTE, registerCompanyConditionalRoutes } from "../server/companyConditionalApi";
import { bindNestedOutput, requireOutputSemantic } from "../shared/outputFieldSemantics";
import { bindConditionalExportCells, conditionalCompanyFieldSpecs, conditionalCompanySemantics } from "../shared/companyConditionalSemantics";

test("registered shared contract has exact API leaves, fact units and lossless export bindings", async () => {
  assert.equal(conditionalCompanyFieldSpecs.length, 30);
  assert.equal(conditionalCompanySemantics.length, 63);
  assert.equal(new Set(conditionalCompanySemantics.map(s => s.id)).size, 63);
  for (const issuer of [undefined, "NEE", "FSLR", "XOM"] as const) {
    const summary = getConditionalCompanySummary(issuer);
    const bindings = bindNestedOutput("conditionalCompany", summary);
    assert.equal(bindings.length, 30);
    assert.deepEqual(bindings.map(b => b.id).sort(),
      conditionalCompanyFieldSpecs.map(([field]) => `conditionalCompany.${field}`).sort());
    const cells = conditionalExportCells(summary);
    const cellBindings = bindConditionalExportCells(summary, cells);
    assert.equal(cellBindings.length, cells.length);
    for (const company of summary.companies) for (const fact of company.facts) {
      const semantic = requireOutputSemantic(`conditionalCompany.fact.${company.issuer}.${fact.id}`);
      assert.equal(semantic.unit, fact.unit);
      assert.equal(semantic.formula, fact.formula);
      assert.ok(semantic.meaning.includes(fact.boundary));
      assert.equal(semantic.source, `${company.evidenceDocument}#${fact.sourceLocator}; public allowlist only, no runtime evidence reads`);
      assert.ok(cellBindings.some(b => b.id === semantic.id));
    }
    assert.throws(() => bindConditionalExportCells(summary, cells.slice(1)), /complete ordered/);
    const bad = structuredClone(cells);
    bad[0].jsonValue = "0";
    assert.throws(() => bindConditionalExportCells(summary, bad), /value mismatch/);
  }
  assert.throws(() => bindNestedOutput("conditionalCompany", { privateSource: 1 }), /Unmapped/);
  for (const key of ["error", "export.field", "export.jsonValue"])
    assert.ok(requireOutputSemantic(`conditionalCompany.${key}`));
  const routes = await readFile("server/routes.ts", "utf8");
  assert.match(routes, /import \{ registerCompanyConditionalRoutes \} from "\.\/companyConditionalApi"/);
  assert.equal(routes.match(/registerCompanyConditionalRoutes\(app\)/g)?.length, 1);
  const apiSource = await readFile("server/companyConditionalApi.ts", "utf8");
  assert.doesNotMatch(apiSource, /from ["'](?:node:)?fs|readFile|writeFile|app\.(?:post|put|patch|delete)\(/);
  for (const path of ["client/src/hooks/use-company-conditional-summaries.ts", "client/src/components/company-conditional-summary.tsx"]) {
    const source = await readFile(path, "utf8");
    assert.match(source, /import type .*from "@shared\/companyConditionalData"/);
    assert.doesNotMatch(source, /company-conditional-data|companyConditionalApi|ExcelJS/);
  }
});

test("new GET APIs and binary workbook remain qualified supplements outside original1001", async () => {
  const census = JSON.parse(await readFile("docs/field_semantics_census.json", "utf8"));
  const contract = census.supplementalQualifiedChanges.conditionalCompany;
  assert.equal(contract.definitions, 63);
  assert.equal(contract.typedApiFields.length, 63);
  assert.ok(contract.typedApiFields.every((f: { bound: boolean }) => f.bound));
  for (const surface of contract.successApiSurfaces) {
    const leaves = contract.typedApiFields.filter((f: { surface: string }) => f.surface === surface);
    assert.equal(leaves.length, 31, "Thirty success leaves plus explicit HTTP400 error");
    assert.deepEqual(leaves.map((f: { field: string }) => f.field).sort(),
      [...conditionalCompanyFieldSpecs.map(([field]) => field), "error"].sort());
  }
  const binaryFields = contract.typedApiFields.filter((f: { surface: string }) => f.surface === contract.workbook.surface);
  assert.deepEqual(binaryFields.map((f: { field: string }) => f.field), ["error"], "Workbook success is binary, never a fabricated JSON field");
  assert.deepEqual(contract.workbook.columns, {
    "Allowlisted field": "conditionalCompany.export.field",
    "JSON value (null means unknown)": "conditionalCompany.export.jsonValue",
  });
  assert.equal(census.originalGapReconciliation.originalPublicSlots, 1001);
  assert.equal(census.originalGapReconciliation.originalFullyBoundFields, 1000);
  assert.equal(census.originalGapReconciliation.remainingOriginalUnboundSlots, 1);
  assert.deepEqual(census.supplementalSlotAccounting.removedOriginalSlots, []);
});

test("exact supplemental semantics, public allowlist and source aggregate bindings", async () => {
  assert.deepEqual(Object.keys(conditionalCompanySummary), [
    "schemaVersion", "scope", "readOnly", "sourceApproval", "qualifiedOriginalIssuers",
    "requiredOriginalIssuers", "qualifiedOriginalPairs", "tier2Promoted", "efficacyPromoted",
    "originalClosure", "frozenProtocolsChanged", "companies",
  ]);
  assert.equal(conditionalCompanySummary.qualifiedOriginalIssuers, 0);
  assert.equal(conditionalCompanySummary.requiredOriginalIssuers, 3);
  assert.equal(conditionalCompanySummary.qualifiedOriginalPairs, 0);
  for (const field of ["tier2Promoted", "efficacyPromoted", "originalClosure", "frozenProtocolsChanged"] as const) {
    assert.equal(conditionalCompanySummary[field], false);
  }
  assert.equal(conditionalCompanySummary.readOnly, true);
  assert.ok(Object.isFrozen(conditionalCompanySummary.companies[0].facts[0]));
  assert.deepEqual(conditionalCompanySummary.companies.map(c => c.issuer), ["NEE", "FSLR", "XOM"]);
  assert.deepEqual(conditionalCompanySummary.companies.map(c => c.facts.map(f => f.id)), [
    ["fplDividend", "parentContribution", "netParentCash", "fplCashChange", "cashResidual", "beforeCommon", "withoutDmi", "unknownGrossInflow", "unknownGrossOutflow", "conditionalCases", "negativeFunding"],
    ["openingPpe", "capex", "depreciation", "closingPpe", "budgetRemainder", "cases", "positiveTerminals", "positivePlans", "zeroCreditPositive", "negativeFunding"],
    ["reportedEmissions", "deliveredUnits", "shortage", "observedExpense", "observedPrice", "observedBank", "grossIncrement", "cashIncrement", "cases"],
  ]);
  const fact = (issuer: string, id: string) => conditionalCompanySummary.companies
    .find(c => c.issuer === issuer)!.facts.find(f => f.id === id)!.value!;
  assert.equal(fact("NEE", "fplDividend") - fact("NEE", "parentContribution"), fact("NEE", "netParentCash"));
  assert.equal(361000000 - fact("NEE", "netParentCash"), fact("NEE", "fplCashChange"));
  assert.equal(fact("FSLR", "openingPpe") + fact("FSLR", "capex") - fact("FSLR", "depreciation"), fact("FSLR", "closingPpe"));
  assert.equal(fact("XOM", "reportedEmissions") - fact("XOM", "deliveredUnits"), fact("XOM", "shortage"));
  assert.equal(fact("XOM", "shortage") * 25, fact("XOM", "grossIncrement"));
  assert.equal(-fact("XOM", "grossIncrement") * 1.25, fact("XOM", "cashIncrement"));
  for (const company of conditionalCompanySummary.companies) {
    assert.deepEqual(Object.keys(company), [
      "issuer", "name", "experimentVersion", "evidenceDocument", "informationContext",
      "qualifiedOriginalIssuers", "qualifiedOriginalPairs", "facts", "sourced", "conditions",
      "missingness", "refusalReasons",
    ]);
    // Test-time reads only: production data and API contain no filesystem access.
    const source = JSON.parse(await readFile(company.evidenceDocument, "utf8"));
    assert.equal(company.experimentVersion, source.version);
    assert.ok(company.sourced.length && company.conditions.length && company.missingness.length && company.refusalReasons.length);
    for (const fact of company.facts) {
      assert.deepEqual(Object.keys(fact), ["id", "label", "value", "unit", "classification", "formula", "sourceLocator", "boundary"]);
      const keys = fact.sourceLocator.replace(/\[(\d+)\]/g, ".$1").split(".");
      const sourceValue = keys.reduce((value, key) => value[key], source);
      assert.equal(fact.value, sourceValue, `${company.issuer}.${fact.id}`);
      assert.ok(fact.formula && fact.unit && fact.boundary);
    }
  }
  const serialized = JSON.stringify(conditionalCompanySummary);
  assert.doesNotMatch(serialized, /generated-artifacts\/|private-primary\/|rawquotes|providerRows|freezePath|reportSha256/);
  assert.equal(getConditionalCompanySummary("XOM").companies[0].facts.find(f => f.id === "observedExpense")?.value, null);
});

test("GET API, JSON and XLSX are the same allowlist; unsupported inputs and writes cannot mutate", async () => {
  const app = express();
  registerCompanyConditionalRoutes(app);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}${CONDITIONAL_COMPANY_ROUTE}`;
  try {
    for (const issuer of [undefined, "NEE", "FSLR", "XOM"] as const) {
      const query = issuer ? `?issuer=${issuer}` : "";
      const expected = getConditionalCompanySummary(issuer);
      const api = await fetch(`${base}${query}`);
      assert.equal(api.status, 200);
      assert.deepEqual(await api.json(), expected);
      const json = await fetch(`${base}/export.json${query}`);
      assert.equal(json.status, 200);
      assert.match(json.headers.get("content-disposition")!, /supplemental-conditional-.*-not-qualified\.json/);
      assert.deepEqual(await json.json(), expected);
      const xlsx = await fetch(`${base}/export.xlsx${query}`);
      assert.equal(xlsx.status, 200);
      assert.match(xlsx.headers.get("content-type")!, /spreadsheetml/);
      assert.match(xlsx.headers.get("content-disposition")!, /not-qualified\.xlsx/);
      const book = new ExcelJS.Workbook();
      await book.xlsx.load(Buffer.from(await xlsx.arrayBuffer()) as never);
      assert.deepEqual(book.worksheets.map(s => s.name), ["Public allowlist"]);
      const actual: Array<{ field: string; jsonValue: string }> = [];
      book.worksheets[0].eachRow((row, number) => {
        if (number > 1) {
          assert.equal(row.getCell(1).type, ExcelJS.ValueType.String);
          assert.equal(row.getCell(2).type, ExcelJS.ValueType.String);
          actual.push({ field: String(row.getCell(1).value), jsonValue: String(row.getCell(2).value) });
        }
      });
      assert.deepEqual(actual, conditionalExportCells(expected));
    }
    for (const suffix of ["", "/export.json", "/export.xlsx"]) {
      for (const query of ["?issuer=UNKNOWN", "?issuer=NEE&issuer=XOM", "?costOfEquity=0.01", "?issuer[secret]=NEE"]) {
        assert.equal((await fetch(`${base}${suffix}${query}`)).status, 400);
      }
      for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
        assert.equal((await fetch(`${base}${suffix}`, { method })).status, 404);
      }
    }
    assert.deepEqual(await (await fetch(base)).json(), getConditionalCompanySummary());
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test("subsequent XOM primary-source notes qualify units without rewriting frozen numbers or permit gaps", async () => {
  const summary = getConditionalCompanySummary();
  const cells = conditionalExportCells(summary);
  const protectedData = {
    paths: cells.map(cell => cell.field),
    primitiveValues: cells.filter(cell => typeof JSON.parse(cell.jsonValue) !== "string"),
  };
  assert.equal(cells.length, 308, "No schema, fact or narrative-array count additions");
  assert.equal(protectedData.primitiveValues.length, 44);
  assert.equal(createHash("sha256").update(JSON.stringify(protectedData)).digest("hex"),
    "e255bcf820dea9619affb0f0ec9830fa87845d13fe5510b573464d133c983b5c",
    "Exact pre-qualification field paths and every numeric/boolean/null value remain frozen");
  const xom = summary.companies.find(company => company.issuer === "XOM")!;
  assert.deepEqual([xom.facts.length, xom.sourced.length, xom.conditions.length, xom.missingness.length, xom.refusalReasons.length],
    [9, 2, 5, 4, 2]);
  assert.equal(xom.experimentVersion, "xom-permit-geography-incremental-carbon-cash-1");
  const unitEvidence = JSON.parse(await readFile("docs/xom-source-inputs-evidence.json", "utf8"));
  const unitSource = unitEvidence.sourceRecords.find((source: { id: string }) => source.id === "UKETS-FULL-FY2024");
  assert.equal(unitSource.url, "https://www.legislation.gov.uk/uksi/2020/1265/2024-12-31/data.xml");
  assert.equal(unitSource.madeDate, "2020-11-11");
  assert.equal(unitSource.asOf, "2024-12-31");
  assert.equal(unitSource.publicationDate, null);
  for (const exact of [unitSource.url, unitSource.madeDate, unitSource.asOf])
    assert.ok(xom.sourced[0].includes(exact));
  assert.match(xom.sourced[0], /original publication date unestablished/);
  assert.match(xom.sourced[0], /Article 18\(2\)\/\(3\).*confirms 1 allowance per tonne CO2 equivalent/);
  assert.match(xom.conditions[0], /originally treated 1 UKA\/tCO2e as conditional/);
  assert.match(xom.conditions[0], /Subsequent Article 18.*confirms.*without changing that historical experiment or its numbers/);
  assert.match(xom.missingness.join(" "), /native CO2 gas-specific tonnes.*unverified/);
  assert.match(xom.missingness.join(" "), /Fawley EPR permit is not proof of UK-E-IN-11402 identity/);
  assert.match(xom.missingness.join(" "), /banks, purchases and company-paid prices are still unverified/);
  assert.doesNotMatch(xom.missingness.join(" "), /statutory unit annex/);
  const contractEvidence = JSON.parse(await readFile("docs/xom-contract-permit-evidence.json", "utf8"));
  for (const id of ["CF-FY2022-10K", "CF-FY2024-10K"]) {
    const source = contractEvidence.sourceRecords.find((record: { id: string }) => record.id === id);
    assert.ok(xom.refusalReasons[1].includes(source.url));
    assert.ok(xom.refusalReasons[1].includes(source.publicationDate));
  }
  assert.match(xom.refusalReasons[1], /FY2024.*metric CO2 capacity.*FY2022.*short tons, not retrospectively metric/);
  assert.match(xom.refusalReasons[1], /client capex, not XOM transport\/storage capex/);
  assert.match(xom.refusalReasons[1], /capacity is not minimum billing, realized capture or a fee/);
});
