# Analysis-wide historical input selection

## Implemented scope

The application header now lets a user select an immutable workbook and an
approved-indicator archive together. The selector loads paginated inventories,
verifies the pair against the summary endpoint, then persists only their IDs in
browser session storage and reloads the page. Reloading creates a fresh query
cache and prevents in-flight responses for the previous selection being shown
as newly selected data.

The selection applies across navigation to:

- Company summary, dimensions, valuation groups, SDG growth, decarbonization
  groups and retrospective backtest requests on the three company pages.
- Supported legacy projection, category, sensitivity, historical-trend,
  indicator-history and emissions-candidate requests.

Both IDs travel on company requests; indicator IDs travel on climate requests.
Successful responses must confirm the workbook identity and archived-indicator
state before their body is used. Mismatches fail rather than fall back.

Archived valuation-group calculations no longer require a current completed
upload. Their data comes from the selected immutable workbook, and their
cache identity includes the loaded dataset. Missing/current-upload state no
longer disables those historical requests in the client.

Export interpretation sheets include the active input IDs and scope limitations.
Returning to current inputs clears the session selection and reloads.
Malformed saved selection produces an explicit reset notice; calculations fail
closed rather than silently reverting to current data.

## Deliberate boundaries

Published reference scenarios, news, provider status and data-management records
remain current and are identified as outside the selection. The existing
Data Management summary preview retains its independent preview selection.
Legacy regional counterfactuals are refused in historical mode because their
external intensity data is not archived.

This replays selected inputs using **current code**. It is not restoration of an
old executable, a genuine publication-vintage forecast or a complete snapshot of
financial/carbon/SDG overlays. Those unimplemented archives are not invented.
Production without the required immutable archives shows unavailable inventory
and cannot apply an archived selection.

## Verification

- 187 TypeScript tests passed, including URL propagation, removal of current
  upload dependency, unsupported regional requests, conflicting selections,
  response-identity checks and workbook-aware request validation.
- 48 Python tests passed; type checking and production build passed.
- Actual development archive inventory contained one workbook and one indicator
  archive. Summary, dimensions, valuation groups and SDG calculations returned
  HTTP 200 with the selected workbook and archived-indicator headers.
- Valuation groups returned 187 rows without an upload ID; SDG returned 193.
- The updated header rendered in the preview without browser errors.
- The output-register regression initially flagged the new consumers; the
  generated census was reviewed and updated, then passed.

No sign-in, payment or source-data mutation flow was changed. Interactive
browser click-through was not separately automated; request behaviour was
verified with unit tests and real endpoint requests.

## Remaining workplan

This closes the former summary-only selection limitation for the supported
views listed above. Complete overlay archival, production archive provisioning,
historical regional-source snapshots, scientific calibration and the remaining
company/research/acceptance stages remain outstanding. It does not declare the
entire engineering workplan complete.
