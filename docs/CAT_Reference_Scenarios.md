# Published reference scenarios

The dashboard now separates **published CAT comparisons** from **the dashboard's
own calculation**. These references do not update the headline, calibrate its
temperature, or supply native-gas inputs to FaIR.

## Reference choice

- Main reference: **Current policies — CAT Policies & action**.
- Comparison: **All announced commitments delivered — CAT Optimistic scenario
  (net-zero pledges)**. This is explicitly optimistic and conditional, not an
  equally likely alternative forecast.
- Publication date: **13 November 2025**.
- Climate calculation: **CAT MAGICC7**, not this dashboard's model.
- Temperature values are the workbook's median warming in **2100**, relative
  to pre-industrial levels: **2.6°C** and **1.9°C**, respectively.
- Milestone emissions are published aggregate GtCO2e/year, not species masses.
  Current-policies low/high values are different policy pathways, not a
  probability interval. No invented emissions median is shown.
- The values retain CAT's own baseline; they are not rebased to the dashboard's
  2024 inventory. Differences must not be attributed solely to modelling skill.

## Roles of supporting references

IEA World Energy Outlook 2025 supports sector-level checks. CPS and STEPS
have different policy definitions; WEO 2025 has no updated Announced Pledges
Scenario. NGFS 5.1 supports detailed pathway/model assessment, with its March
2024 policy/pledge cut-off visible. Neither source is silently added as an
emissions-reduction multiplier. This UI explains the roles; it does not claim
that sector validation or native-gas calibration is complete.

## Preparation and updates

The selected figures are prepared from the pinned CAT public workbook by:

```sh
npx tsx script/build-cat-references.ts generated-artifacts/ngfs/CAT_2025-11.xlsx
npx tsx --test script/reference-scenarios.test.ts
```

The script checks SHA-256, source labels, dates, licence text and finite values.
It extracts the actual policy low/high series and optimistic series. The
API `/api/reference-scenarios` serves the versioned extract with its metadata.

This is a manual, reviewed reference update. The existing indicator collection,
approval and refresh process is unchanged. “Re-run Analysis” does not fetch a
new CAT release. Do not describe the pinned release as live or automatically
the latest available. A new release requires deliberate source/schema review.

## Third-party data notice

Source: [Climate Action Tracker emissions pathways](https://climateactiontracker.org/global/emissions-pathways/),
[November 2025 workbook](https://climateactiontracker.org/documents/1349/CAT_2025-11_PublicData_GlobalTemperatureEstimates_COP30.xlsx).

**Copyright © 2025 Climate Analytics and NewClimate Institute. All rights reserved.**

CAT's workbook authorises viewing, downloading, printing and distributing its
content with attribution and a copyright notice, **for non-commercial use only**.
The user has confirmed non-commercial use of this analysis. These restrictions
apply to CAT-derived data in `server/calculation/data/catReferences.json`,
regardless of any software licence associated with the project. They do not
relicense the application's original source code. Other users must not assume
that a public GitHub repository grants commercial rights to these data.

## Remaining boundary

This implements the agreed reference presentation. It does not complete the
remaining Package 2 native-gas modelling or start Package 3. The candidate
review continues to state its calibration limitations explicitly.
