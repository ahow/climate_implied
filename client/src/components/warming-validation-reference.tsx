import React from "react";
import { WARMING_VALIDATION_REFERENCE as reference } from "@shared/warmingValidationReference";
import { requireWarmingReferenceSemantic, warmingReferenceExportDocument } from "@shared/warmingValidationReferenceSemantics";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/** Methodology reference card; never receives model
 * temperature props or feeds an engine/offset. Metadata sits beside its values. */
export function WarmingValidationReference() {
  const headline = requireWarmingReferenceSemantic("warmingReference.headline2025.valueC");
  const decade = requireWarmingReferenceSemantic("warmingReference.decade.meanC");
  const lower = requireWarmingReferenceSemantic("warmingReference.decade.p05C");
  const upper = requireWarmingReferenceSemantic("warmingReference.decade.p95C");
  const inventory = requireWarmingReferenceSemantic("warmingReference.inventory.year");
  const download = `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(warmingReferenceExportDocument(), null, 2))}`;
  return (
    <Card className="p-4 sm:p-6 space-y-4" data-testid="warming-validation-reference">
      <h3 className="text-sm font-semibold">Dated human-warming validation reference · not a model result</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <section data-field-id="warmingReference.headline2025.valueC" data-warming-reference-field={headline.id} title={`${headline.formula}; ${headline.unit}`}>
          <p className="text-sm font-medium">{reference.headline2025.year} SR1.5 headline: {reference.headline2025.valueC.toFixed(2)} °C</p>
          <p className="text-xs text-muted-foreground">{reference.headline2025.definition}.</p>
          <p className="text-xs text-muted-foreground">{reference.observable}; anomaly from {reference.temperatureBaseline}.</p>
        </section>
        <section data-field-id="warmingReference.decade.meanC" data-warming-reference-field={decade.id} title={`${decade.formula}; ${decade.unit}`}>
          <p className="text-sm font-medium">{reference.decade.firstYear}–{reference.decade.lastYear} mean: {reference.decade.meanC.toFixed(2)} [<span data-field-id="warmingReference.decade.p05C" data-warming-reference-field={lower.id} title={`${lower.formula}; ${lower.unit}`}>{reference.decade.p05C.toFixed(1)}</span>–<span data-field-id="warmingReference.decade.p95C" data-warming-reference-field={upper.id} title={`${upper.formula}; ${upper.unit}`}>{reference.decade.p95C.toFixed(1)}</span>] °C</p>
          <p className="text-xs text-muted-foreground">{reference.decade.rangeDefinition}.</p>
        </section>
      </div>
      <p className="text-xs text-muted-foreground" data-field-id="warmingReference.inventory.year" data-warming-reference-field={inventory.id} title={`${inventory.formula}; ${inventory.unit}`}>
        Separate inventory year: {reference.inventory.year}. {reference.inventory.basis}; {reference.inventory.status}.
      </p>
      <p className="text-xs text-muted-foreground">{reference.qualification}</p>
      <p className="text-xs text-muted-foreground">
        <a href={reference.source.publicationUrl} target="_blank" rel="noopener noreferrer" className="underline">Forster et al. (2026), section 8</a>
        {" · "}{reference.source.assessment} · {reference.source.licence}. Source metadata created {reference.source.metadataDateCreated}; publication day unknown, not inferred.
      </p>
      <details className="text-xs text-muted-foreground">
        <summary>Exact source and temporal definition</summary>
        <p className="break-all"><a href={reference.source.url} className="underline" target="_blank" rel="noopener noreferrer">Pinned headline source</a>: revision {reference.source.revision}; SHA256 {reference.source.sha256}.</p>
        <p><a href={reference.source.temporalDefinitionUrl} className="underline" target="_blank" rel="noopener noreferrer">Method supplement</a>: {reference.source.temporalDefinitionLocator}.</p>
        <p>{reference.source.credit}</p>
      </details>
      <Button variant="outline" size="sm" asChild>
        <a href={download} download="igcc-2025-validation-reference-not-model-acceptance.json">Export reference and exact field semantics</a>
      </Button>
    </Card>
  );
}
