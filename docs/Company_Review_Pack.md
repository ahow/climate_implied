# Owner review pack — identities and fiscal rules

Run `npx tsx script/prepare-company-review.ts` against the 27 retained candidate
files. It verifies every input content hash and writes one private JSON packet
under generated-artifacts/company-review. No provider fetch or approval occurs.

Each case has workbook/provider identity, exchange and currency where supplied,
source file/hash/fetch time, existing approval state, all fiscal and filing
dates, and exact t+1/t+4 date availability. Null decisions remain null.

Required review: independently verify issuer/listing/share class and any ADR
ratio, quote versus accounting units, consolidated earnings boundary and filing
availability. Provider matching is candidate evidence, not your approval.

For 52/53-week handling, inspect successive fiscal dates alongside annual
filings and period labels. Missing exact calendar anniversaries can also mean
missing data, so the packet does not classify all such cases as 52/53-week years.
The executed D8 study keeps its exact-date exclusion rule. Any proposed
fiscal-year-index sensitivity needs owner review and a distinct frozen protocol;
it must never overwrite or retroactively rescue the failed original gate.

This packet supports review; it does not assert that the owner has performed it.
