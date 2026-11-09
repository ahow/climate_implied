# Energy-source compatibility protocol

Frozen 9 November 2026 before downloading and comparing numerical replacement
data. This is a source-revision assessment, not a new model-selection exercise.

- Compare the frozen legacy OWID release to its replacement catalog release.
- Retain both privately and hash each. Never overwrite the legacy CSV/results.
- Exact entities: World, United States, China, India, European Union (27).
- Exact overlap: annual 2010–2024. Targets: electricity demand, solar electricity
  share and wind electricity share. No primary-energy comparison is made because
  the publisher states its measurement basis changed.
- Use the publisher's column mapping, verifying the selected replacement fields.
- Report all 15 entity/target combinations: matched/missing observations and
  maximum absolute revision in TWh or percentage points.
- Re-execute the already frozen demand and adoption models on the replacement
  release, preserving training windows, holdout windows, methods and acceptance
  rules. Report every result; do not pick the release giving better fits.
- Neither matching values nor better fits authorise central-model promotion.
- 2025 observations in the new release are outside these frozen evaluations.
  They are not appended to the holdout after looking at its results.

Publisher documentation:
https://catalog.ourworldindata.org/energy/owid_energy/readme.md

Mapping:
https://catalog.ourworldindata.org/energy/owid_energy/column_mapping.csv
