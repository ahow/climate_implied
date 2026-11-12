import { z } from "zod";
import { getIndicatorDef, type IndicatorKey } from "../dataIngestion/indicatorRegistry";

// Hashes identify the UTF-8 markdown returned by webFetch, NOT original release
// bytes, vintage identifiers, publication dates, or a licence to redistribute.
export const indicatorSourceDocuments = [
  { id: "noaa-trends", url: "https://gml.noaa.gov/ccgg/trends/", sha256: "1f540eb7f1a74a7054b80648e5f81dc87f91d7ba89adb601d24e7f305581b182", bytes: 5766 },
  { id: "noaa-growth-method", url: "https://gml.noaa.gov/ccgg/trends/gr.html", sha256: "90f8207ae34039b81507fec78469be1e2443047f7e222a8bfbaf655ba98f4e74", bytes: 6052 },
  { id: "noaa-rights", url: "https://gml.noaa.gov/about/disclaimer.html", sha256: "3b415541d3dca70d2850b82316c7aee7e135bba3087c8baaf0d596dcc8e97492", bytes: 5831 },
  { id: "noaa-annual-file", url: "https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_annmean_mlo.txt", sha256: "42acfe30569dd7134bda3ac3eb74e347a55b5133c3926557410e1b4ec4423f7f", bytes: 3696 },
  { id: "noaa-growth-file", url: "https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_gr_mlo.txt", sha256: "eca1f3f7159270cf4d11cf3d834315e1e25002bac56e21026f8fb9cdee128939", bytes: 4211 },
  { id: "pew-release", url: "https://www.pewresearch.org/global/2021/09/14/in-response-to-climate-change-citizens-in-advanced-economies-are-willing-to-alter-how-they-live-and-work/", sha256: "4c009a85709a8f5f71ba862df7c0f06f72ba9640ad69a79e4220967f8fa9d38c", bytes: 48063 },
  { id: "pew-method", url: "https://www.pewresearch.org/global/2021/09/14/climate-change-spring-2021-methodology/", sha256: "536c1a5c571b5356e719d2cceb5c11a44ab03ffc2e0cfaed72671860bd07a0ad", bytes: 15965 },
  { id: "pew-rights", url: "https://www.pewresearch.org/about/terms-and-conditions", sha256: "dc1f224879374c0799cf1a2376416054a0a9f23a231755ace3f5933c207509a1", bytes: 18255 },
] as const;

const fieldSchema = z.object({
  status: z.enum(["source-product-qualified", "candidate-only", "attempted-unavailable"]),
  sourceIds: z.array(z.string().min(1)).min(1),
  locator: z.string().min(1),
  finding: z.string().min(1),
}).strict();
const proposalSchema = z.object({
  indicatorKey: z.string().min(1),
  registeredPublisher: z.string().min(1),
  sourceRelationship: z.enum(["registered-product", "unconfirmed-survey-candidate"]),
  scope: z.literal("source-product-metadata-only"),
  ownerReview: z.literal("pending-not-requested"),
  centralModelEligible: z.literal(false),
  originalObservationAvailableAt: z.null(),
  originalVintage: z.null(),
  fields: z.object({
    informationAvailability: fieldSchema,
    licence: fieldSchema,
    regionalApplicability: fieldSchema,
    uncertainty: fieldSchema,
    calibration: fieldSchema,
  }).strict(),
}).strict();
export type IndicatorSourceMetadataProposal = z.infer<typeof proposalSchema>;

const proposals: IndicatorSourceMetadataProposal[] = [
  {
    indicatorKey: "atmosphericCO2ppm", registeredPublisher: "NOAA Mauna Loa",
    sourceRelationship: "registered-product", scope: "source-product-metadata-only",
    ownerReview: "pending-not-requested", centralModelEligible: false,
    originalObservationAvailableAt: null, originalVintage: null,
    fields: {
      informationAvailability: {
        status: "attempted-unavailable", sourceIds: ["noaa-annual-file", "noaa-trends"],
        locator: "File Creation header; revision warning; landing-page last-updated label",
        finding: "File Creation Oct 9 2026 13:08:13 is a current file timestamp with no timezone stated, not the first availability of each 2010–2025 observation. Last-year recalibration and occasional earlier revisions are explicit. Original annual releases were not supplied by these pages.",
      },
      licence: {
        status: "source-product-qualified", sourceIds: ["noaa-rights", "noaa-annual-file"],
        locator: "Data and Products; USE OF NOAA GML DATA",
        finding: "NOAA government information is public domain unless annotated otherwise; acknowledge GML, cite the data separately, do not imply endorsement or present modifications as official. File requests relevant citation; Scripps provenance before May 1974 is separately noted. Does not approve the curated history.",
      },
      regionalApplicability: {
        status: "source-product-qualified", sourceIds: ["noaa-trends", "noaa-annual-file"],
        locator: "3400 m northern subtropics paragraph; eruption/site note",
        finding: "Mauna Loa background dry-air mole fraction is not a global surface mean or six-region concentration series. December 2022 to July 4 2023 uses Maunakea; MLO resumed July 2023. No geography substitution or regional calibration admitted.",
      },
      uncertainty: {
        status: "source-product-qualified", sourceIds: ["noaa-annual-file"],
        locator: "annual-mean uncertainty comment; year/mean/unc columns",
        finding: "Publisher annual-mean uncertainty is the standard deviation of differences between independently determined NOAA and Scripps annual means; captured file reports 0.12 ppm. This is measurement-product metadata, not a Gaussian assumption, covariance, causal coefficient or validated uncertainty on the retained curated rows.",
      },
      calibration: {
        status: "source-product-qualified", sourceIds: ["noaa-trends", "noaa-annual-file"],
        locator: "background means; reference-gas recalibration and quality-control warnings",
        finding: "Monthly means use background daily/hourly observations; last-year data remain preliminary pending reference-gas recalibration and QC. Instrument calibration is not an emissions-response calibration; validation-target role retained.",
      },
    },
  },
  {
    indicatorKey: "co2GrowthRatePpm", registeredPublisher: "NOAA Mauna Loa",
    sourceRelationship: "registered-product", scope: "source-product-metadata-only",
    ownerReview: "pending-not-requested", centralModelEligible: false,
    originalObservationAvailableAt: null, originalVintage: null,
    fields: {
      informationAvailability: {
        status: "attempted-unavailable", sourceIds: ["noaa-growth-method", "noaa-growth-file"],
        locator: "March finalization paragraph; File Creation header and revision warning",
        finding: "Publisher describes finalizing the previous year's growth in March using November–February means. This cadence supplies no exact original release date for any curated annual row. Oct 9 2026 file creation is not original observation availability.",
      },
      licence: {
        status: "source-product-qualified", sourceIds: ["noaa-rights", "noaa-growth-file"],
        locator: "Data and Products; USE OF NOAA GML DATA",
        finding: "Public-domain government information unless annotated; acknowledge GML and cite source data, with no endorsement or official-status claim for modified data. Separate third-party provenance remains respected; no owner approval conferred.",
      },
      regionalApplicability: {
        status: "source-product-qualified", sourceIds: ["noaa-growth-method", "noaa-growth-file"],
        locator: "MLO minus global comparison and Maunakea note",
        finding: "MLO growth is not global growth. Publisher reports 0.26 ppm/year standard deviation of annual MLO-minus-global differences; this representativeness statistic is distinct from measurement uncertainty, not six-region error bars.",
      },
      uncertainty: {
        status: "source-product-qualified", sourceIds: ["noaa-growth-method", "noaa-growth-file"],
        locator: "estimated uncertainty paragraph; year/ann inc/unc columns",
        finding: "0.11 ppm/year source-product uncertainty is based on standard deviation of differences between independent monthly means from Scripps and NOAA. No temporal covariance or distribution family is supplied; cannot transfer to unmatched curated growth rows.",
      },
      calibration: {
        status: "source-product-qualified", sourceIds: ["noaa-growth-method"],
        locator: "definition and November–February seasonal-correction paragraphs",
        finding: "Annual growth is end-December minus start-January concentration trend, estimated from seasonally corrected four-month averages centered on successive January 1 dates; not the difference between adjacent annual mean concentrations. No new causal fit admitted.",
      },
    },
  },
  {
    indicatorKey: "sacrificeWillingnessPct", registeredPublisher: "Survey (Pew/UN)",
    sourceRelationship: "unconfirmed-survey-candidate", scope: "source-product-metadata-only",
    ownerReview: "pending-not-requested", centralModelEligible: false,
    originalObservationAvailableAt: null, originalVintage: null,
    fields: {
      informationAvailability: {
        status: "candidate-only", sourceIds: ["pew-release"],
        locator: "report dateline; How we did this; Oct 13 2021 correction",
        finding: "Original report dated September 14 2021; 16 non-US publics surveyed March 12–May 26 2021 and US February 1–7. Current page includes a later October 13 correction to a different economic-impact chart. Report publication is not an authenticated vintage or first availability of the curated annual series.",
      },
      licence: {
        status: "candidate-only", sourceIds: ["pew-rights"],
        locator: "Sections 1–4 and 13–14; effective May 25 2018",
        finding: "Copyrighted, conditional use with attribution and notices, no implied endorsement; no full/principal-part republication, unauthorized scraping, or standalone third-party material. Survey datasets and ATP have additional/distinct terms. Public facts/links/paraphrases only here, no media, microdata, dataset or report republication; no blanket CC/public-domain admission.",
      },
      regionalApplicability: {
        status: "candidate-only", sourceIds: ["pew-release", "pew-method"],
        locator: "How we did this; willingness-to-change section",
        finding: "Median across 17 advanced-economy publics, not a population-weighted world percentage. Sixteen telephone samples plus US online ATP; stated willingness to change life/work is not observed sacrifice or emissions delivery. No global/six-region substitution.",
      },
      uncertainty: {
        status: "candidate-only", sourceIds: ["pew-method"],
        locator: "ATP overview, weighting and sampling-error paragraphs",
        finding: "US full sample n=2596 has ±2.7 percentage-point sampling error (95% context in methodology), not error for a 17-public median or global aggregate. Weighting, nonresponse and wording can affect estimates; no aggregate uncertainty inferred.",
      },
      calibration: {
        status: "attempted-unavailable", sourceIds: ["pew-release", "pew-method"],
        locator: "willingness-to-change section; sampling methodology",
        finding: "Survey documents stated willingness, not an incremental causal emissions coefficient or full-window calibration. Exact mapping of the curated 2010–2025 series to questions, countries, weights and releases remains unavailable; no retune, interpolation or shortened window.",
      },
    },
  },
];

/** Admission here means structurally source-linked proposal, never owner/scientific approval. */
export function admitIndicatorSourceMetadataProposal(input: unknown): IndicatorSourceMetadataProposal {
  const proposal = proposalSchema.parse(input);
  const definition = getIndicatorDef(proposal.indicatorKey);
  if (!definition || definition.source !== proposal.registeredPublisher)
    throw new Error("Source metadata must match the actual registered indicator and publisher");
  const isNoaa = proposal.indicatorKey === "atmosphericCO2ppm" || proposal.indicatorKey === "co2GrowthRatePpm";
  if ((!isNoaa && proposal.indicatorKey !== "sacrificeWillingnessPct") ||
      proposal.sourceRelationship !== (isNoaa ? "registered-product" : "unconfirmed-survey-candidate"))
    throw new Error("Source relationship is not qualified for this indicator");
  for (const field of Object.values(proposal.fields)) {
    for (const id of field.sourceIds) {
      const document = indicatorSourceDocuments.find(source => source.id === id);
      if (!document || !id.startsWith(isNoaa ? "noaa-" : "pew-"))
        throw new Error("Unqualified source document for indicator");
    }
    if (!isNoaa && field.status === "source-product-qualified")
      throw new Error("Unconfirmed survey cannot receive registered-product qualification");
  }
  if (isNoaa && proposal.fields.informationAvailability.status !== "attempted-unavailable")
    throw new Error("Current NOAA file does not establish original annual availability");
  return proposal;
}

export function indicatorSourceMetadataProposal(key: IndicatorKey) {
  const proposal = proposals.find(row => row.indicatorKey === key);
  if (!proposal) return null;
  // Parsing clones the object: consumers cannot mutate the retained proposal.
  const admitted = admitIndicatorSourceMetadataProposal(proposal);
  const ids = new Set(Object.values(admitted.fields).flatMap(field => field.sourceIds));
  return {
    ...admitted,
    admission: "metadata-proposal-only" as const,
    documents: indicatorSourceDocuments.filter(document => ids.has(document.id)).map(document => ({ ...document })),
    captureHashMeaning: "sha256-utf8-webFetch-markdown-not-source-vintage",
    evidencePath: "docs/indicator-source-fields-increment-evidence.json",
  };
}
