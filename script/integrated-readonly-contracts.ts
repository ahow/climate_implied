import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { z } from "zod";
import ts from "typescript";
import { retainedPairedCatalogSchema, retainedPairedReportSchema } from "../client/src/components/retained-paired-research-contract";

const paths = [
  "shared/headlineDrilldown.ts", "server/calculation/headlineDrilldown.ts", "server/headlineDrilldownApi.ts",
  "client/src/components/headline-drilldown.tsx", "shared/serverDownloadRegistry.ts",
  "client/src/components/retained-paired-research-contract.ts",
  "client/src/components/retained-paired-research-reader.ts",
  "client/src/components/retained-paired-research.tsx",
  "server/retainedPairedResearchApi.ts", "server/retainedPairedResearchStore.ts",
  "server/retainedPairedResearchCatalog.ts", "server/retainedPairedResearchProjection.ts",
] as const;
const sha = (text: string) => createHash("sha256").update(text).digest("hex");

function schemaFields(schema: z.ZodTypeAny, prefix = ""): { path: string; schema: string }[] {
  if (schema instanceof z.ZodNullable || schema instanceof z.ZodOptional)
    return schemaFields(schema.unwrap(), prefix).map(field => ({ ...field, schema: `${field.schema}${schema instanceof z.ZodNullable ? " | null" : " | undefined"}` }));
  if (schema instanceof z.ZodArray) return schemaFields(schema.element, `${prefix}[]`);
  if (schema instanceof z.ZodTuple) return schema.items.flatMap((item: z.ZodTypeAny, index: number) =>
    schemaFields(item, `${prefix}[${index}]`));
  if (schema instanceof z.ZodObject) return Object.entries(schema.shape).flatMap(([name, value]) =>
    schemaFields(value as z.ZodTypeAny, prefix ? `${prefix}.${name}` : name));
  if (schema instanceof z.ZodDiscriminatedUnion) return [...schema.options.values()].flatMap(option =>
    schemaFields(option, prefix).map(field => ({ ...field, path: `${field.path} [${option.shape.status.value}]` })));
  return [{ path: prefix, schema: schema instanceof z.ZodLiteral ? JSON.stringify(schema.value) :
    schema instanceof z.ZodEnum ? schema.options.join(" | ") :
    schema instanceof z.ZodString ? "string" : schema instanceof z.ZodNumber ? "finite number" :
    schema instanceof z.ZodBoolean ? "boolean" : schema._def.typeName }];
}

/** Supplemental source inventory, NOT original frozen field-slot closure. */
export function integratedReadOnlySurfaceContracts() {
  const sources = Object.fromEntries(paths.map(path => [path, sha(readFileSync(path, "utf8"))]));
  const headline = ts.createSourceFile(paths[0], readFileSync(paths[0], "utf8"), ts.ScriptTarget.Latest, true);
  const declared = (name: string) => {
    const node = headline.statements.find((statement): statement is ts.InterfaceDeclaration =>
      ts.isInterfaceDeclaration(statement) && statement.name.text === name);
    if (!node) throw new Error(`Retained headline public interface ${name} missing`);
    return node.members.filter(ts.isPropertySignature).map(member => ({
      path: member.name.getText(headline), type: member.type?.getText(headline) ?? "unresolved",
      line: headline.getLineAndCharacterOfPosition(member.getStart(headline)).line + 1,
    }));
  };
  const nestedFields = (name: string, field: string) => {
    const declaration = headline.statements.find((statement): statement is ts.InterfaceDeclaration =>
      ts.isInterfaceDeclaration(statement) && statement.name.text === name);
    const member = declaration?.members.find((node): node is ts.PropertySignature =>
      ts.isPropertySignature(node) && node.name.getText(headline) === field);
    if (!member?.type || !ts.isTypeLiteralNode(member.type))
      throw new Error(`Exact source-declared object ${name}.${field} missing`);
    return member.type.members.filter(ts.isPropertySignature).map(node => node.name.getText(headline));
  };
  const api = readFileSync("server/headlineDrilldownApi.ts", "utf8");
  const pairApi = readFileSync("server/retainedPairedResearchApi.ts", "utf8");
  const index = readFileSync("server/index.ts", "utf8");
  const registry = readFileSync("shared/serverDownloadRegistry.ts", "utf8");
  const urls = ["contributions", "sensitivities"].flatMap(mode =>
    ["/api/headline-drilldown/" + mode, ...["json", "xlsx"].map(format =>
      `/api/headline-drilldown/${mode}/export.${format}`)]);
  if (!api.includes('deriveHeadlineDrilldown(loaded, req.query, mode, loadMaterial)') ||
    !api.includes("X-Headline-Derivation") || !api.includes("X-Headline-Parent") ||
    !api.includes("XLSX.utils.json_to_sheet(data.rows)") ||
    !urls.every(url => url.endsWith("/contributions") || url.endsWith("/sensitivities")
      ? api.includes('app.get(`/api/headline-drilldown/${mode}`') : registry.includes(url)) ||
    !index.includes("registerHeadlineDrilldownApi(app)") ||
    !pairApi.includes('app.get("/api/research/paired-research/catalog"') ||
    !pairApi.includes('app.get("/api/research/paired-research"') ||
    !pairApi.includes("retainedPairedIdentity(report, identity.disclosureHash)") ||
    !index.includes("registerRetainedPairedResearchRoutes(app)"))
    throw new Error("Reviewed integrated read-only handler, archive derivation, registry or route wiring changed");
  const catalog = schemaFields(retainedPairedCatalogSchema);
  const report = schemaFields(retainedPairedReportSchema);
  if (new Set(catalog.map(field => field.path)).size !== catalog.length ||
      new Set(report.map(field => field.path)).size !== report.length)
    throw new Error("Retained paired public schema paths ambiguous");
  return {
    boundary: "Additional actual source-declared fields and strict Zod public projection paths, not original frozen cohort closure or approval. Dynamic filter values and private pipeline inputs are not inferred.",
    sourceSha256: sources,
    headline: { apiPaths: urls, interface: declared("HeadlineDrilldown"), selection: declared("HeadlineDrilldownSelection"),
      row: declared("HeadlineDrilldownRow"), derivation: nestedFields("HeadlineDrilldown", "derivation"),
      sheetNames: ["Drilldown", "Headline contract"],
      interpretation: "Signed gas-specific native Mt/year and derived GtCO2e/year are distinct; nullable reverted-driver native value is not zero. Exact selected producer identity, mode, filters, member, seed, rows and derivation hash must agree. Global-only; no invented regional allocation or additive sensitivity claim." },
    retainedPaired: { apiPaths: ["/api/research/paired-research/catalog", "/api/research/paired-research"],
      catalogFields: catalog, reportFields: report,
      interpretation: "Strict catalog requires eight SHA256 pins for each listed report; report read verifies exact headers and report/origin/source/code hashes. Null dates and unavailable section reasons survive; finite zero is data. No auto-selection, scientific acceptance, investment evidence, authenticity claim, private rows or new export." },
  };
}
