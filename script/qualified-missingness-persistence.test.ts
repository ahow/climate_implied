import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync, existsSync, symlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import express from "express";
import XLSX from "xlsx";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { QualifiedMissingnessStore } from "../server/dataIngestion/qualifiedMissingnessStore";
import { registerQualifiedMissingnessApi, registerQualifiedMissingnessEngineeringTestApi } from "../server/qualifiedMissingnessApi";
import { QualifiedMissingnessReview } from "../client/src/components/qualified-missingness-review";

process.env.NODE_ENV = "development";
mkdirSync("generated-artifacts", { recursive: true });
const root = mkdtempSync(resolve("generated-artifacts/qualified-persistence-test-"));
const fixture = {
  version: "qualified-indicator-source-v1", publisher: "ISOLATED ENGINEERING FIXTURE — NOT PROVIDER EVIDENCE",
  sourceUrl: "https://example.org/engineering-only",
  sampling: { method: "paired-source-draw-linear-interior", evidence: "Engineering-only explicitly paired draws",
    sourceUrl: "https://example.org/engineering-only-method" },
  series: [{ indicatorKey: "fossilCO2GtPerYear", unit: "Gt/yr", points: [
    { year: 2019, state: "unavailable", value: null, reason: "blank" },
    { year: 2020, state: "observed", value: 0, draws: [{ id: "a", value: 0 }, { id: "b", value: 2 }] },
    { year: 2021, state: "unavailable", value: null, reason: "blank" },
    { year: 2022, state: "observed", value: 4, draws: [{ id: "b", value: 6 }, { id: "a", value: 2 }] },
    { year: 2023, state: "not-applicable", value: null, reason: "Explicit source boundary" },
    { year: 2024, state: "below-threshold", value: null, operator: "<", limit: 0.1, reason: "Explicit source bound" },
    { year: 2025, state: "unavailable", value: null, reason: "provider-null" },
  ] }],
};
const source = join(root, "engineering-source.json");
writeFileSync(source, JSON.stringify(fixture));
const directory = join(root, "store");
const store = new QualifiedMissingnessStore(directory);

test("actual file persistence/reopen/versioned review keeps four states and source-paired interior calculations", () => {
  const proposal = store.stage(source, "Engineering fixture stage");
  assert.equal(store.view().sourceId, null);
  assert.equal(store.view().proposals[0].status, "pending");
  assert.equal(store.view().proposals[0].source.series[0].points[5].state, "below-threshold");
  const approved = store.decide(proposal.id, "approve", "Engineering-only decision; no scientific acceptance");
  const reopened = new QualifiedMissingnessStore(directory, true);
  const view = reopened.view();
  assert.equal(view.revision, approved.id);
  assert.equal(view.centralModelApplied, false);
  assert.equal(view.sourceId, createHash("sha256").update(readFileSync(source)).digest("hex"));
  assert.deepEqual(view.cells.map(c => c.state), ["unavailable", "observed", "unavailable", "observed", "not-applicable", "below-threshold", "unavailable"]);
  assert.equal(view.cells[1].value, 0);
  assert.equal(view.cells[1].result.value, 0);
  assert.equal(view.cells[2].value, null);
  assert.equal(view.cells[2].result.value, 2);
  assert.deepEqual(view.cells[2].result.samples.map(s => [s.id, s.value]), [["a", 1], ["b", 4]]);
  assert.equal(view.cells[0].result.reason, "no-extrapolation");
  for (const index of [0, 4, 5, 6]) assert.equal(view.cells[index].result.value, null);
  assert.equal(reopened.view(proposal.id).sourceId, null);
  assert.equal(reopened.decide(proposal.id, "approve", "Idempotent repeat").id, approved.id);
  assert.throws(() => reopened.decide(proposal.id, "reject", "Conflict"), /Conflicting/);
});

test("new review versions supersede only after approval; rejection preserves selected calculator/export identity", () => {
  const before = store.view();
  const p2 = store.stage(source, "New explicitly versioned engineering proposal");
  store.decide(p2.id, "reject", "Not accepted");
  assert.equal(store.view().sourceId, before.sourceId);
  assert.deepEqual(store.view().cells, before.cells);
  const changed: any = structuredClone(fixture);
  changed.series[0].points[3] = { year: 2022, state: "observed", value: 8,
    draws: [{ id: "b", value: 10 }, { id: "a", value: 6 }] };
  const changedFile = join(root, "engineering-changed-source.json");
  writeFileSync(changedFile, JSON.stringify(changed));
  const p3 = store.stage(changedFile, "Another engineering version with explicitly changed source values/draws");
  store.decide(p3.id, "approve", "Accepted development version only");
  assert.notEqual(store.view().sourceId, before.sourceId);
  assert.equal(store.view().cells[2].result.value, 4);
  assert.deepEqual(store.view().cells[2].result.samples.map(s => s.value), [3, 6]);
  assert.equal(store.view(before.revision!).cells[2].result.value, 2);
  assert.equal(store.view().proposals[0].status, "superseded");
  assert.equal(store.view().proposals[1].status, "rejected");
  assert.equal(store.view().proposals[2].status, "approved-development-only");
  assert.equal(store.view(before.revision!).proposals[0].status, "approved-development-only");
  assert.throws(() => store.view("f".repeat(64)), /not found/);
});

test("actual XLSX bytes roundtrip includes review pin, source bounds/blank/zero, draws and lineage", () => {
  const view = store.view();
  const bytes = XLSX.write(store.export(view.revision!), { type: "buffer", bookType: "xlsx" });
  const workbook = XLSX.read(bytes, { type: "buffer" });
  const rows = (sheet: string) => XLSX.utils.sheet_to_json<any>(workbook.Sheets[sheet], { defval: null });
  assert.equal(rows("ReviewSelection")[0].revision, view.revision);
  assert.equal(rows("ReviewSelection")[0].centralModelApplied, false);
  assert.equal(rows("SourceCells")[1].originalValue, 0);
  assert.equal(rows("SourceCells")[2].originalValue, null);
  assert.equal(rows("SourceCells")[5].limit, 0.1);
  assert.equal(rows("SourceSamples").length, 4);
  assert.equal(rows("SampleLineage").length, 2);
  assert.equal(rows("Results")[2].value, 4);
  assert.match(rows("SampleLineage")[0].left, /draws\/0\/value/);
  assert.equal(rows("ReviewHistory").length, view.events.length);
});

test("private CLI stages/decides/reopens/exports in separate processes, with no DB imports or private history", () => {
  const cliRoot = join(root, "cli-store");
  const cli = (...args: string[]) => execFileSync(process.execPath, ["--import", "tsx", "script/qualified-missingness-review.ts", ...args], {
    encoding: "utf8", env: { ...process.env, NODE_ENV: "development", DATABASE_URL: "postgres://must-not-connect.invalid/disallowed" },
  });
  const staged = JSON.parse(cli("stage", cliRoot, source, "Engineering-only CLI roundtrip"));
  cli("approve", cliRoot, staged.id, "Engineering-only review");
  const view = JSON.parse(cli("view", cliRoot));
  const file = join(root, "engineering-roundtrip.xlsx");
  cli("export", cliRoot, file, view.revision);
  const workbook = XLSX.readFile(file);
  assert.equal(XLSX.utils.sheet_to_json<any>(workbook.Sheets.ReviewSelection)[0].revision, view.revision);
});

test("missing method/draws/unpaired samples and provider null never acquire invented uncertainty", () => {
  for (const kind of ["method", "draws", "unpaired"]) {
    const altered: any = structuredClone(fixture);
    if (kind === "method") delete altered.sampling;
    if (kind === "draws") delete altered.series[0].points[1].draws;
    if (kind === "unpaired") altered.series[0].points[3].draws[0].id = "not-a-pair";
    const file = join(root, `${kind}.json`); writeFileSync(file, JSON.stringify(altered));
    const isolated = new QualifiedMissingnessStore(join(root, kind));
    const staged = isolated.stage(file, "Engineering refusal fixture");
    isolated.decide(staged.id, "approve", "Engineering-only source review");
    assert.equal(isolated.view().cells[2].result.value, null);
    assert.equal(isolated.view().cells[2].result.samples.length, 0);
  }
});

test("underflow, tampering, incomplete chains, symlinks, concurrent lock and production operations fail explicitly", () => {
  const badSource = join(root, "underflow.json");
  writeFileSync(badSource, JSON.stringify(fixture).replace('"value":4', '"value":1e-400'));
  assert.throws(() => store.stage(badSource, "Underflow refusal"), /underflow/);
  const tiny: any = structuredClone(fixture);
  tiny.series[0].points[1].draws = [{ id: "a", value: 0 }, { id: "b", value: 0 }];
  tiny.series[0].points[3] = { year: 2022, state: "observed", value: Number.MIN_VALUE,
    draws: [{ id: "a", value: Number.MIN_VALUE }, { id: "b", value: Number.MIN_VALUE }] };
  writeFileSync(badSource, JSON.stringify(tiny));
  const revisionBeforeUnderflow = store.view().revision;
  assert.throws(() => store.stage(badSource, "Arithmetic-underflow refusal"), /underflow/);
  assert.equal(store.view().revision, revisionBeforeUnderflow);
  mkdirSync(join(directory, ".writer"));
  assert.throws(() => store.stage(source, "Concurrent writer"), /EEXIST/);
  rmSync(join(directory, ".writer"), { recursive: true });
  const corrupt = new QualifiedMissingnessStore(join(root, "corrupt"));
  const staged = corrupt.stage(source, "Engineering tamper test");
  writeFileSync(join(corrupt.root, `source-${staged.sourceId}.json`), "{}");
  assert.throws(() => corrupt.history(), /Corrupt/);
  const broken = new QualifiedMissingnessStore(join(root, "broken"));
  writeFileSync(join(broken.root, "event-0000000002.json"), readFileSync(join(directory, "event-0000000001.json")));
  assert.throws(() => broken.history(), /Broken/);
  symlinkSync(directory, join(root, "symlink"));
  assert.throws(() => new QualifiedMissingnessStore(join(root, "symlink")), /real directories/);
  process.env.NODE_ENV = "production";
  try {
    assert.throws(() => store.view(), /development/);
    assert.throws(() => store.stage(source, "Must not persist"), /development/);
    assert.throws(() => new QualifiedMissingnessStore(join(root, "prod")), /development/);
  } finally { process.env.NODE_ENV = "development"; }
  assert.equal(existsSync(join(root, "prod")), false);
});

test("isolated engineering-test API returns actual reviewed calculator and pinned XLSX; no GET-side persistence or POST route", async () => {
  const app = express();
  registerQualifiedMissingnessEngineeringTestApi(app, {
    root: directory, sourceHashes: Array.from(new Set(store.history().map(event => event.sourceId))),
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}/api/development/qualified-missingness`;
  const before = readdirSync(directory);
  try {
    const response = await fetch(base); assert.equal(response.status, 200);
    const view: any = await response.json();
    assert.equal(view.cells[2].result.value, 4);
    assert.equal(view.cells[1].value, 0);
    const exported = await fetch(`${base}/export?revision=${view.revision}`);
    assert.equal(exported.status, 200);
    const workbook = XLSX.read(Buffer.from(await exported.arrayBuffer()), { type: "buffer" });
    assert.equal(XLSX.utils.sheet_to_json<any>(workbook.Sheets.ReviewSelection)[0].revision, view.revision);
    assert.equal((await fetch(`${base}?revision=bad`)).status, 400);
    assert.equal((await fetch(base, { method: "POST" })).status, 404);
    assert.deepEqual(readdirSync(directory), before);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
  const missing = join(root, "not-provisioned");
  assert.throws(() => new QualifiedMissingnessStore(missing, true), /not provisioned/);
  assert.equal(existsSync(missing), false);
});

test("actual app registration denies private unreviewed and reviewed source/export despite DEV, env, forged headers or self-asserted rights", async () => {
  const privateRoot = join(root, "unauthorized-private-fixture");
  const isolated = new QualifiedMissingnessStore(privateRoot);
  const proposal = isolated.stage(source, "Private unreviewed engineering-only negative fixture; no public rights grant");
  process.env.QUALIFIED_MISSINGNESS_ARCHIVE = privateRoot;
  const app = express();
  registerQualifiedMissingnessApi(app);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/development/qualified-missingness`;
  const assertDenied = async () => {
    for (const suffix of ["", "/export", "?licence=public&review=approved&role=operator", `?revision=${proposal.id}`]) {
      const response = await fetch(`${base}${suffix}`, { headers: {
        authorization: "Bearer invented-not-a-principal", "x-role": "operator", "x-forwarded-for": "127.0.0.1",
      } });
      assert.equal(response.status, 403);
      assert.match(response.headers.get("content-type")!, /application\/json/);
      const body = await response.text();
      assert.match(body, /operator-cli-required/);
      assert.match(body, /no-existing-http-principal-or-role/);
      assert.doesNotMatch(body, /sourceId|publisher|points|draws|proposals|sourceUrl/);
      assert.ok(!body.includes(proposal.sourceId));
      assert.ok(!body.includes(privateRoot));
    }
  };
  try {
    await assertDenied();
    isolated.decide(proposal.id, "approve", "Self-asserted licence/review is not public disclosure authority");
    await assertDenied();
    process.env.NODE_ENV = "production";
    await assertDenied();
  } finally {
    process.env.NODE_ENV = "development";
    delete process.env.QUALIFIED_MISSINGNESS_ARCHIVE;
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test("engineering injection cannot disclose unallowlisted pending or reviewed sources and cannot run outside isolated tests", async () => {
  const engineeringRoot = join(root, "unallowlisted-source");
  const isolated = new QualifiedMissingnessStore(engineeringRoot);
  const changed: any = structuredClone(fixture);
  changed.publisher = "Self-asserted public licence and operator review — NOT AN AUTHORIZATION";
  const file = join(root, "unallowlisted-source.json"); writeFileSync(file, JSON.stringify(changed));
  const proposal = isolated.stage(file, "No trusted hash in isolated test allowlist");
  const app = express();
  const allowedHash = createHash("sha256").update(readFileSync(source)).digest("hex");
  registerQualifiedMissingnessEngineeringTestApi(app, { root: engineeringRoot, sourceHashes: [allowedHash] });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/development/qualified-missingness`;
  try {
    for (const reviewed of [false, true]) {
      if (reviewed) isolated.decide(proposal.id, "approve", "Self-declared engineering approval is not disclosure");
      for (const suffix of ["", "/export"]) {
        const response = await fetch(`${base}${suffix}`);
        assert.equal(response.status, 403);
        const body = await response.text();
        assert.match(body, /engineering-source-not-in-trusted-test-allowlist/);
        assert.ok(!body.includes(changed.publisher));
        assert.ok(!body.includes(proposal.sourceId));
      }
    }
    const saved = process.env.NODE_TEST_CONTEXT;
    delete process.env.NODE_TEST_CONTEXT;
    try {
      assert.throws(() => registerQualifiedMissingnessEngineeringTestApi(express(), {
        root: directory, sourceHashes: [allowedHash],
      }), /isolated node:test only/);
      assert.equal((await fetch(base)).status, 403);
    } finally { process.env.NODE_TEST_CONTEXT = saved; }
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test("actual component renders zero, withheld qualifier, bound and explicit development-only labels", () => {
  const client = new QueryClient();
  client.setQueryData(["/api/development/qualified-missingness"], store.view());
  const markup = renderToStaticMarkup(React.createElement(QueryClientProvider, { client },
    React.createElement(QualifiedMissingnessReview)));
  assert.match(markup, /DEVELOPMENT ONLY/);
  assert.match(markup, /not-applicable/);
  assert.match(markup, /below-threshold/);
  assert.match(markup, /bound only/);
  assert.match(markup, /0 \(observed\)/);
  assert.match(markup, /Withheld/);
  assert.match(markup, /source-paired draws/);
  assert.match(markup, new RegExp(`export\\?revision=${store.view().revision}`));
});

test("component shows explicit operator gap and hides any stale cached private data after denial", () => {
  const client = new QueryClient();
  const key = ["/api/development/qualified-missingness"];
  client.setQueryData(key, store.view());
  client.getQueryCache().find({ queryKey: key })!.setState({
    status: "error", error: new Error("operator-cli-required: no-existing-http-principal-or-role"),
  });
  const markup = renderToStaticMarkup(React.createElement(QueryClientProvider, { client },
    React.createElement(QualifiedMissingnessReview)));
  assert.match(markup, /operator-cli-required: no-existing-http-principal-or-role/);
  assert.doesNotMatch(markup, /fossilCO2GtPerYear|engineering-only-method|Download selected review XLSX/);
});
