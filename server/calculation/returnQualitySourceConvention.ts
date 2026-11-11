/** Read-only adapter for retained DSGRID request metadata, NOT a return calculator.
 * Cached monthly labels are not evidence of a trading-day selection rule.
 * Nothing here changes the frozen sample, approves identities, or supplies FX. */
export type RetainedRiMetadata = {
  formula: string;
  commentFormula: string;
  customPropertyJson: string;
  date1904: boolean;
  dateSerials: number[];
};

const options = "RowHeader=true;ColHeader=true;DispSeriesDescription=true;YearlyTSFormat=false;QuarterlyTSFormat=false;MonthlyTSFormat=true;TimeSeriesList=true";

export function inspectRetainedRiConvention(metadata: RetainedRiMetadata) {
  const match = /^_xll\.DSGRID\("([A-Z]#[A-Z0-9]+)","X\(RI\)~U\$","(\d{4})","","M","([^"]+)"\)$/.exec(metadata.formula);
  if (!match || match[3] !== options)
    throw new Error("Unsupported or changed retained RI request; no convention inference");
  const [, list, start] = match;
  const body = `DSGRID("${list}","X(RI)~U$","${start}","","M","${options}")`;
  if (metadata.commentFormula !== `=${body}`)
    throw new Error("RI formula/comment provenance mismatch");
  const property = JSON.parse(metadata.customPropertyJson) as Record<string, unknown>;
  const key = `[0:0]=DSGRID(${list},X(RI)~U$,${start},,M,${options}),`;
  if (!property || Object.keys(property).length !== 1 || property[key] !== "$B$1:$COY$1,$A$2:$COY$194")
    throw new Error("RI custom property provenance/range mismatch");
  if (metadata.date1904 !== false)
    throw new Error("Unsupported or missing Excel date system; no epoch default");
  if (metadata.dateSerials.length !== 193)
    throw new Error("Changed retained RI date population");
  const dates = metadata.dateSerials.map((serial, index) => {
    // Explicit 1900-system calendar decoding, not local-time conversion or close substitution.
    if (!Number.isSafeInteger(serial) || serial < 61 || serial > 2958465 ||
        (index > 0 && serial <= metadata.dateSerials[index - 1]))
      throw new Error("Invalid, fractional, duplicate or unordered Excel date");
    return new Date(Date.UTC(1899, 11, 30) + serial * 86400000).toISOString().slice(0, 10);
  });
  return {
    source: "retained-refinitiv-dsgrid" as const,
    datatypeExpression: "X(RI)~U$" as const,
    requestedCurrencyToken: "U$" as const,
    frequency: "M" as const,
    requestedStartYear: start,
    requestedEnd: "unspecified" as const,
    dates,
    weekendLabels: dates.filter(date => [0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay())).length,
    // The source explicitly requests a currency expression. Neither the FX fixing,
    // direction nor the historical listing currency is supplied by these three fields.
    currencyConversion: "requested-but-method-unresolved" as const,
    calendarRule: "unresolved" as const,
    dividendAndAdjustmentRule: "unresolved" as const,
    reconstructionStatus: "unavailable" as const,
    blockers: [
      "Monthly labels do not establish actual trading-date, holiday or weekend valuation rules",
      "RI label does not establish gross/net tax, reinvestment timing, special-dividend or split treatment",
      "Currency request does not establish source FX fixing, historical listing currency or conversion method",
      "Historical listing identity and independent review remain required",
    ],
  };
}
