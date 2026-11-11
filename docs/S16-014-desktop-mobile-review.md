# S16-014 desktop/mobile bounded review

## Updated verdict

**COMPLETE — 42/42 applicable state cells** across the seven data-bearing routes:
loading, empty, and error at both 1280×900 and 390×844. This update supersedes
the earlier partial checkpoint. The static unknown route was inspected at both
viewports; all six route-state cells are N/A because it has no route-specific
data lifecycle. The corrected NEE table bounds and desktop sizing also remain
verified.

One state-visibility gap is recorded, not masked: on mobile Climate Valuation,
the held `/api/cv/summary` request had no summary-specific loading status,
skeleton, or `aria-busy` element anywhere in the inspected DOM; only unrelated
“Loading archived inputs…” appeared. No stale summary values were visible.

No code, database, auth, workflow settings, catalog, or public writes were made
by this test. Controlled empty responses were explicitly test-only, contract
shaped, and never represented as source observations. Static retained/reference
values remained dated and unchanged; reasoned unknown currency/magnitude and
money-withheld disclosures remained intact.

## Route and viewport coverage

| Route | Desktop 1280×900 | Mobile 390×844 |
| --- | --- | --- |
| `/` | **PASS** — six controlled cells complete; dated published references unchanged. Desktop error showed the indicator-failure alert with no indicator grid/download. Screenshots `6yuz12`, `fyxbf7`, `10nf0e`, `10snxa`. | **PASS** — six controlled cells complete; mobile loading showed skeletons, empty showed no evidence/no cards, error showed Retry with no stale indicator grid/download. Screenshots `2lvgpg`, `va3spx`, `qem17j`. |
| `/methodology` | **PASS** — six controlled cells complete; Track B loading, true empty, and 503 error each showed no report links on empty/error. Screenshots `68ipij`, `iu6ogr`, `yyjo5b`, `x48ht5`. | **PASS** — six controlled cells complete; mobile empty/error had 0 Track B links/selects; dated references and money-withheld notices stayed intact. Screenshots `vwiiap`, `dbvnv7`, `vk92h3`. |
| `/climate-valuation` | **PASS with loading-visibility gap noted** — six controlled cells complete; desktop 503 changed all summary cards to Unavailable and said no prior counts/series. Empty-fixture zero cards are synthetic. Screenshots `tp8iiu`, `yrqebk`, `n39lxm`. | **PASS with loading-visibility gap noted** — six controlled cells complete; NEE table fix verified at 390px. Held summary request showed no summary-specific loading UI; empty-fixture zero cards are synthetic; error withheld prior values. Screenshots `csc73a`, `6jgbu8`, `z6hfkx`, `3v2elp`. |
| `/decarb-signal` | **PASS** — six controlled cells complete; 503 had no previous result, metrics Unavailable, and download disabled. Screenshots `34esb8`, `1w5tp7`, `qzxcgx`, `4y2is8`. | **PASS** — six controlled cells complete; loading withheld previous outputs; empty had no completed dataset, Unavailable metrics, and disabled download. Screenshots `jj70gf`, `jyp48u`, `leaf0p`. |
| `/decarb-gap` | **PASS** — six controlled cells complete; 503 had no previous result and no result/download controls. Screenshots `l680t5`, `xf12qg`, `dmkvdo`, `rlwx5j`. | **PASS** — six controlled cells complete; loading withheld previous outputs; empty had no completed dataset, with no metric values or download controls. Screenshots `lrdikd`, `rtwqu8`, `esiftt`. |
| `/news-sentiment` | **PASS** — six controlled cells complete; 503 settled to “Awaiting Operator News Refresh,” with no cached articles/metrics. Screenshots `dc3dis`, `7i6ypm`, `8vknz2`, `hlt21a`. | **PASS** — six controlled cells complete; loading showed skeletons/no prior articles; empty showed no observations, overall N/A, no articles; error showed operator refresh. Screenshots `350z62`, `6ygpxm`. |
| `/data-management` | **PASS** — six controlled cells complete; 503 on both reads set counts/baseline unavailable and stated no previous result; collection stayed disabled/operator-only. Screenshots `fpcyaz`, `z11xog`, `ekyyvl`. | **PASS** — six controlled cells complete; loading withheld both prior reads; empty fixture showed explicit empty reasons, 0/0 counts, baseline metadata 2024; error reset counts to Unavailable/—. Screenshots `8gfytl`, `81jegj`, `gziv7i`. |
| Unknown route (`/s16-014-route-not-found`) | **PASS** — shared shell and static “404 Page Not Found”; no route-specific data lifecycle applies. Screenshot `7jyig4`. | **PASS** — same static 404 at 390×844; no route-specific loading/empty/error branch applies. Screenshot `rm68dx`. |

## Fixed NEE table bounds

The earlier mobile overflow measurement (table right edge ≈708px) was taken
before the component update. Recheck after the update confirms:

| Viewport | NEE dividend row / table | Immediate horizontal wrapper | Document |
| --- | --- | --- | --- |
| 390×844 | left 34, right 341, width 307px | left 33, right 342, width 309px; table client/scroll width both 307px | client/scroll width both 390px |
| 1280×900 | left 282, right 1207, width 925px | left 281, right 1208, width 927px | client/scroll width both 1280px |

The row locator was `data-testid="conditional-fact-NEE-fplDividend"`. The table
wraps in the mobile card, and the desktop version retains its full natural width.
Mobile screenshot `3v2elp` shows the bounded table; desktop screenshot `9f9ae7`
shows the intact wider reconciliation table. The mobile page still has a small
internal main scroll-width excess of 3px (378 vs 375px) after the table fix; the
document itself remains 390px. Decarb Signal and Decarb Gap also had small
internal main scroll-width excesses (14px and 8px respectively) with no
document-level width excess; this was recorded as a minor responsive observation,
not a failed data contract.

## Controlled state matrix — 42/42 applicable cells

Each data-route row contains all six cells: desktop loading/empty/error and
mobile loading/empty/error. The unknown 404 route has no applicable data-state
cells at either viewport (6 N/A). **Remaining applicable cells: 0.** Interception
used only page-local GET reads.

| Route/API contract | Desktop L | Desktop empty | Desktop error | Mobile L | Mobile empty | Mobile error |
| --- | --- | --- | --- | --- | --- | --- |
| `/` — `/api/indicators/historical` | Skeletons; no prior cards. | Empty evidence message; no card/download grid. | 503; indicator-failure alert and Retry; no cards/download. | 48 skeletons; no prior grid. | Empty evidence message; zero cards/downloads. | 503; error and Retry; no stale grid/download. |
| `/methodology` — Track B public catalog | Catalog loading; Stage10 loading/values withheld. | `track-b-public-catalog-1`, `reports: []`; strict empty/operator prerequisite. | 503 “Public catalog unavailable”; 0 links. | Catalog loading; Stage10 loading/previous downloads withheld. | Strict empty copy; 0 links/selects. | 503 unavailable; 0 report links. |
| `/climate-valuation` — `/api/cv/summary` | Request held; summary-loading affordance was not clearly visible in the captured desktop checkpoint. | Contract-shaped empty summary; displayed zero cards are synthetic test output. | 503; all four cards Unavailable; no prior counts/series. | Request held; no summary-specific loading status/skeleton/`aria-busy` found; no stale summary values visible. | Contract-shaped empty summary; displayed zero cards are synthetic test output. | 503; no prior summary counts/series; cards Unavailable. |
| `/decarb-signal` — `/api/cv/uploads` | Loading/previous outputs withheld. | `[]`; no completed dataset, metrics unavailable, download disabled. | 503; no previous result, metrics Unavailable, download disabled. | Loading/previous outputs withheld. | No completed dataset; metrics Unavailable, download disabled. | 503; no previous result, metrics Unavailable, download disabled. |
| `/decarb-gap` — `/api/cv/uploads` | Loading/previous outputs withheld. | `[]`; no completed dataset/metric values/download controls. | 503; no previous result; results/downloads withheld. | Loading/previous outputs withheld. | No completed dataset/metric values/download controls. | 503; no previous result; results/downloads withheld. |
| `/news-sentiment` — `/api/news/climate` | Loading skeletons/previous results withheld. | Contract-shaped empty arrays and `totalArticles: 0`; no observations/articles, overall N/A. | 503 settles to “Awaiting Operator News Refresh”; no cached articles/metrics. | Loading status/skeletons; no prior articles/metrics. | No daily-volume/sentiment observations; N/A overall, no articles. | “Awaiting Operator News Refresh”; no cached articles/metrics. |
| `/data-management` — `/api/data/indicators`, `/api/data/runs` | Both held reads; counts unavailable. | `indicators: []`, `runs: []`; explicit empty reasons. | Both 503; counts and baseline unavailable, no previous result. | Both held reads; counts Unavailable. | Explicit empty reasons; displayed 0/0 derive from fixture arrays only; baseline 2024 is API metadata. | Both 503; counts Unavailable/— and no previous result. |
| Unknown route | N/A — static 404. | N/A — static 404. | N/A — static 404. | N/A — static 404. | N/A — static 404. | N/A — static 404. |

Fixture discipline: every empty payload was contract-shaped and page-local. Any
zero article/count/summary value shown above came only from controlled empty
arrays/objects and is not a source finding. The live Data Management
baseline/latest metadata (2024/2026) was preserved; the controlled empty fixture
did not invent those years. No endpoint writes, database changes, approvals, or
fake public catalog entries were made. Intercepted 503s produced expected browser
resource-error logs; the live News read also returned its documented
`operator-news-refresh-required` error. No unhandled JavaScript error was
observed.

## Source hashes recorded for the table verification

```text
5631ad2d00de716b334c413b8f52b8a71abe508a6d5a4c189babc46b456b9d60  client/src/pages/climate-valuation.tsx
463ab49bff88885d686fd6c88c57865aeb529383c8e36a4615ca9ec874209f04  client/src/components/company-conditional-summary.tsx
```
