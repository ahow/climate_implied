# Conditional issuer climate cases: executable channel and refusal boundaries

## Result

This preparation now produces **an executable FPL solar-cohort capital-recovery ledger with actual annual dollar outputs**, alongside the XOM CCS operating-channel sensitivity. It does not claim three completed issuer forecasts. The FPL calculation connects a specified solar build to capital spend, financing assumptions, depreciating asset balances, allowed equity earnings and partial capital revenue requirements. XOM computes annual delivered contracted tonnes and service-revenue/variable-cost sensitivities. These are climate-linked operating mechanisms, not historical accounting controls. **No complete issuer FCFE/CAGR calculation is defensible from the evidence collected.** There remain zero full-company engine runs, approvals, probability distributions or production-eligible results.

Run `npx tsx script/build-company-conditional-cases.ts` to print the reproducible derived report. The script reads the three existing primary-source packets and receipts plus the new pinned FPL fact/assumption constants; it does not write files, call collectors, connect to a database, stage proposals or approve anything. It verifies the three retained archives' identity, content hashes, issuer ISIN, URL, dates and contracted-volume claim. The newly fetched public FPL/EIA facts are explicitly transcribed with raw-document hashes and locators; the offline builder does not redownload or independently verify those documents. Source text and provider statements are not emitted.

## Follow-up: executable FPL solar capital-recovery case

### New primary evidence

Public sources were retrieved and selectively read on **2026-11-10**, with source inspection completed before the FPL case cutoff **04:29:45Z**. Exact URLs, SHA-256 hashes and locators are in `fplChannelEvidence` in the module and in the printed report:

1. **FPSC staff memorandum, 2025-11-14**, docket 20250011-EI, document **15095-2025**, pages 2–3 and 6. It describes a 10.95% ROE and 59.60% equity ratio of **investor sources**, and **1,192 MW of solar projects in 2027** under the settlement SoBRA mechanism. Economic need requires stated CPVRR benefit and cost-benefit tests, or a resource/reliability need must be demonstrated. This is not unconditional approval of every project or dollar.
2. **Issuer earnings script, 2026-01-27**, page 4, confirms the adopted four-year agreement's 10.95% midpoint ROE, 9.95–11.95% range and 59.6% equity ratio. These are regulatory parameters, **not estimated climate elasticities**.
3. **FPSC reconsideration order PSC-2026-0117-FOF-EI, 2026-04-27**, document **02414-2026**. Pages 1–2 confirm the November 20, 2025 settlement approval; page 14 says the docket remains open during Supreme Court appeals. The full original final-order attachment **00561-2026** could not be reliably extracted in this bounded pass (very large/truncated transfer); it is **not claimed fully reviewed**. The case relies on the readable regulator memorandum, subsequent order and issuer confirmation, and remains provisional pending full order/project filings and legal-status review.
4. **EIA generator construction costs for 2024**, release date **2026-07-06**, photovoltaic capacity-weighted average **$1,865/kW**. Notes specify AC nameplate capacity, facilities at least 1 MW, and exclusion of grants/tax benefits/incentives. This is a national observed historical cost benchmark, **not FPL-specific future capex**. The page has an outdated introductory paragraph referring to 2021; the selected figure is explicitly from its 2024 heading/table and release, not that stale paragraph.
5. **Full original NextEra FY2025 earnings-release PDF, 2026-01-27**, page 11 FPL cash-flow column. This resolves the truncation in the retained markdown and supplies public annual financing/working-capital/capex facts. They are preliminary/unaudited, not forecast assumptions.

Source URLs:

* https://www.floridapsc.com/pscfiles/library/filings/2025/15095-2025/15095-2025.pdf
* https://www.floridapsc.com/pscfiles/library/filings/2026/02414-2026/02414-2026.pdf
* https://www.eia.gov/electricity/generatorcosts/
* Issuer release/script URLs are pinned in the executable module; the release is the same public PDF linked in the existing NEE receipt.

The initial August issuer settlement description said $766m for a 2027 base-rate request; the later November regulator memorandum says $705m inclusive of battery ITC benefit, with 2027 SoBRA separately offsetting part of the reduction. **Neither number is imported as solar revenue.** This source-version difference illustrates why the model does not mechanically translate a general rate announcement into climate-linked sales.

### Public annual cash baseline — context, not repeated as forecast

FY2025 FPL, nominal USD millions, public statement:

| Item | Value |
|---|---:|
| Operating cash flow | 8,533 |
| Capital expenditures | 8,719 |
| Nuclear fuel purchases, separate cash investing item | 216 |
| Depreciation and amortization | 3,778 |
| Current asset cash change / current liability cash change | −319 / +59 |
| Noncurrent operating asset / liability cash changes | −199 / −22 |
| Long-term debt issued / retired | 3,785 / 1,821 |
| Commercial-paper net change | −300 |
| Parent distributions | 1,100 |

Calculated current operating asset/liability contribution: **−$260m**. All four operating asset/liability rows: **−$481m**. Listed net debt funding: **$1,664m**. Operating cash after capex and nuclear fuel, before financing: **−$402m**. These are not issuer FCFE definitions: the broader attribution, investment and cash-flow boundary remains separate. Historical distributions are not FCFE. None of these historical cash rows is assumed recurring in the incremental solar ledger.

### Explicit conditional assumptions

The case covers **only the 1,192 MW 2027 solar cohort**, not all FPL capex or the whole NEE issuer. No battery MW are converted into solar output. No builds in later years are included because this is a single-cohort model, not because future builds are assumed zero.

* Assume the disclosed solar MW are AC, subject to checking project filings.
* Apply the EIA national historical **$1,865/kW** as a proxy held fixed in future nominal dollars with **zero escalation**. This is a transparent analyst transfer assumption, not a claim that national 2024 costs predict Florida 2027 costs.
* Spend/commission all cohort capital on **January 1, 2027**. This permits a fully specified annual ledger; actual project start dates, CWIP and AFUDC remain missing.
* Assume **30-year straight-line book depreciation, zero salvage**. This is an analyst convention, not a sourced FPL depreciation rate; the model accepts alternative lives. It is kept separate from the observed construction-cost benchmark.
* Split hypothetical financing **59.6% equity / 40.4% debt**. The source gives a regulatory investor-source ratio, **not an actual funding plan**.
* Calculate full net plant as investor-funded rate base in one scenario; another admits **75%**, an explicitly uncalibrated deduction/disallowance stress, not an invented ADIT or tax-credit calculation.
* Model timely recovery, a one-year lag without catch-up, and absence of post-2029 recovery. The first two assume the same ROE terms continue in 2030–2031; the agreement itself only covers 2026–2029. The third is a renewal-risk stress, not a legal prediction that recovery ends.
* O&M, interest/debt return, tax gross-up, tax credits/customer sharing, working capital, repayments and other businesses are **not calculated**. No rate-stabilization tax-accounting balance is treated as fresh cash.

### Annual equations and actual outcomes

Capital = `1,192 MW × 1,000 kW/MW × $1,865/kW` = **$2,223.080m**. That is **25.497%** of FPL's public FY2025 total capex, a scale comparison only. Initial assumed debt funding is **$898.12432m** and equity funding **$1,324.95568m**.

Annual depreciation = capital / 30 = **$74.102667m**. Each year's average net plant is `(opening + closing net plant)/2`; admitted rate base multiplies that by the explicit admission fraction when recovery is active. Allowed equity earnings = `admitted average rate base × 59.6% × 10.95%`. Partial capital revenue requirement = allowed equity earnings + admitted depreciation recovery. **This excludes debt return, taxes, O&M, credits and other adjustments and is not total sales or cash collected.**

| Year | Timely/full: allowed equity earnings ($m) | Timely/full: partial capital revenue requirement ($m) | Lag/75%: allowed equity earnings ($m) |
|---|---:|---:|---:|
| 2027 | 142.664603 | 216.767270 | 0 |
| 2028 | 137.828515 | 211.931181 | 103.371386 |
| 2029 | 132.992426 | 207.095093 | 99.744320 |
| 2030 | 128.156338 | 202.259005 | 96.117254 |
| 2031 | 123.320250 | 197.422917 | 92.490187 |

Five-year allowed equity earnings: **$664.962132m** timely/full; **$391.723147m** lag/75%; **$413.485544m** no post-2029 recovery. Five-year partial capital revenue components: **$1,035.475465m**, **$614.031147m**, and **$635.793544m**, respectively. Closing 2031 net plant is **$1,852.566667m** in all cases; recovery changes do not erase the physical depreciation or funding requirement.

This is an actual conditional solar operating/asset-recovery case, rather than a per-dollar derivative. It is **not full issuer FCFE** and does not claim that regulation caused all solar demand or that these earnings will be earned/collected. Historical total FPL rate base is unnecessary for this isolated incremental-cohort ledger and has **not** been fabricated.

FPL assumption hash: `358dd73b32661c0416e943f32382910985421c04b1c6fc761c7a5172932a593b`.

Remaining case-specific inputs: complete final order and project filings; actual AC capacity basis and in-service dates; approved project capex/depreciation/rate-base schedules; ADIT/ITC/PTC deductions and sharing; current appeal disposition; exact revenue timing, O&M, debt costs, taxes and incremental working capital; actual financing and post-2029 terms. Those are the boundary between this executable conditional mechanism and a complete cash-flow case.

## Original requirements read

Read the original Stage 12 section in `attached_assets/Climate_Dashboard_—_Developer_Work_Plan_(1)_1794135026111.docx`, including operating-geography exposures, history/peer margin bounds, scope-specific liability, activity × intensity, delivery credibility, non-duplication, line-by-line Stage 11 cash-flow pairing, 1,000 jointly sampled members and three end-to-end examples. Read its Stage 13 sector-first identification and conditional-assumption requirements. These cases do **not** satisfy Stage 12 completion: three deterministic sensitivity members are not its 1,000-member paired distribution.

Inspected `companyProjection.ts` and `companyBaseline.ts`; both are unchanged. The engine requires a positive identifiable starting FCFE, complete exposures, five annual operating/cash bridges and scoped emissions. A reconciled provider residual is not evidence it will recur. We do not fill missing scope values with zero or silently repeat a historical accounting ledger to force a climate result.

## Evidence and measured/assumed separation

The executable source identity and dates are preserved in `docs/company_operating_source_receipts.json`. The builder resolves the private original packets and verifies their existing archive hashes.

| Issuer | Dated primary evidence | What it supports / does not support |
|---|---|---|
| NEE | NextEra full-year 2025 results, published **2026-01-27**, retained **2026-11-10**. Receipt URL points to issuer PDF; FPL and NEER sections reviewed. | FPL reported approximately $8.9bn 2025 capital investment; rate agreement effective January 2026; NEER approximately 30 GW mixed generation/storage backlog. Does not give annual technology-specific delivery, ownership, tariffs or climate-only causal attribution. |
| XOM | ExxonMobil 2030 corporate plan, published **2025-12-09**, retained **2026-11-10**. Low Carbon Solutions section and footnotes 1, 6, 7, 9 reviewed. | Roughly **9 million metric tonnes CO2/year contracted with third parties**, US Gulf Coast CCS system; additional startups conditional on investment, policy and permits. Contracted volume is a dated issuer claim, **not measured injection**. |
| CAT | Caterpillar third-quarter 2025 results, published **2025-10-29**, retained **2026-11-10**. Power Generation application sales table and dealer-statistics qualification reviewed. | Quarterly Power Generation sales of $2.634bn and demand growth. Neither that category nor data-center demand identifies climate-policy-caused equipment purchases. |

Primary XOM URL: https://investor.exxonmobil.com/company-information/press-releases/detail/1198/exxonmobil-raises-its-2030-plan-transformation

A direct, unauthenticated primary-page fetch on 2026-11-10 corroborated the publication date, roughly 9 million tonne contract claim and supportive-policy condition. HTTP returned 200; fetched HTML SHA-256 was `80ed75bf3a8980404be4ddfa269baa9fddf76ab23e5ef0572b2564f09a07a35d`. This fresh page check is **not** used to claim historical availability and does not replace the retained source identity. No new publication timestamp is invented.

Private worked-inputs for NEE, CAT and CVX were inspected, including fiscal statement availability and cash-flow sign. GE and UNP were screened as industrial alternatives. Candidate identity status is not independent approval. Emissions observation dates exist, but the inspected observation rows themselves do not establish units, source vintages or issuer/project boundaries. Those rows cannot silently provide current complete emissions inventories. No provider statement values or licensed source payloads are reproduced here.

## Frozen analyst assumptions and actual calculations

Knowledge cutoff: **2026-11-10T04:00:00.000Z**, after retained source availability. Forecast window: **2027–2031**, the next five complete calendar years. This is prospective preparation using a stale disclosed contract envelope, **not** a claim that all 2026 developments have been incorporated.

The source supplies the approximate 9 Mt/year contract envelope. The analyst supplies three deterministic annual *delivery fractions of that envelope*:

| Member | 2027 | 2028 | 2029 | 2030 | 2031 | Five-year delivered tonnes |
|---|---:|---:|---:|---:|---:|---:|
| Policy or permit failure | 0 | 0 | 0 | 0 | 0 | **0** |
| Staged execution | 25% | 50% | 75% | 100% | 100% | **31,500,000** |
| Full contract delivery | 100% | 100% | 100% | 100% | 100% | **45,000,000** |

Rationale: zero and full delivery are contract-envelope boundary stresses. The source explicitly makes projects contingent on policy/permitting/investment. Equal quarter-contract increments transparently illustrate commissioning delay without inventing project-level start dates. They are **not calibrated coefficients, issuer guidance, probability quantiles or a likely range**. New contracts and above-envelope volumes are excluded, not ruled out.

Staged annual delivered tonnes are **2,250,000; 4,500,000; 6,750,000; 9,000,000; 9,000,000**. For annual fee `p` and variable cost `c`, service revenue is `tonnes × p` and variable operating contribution before fixed costs is `tonnes × (p − c)`. Consequently the staged annual revenue sensitivity to **one USD/tonne of fee** is **$2.25m, $4.50m, $6.75m, $9m, $9m**; the variable-cost sensitivity is the same magnitude with the opposite sign. Five-year sensitivity is **$31.5m per USD/tonne**, undiscounted. Full delivery gives **$45m per USD/tonne** over five years. These are derivatives, **not assumed tariffs or revenue forecasts**. No arbitrary fee/margin/credit is supplied.

There is no inference of avoided emissions, issuer Scope 1 abatement or issuer emissions intensity from third-party throughput. Capture energy, leakage, permanence, ownership and counterfactual emissions are unresolved. No 45Q credit is assigned to XOM: ownership and sharing are not established.

Frozen assumption hash:
`20a095f4b3922488fd172e5c6f6b904c33baaa7377133b9d294b34f05f4e5411`

Canonical channel-input hash:
`8aa5d79482a6b3ef5e67405e81cfed48c07eac8ffa1281131b60907a0990541a`

The source archive remains pending review. Content integrity is not publisher authentication, scientific validation, independent analyst approval or legal entitlement.

## Exact full-company blockers and rejected mappings

**NEE:** need annual FPL/NEER geography/sector revenue shares with corporate eliminations; solar/wind/nuclear commissioned MW and in-service dates; storage MW/MWh separately; generation capacity factors and curtailment; owned PPA tariffs/escalators; approved FPL order with recoverable rate base, returns, depreciation, tax and timing. Also need complete nominal cash bridges and scoped inventories/intensity/liability. Do not convert the mixed 30 GW backlog into solar output or revenue; 2% typical residential bill growth is not total revenue growth; adjusted EPS is not FCFE. Ordinary electricity/hyperscaler growth must be separated from the chosen climate-policy counterfactual.

**XOM:** need customer/project start dates, minimum delivery, recognition terms and owned share; annual service fee, escalation and capture/transport/storage allocations; fixed/variable costs; CCS capex, depreciation, working capital, financing, cash taxes and credit sharing. Need the entire non-CCS business, annual operating-geography mix, reconciled positive issuer starting FCFE, explicit non-operating/attribution/cash adjustments and emissions boundaries. The $35bn plan cash-flow increase uses constant price/margin assumptions and excludes working capital/other; it is not nominal FCFE. The $20bn lower-emission investment envelope spans several businesses and years; it is not a CCS capex schedule.

**CAT:** need dated transition-related orders/product classifications with a causal policy/technology counterfactual distinct from ordinary data-center, oil/gas and construction demand; geography/customer shares and annual conversion/cancellation; Machinery/Energy scope separated from Financial Products; complete five-year cash bridges, evidenced margins and scoped emissions. Product-use Scope 3 is not a direct issuer carbon liability.

All three need evidence-supported margin bounds, five annual activity/intensity paths, carbon-liable fractions and pass-through; compatible 2027–2031 nominal USD FCFE valuation inputs; and justified dependence/uncertainty before any joint distribution claim. Approval is a separate gate, **not the reason missing causal/accounting inputs were refused**.

The machine-readable `issuerCaseDecisions` records these field-level requirements and disallowed mappings.

## Alternatives considered, without ticker shopping

* **Utility:** Follow-up source work now supports FPL's incremental solar capital-recovery case above. FPL remains a segment of NEE, not an independently modelled NEE replacement. Complete order/project schedules and issuer integration remain missing. A renewable pure play could simplify technology exposure, but no alternative utility's complete dated cash/operating packet is present; none is claimed supported.
* **Oil/gas:** CVX has a retained candidate statement packet and positive historical starting-FCFE sign, but that does not establish a dated CCS contract, tariff, commissioning or non-CCS climate activity bridge. Switching to CVX would replace an actual XOM CCS physical anchor with an unsupported mapping. Retain XOM's partial channel.
* **Industrial:** UNP could support a modal-shift fuel/demand mechanism only with displaced truck tonne-miles, rail capacity, tariffs, cost/financing and a climate-policy counterfactual. Those are absent. GE's retained financial packet does not establish a renewable-project scope or a transition sales bridge; do not infer one from its name or historical corporate scope. Neither is promoted simply because its historical accounting bridge is calculable.

No alternative meets the end-to-end standard on the inspected evidence. This is a bounded finding about these packets, not a claim that such issuers cannot be modelled with further research.

## Verification and changed paths

Executed:

* `npx tsx --test script/company-conditional-cases.test.ts`: **6 passed** after the FPL extension. Checks quantities/derivatives, deterministic input identity, changed-assumption hashes, no issuer-FCFE/avoided-emission output, invalid fractions/dates/nonfinite inputs, duplicate identities and incomplete horizons; additionally checks solar asset/depreciation/funding reconciliation and the effects of lag, admission fraction and post-2029 renewal.
* `npx tsx script/build-company-conditional-cases.ts`: completed; all three retained archive/receipt checks passed, produced the hashes/results above and **0 full-company engine runs**.
* `npx tsx --test script/company-projection.test.ts script/company-baseline.test.ts`: **5 passed**, unchanged engine/baseline regression tests. Combined final run: **11/11 passed**.
* Targeted strict TypeScript check of the three new TypeScript files and their imports (`tsc --noEmit`, ES2022, ESNext/bundler resolution): **passed**.

New implementation paths:

* `server/calculation/companyConditionalCases.ts`
* `script/build-company-conditional-cases.ts`
* `script/company-conditional-cases.test.ts`
* `docs/Conditional_Company_Climate_Cases.md`

No UI, route, shared semantics, central ledger, package manifest, production data, source collector or release callback changed by this work. No full app/UI verification was performed; this is a standalone calculation/report task.
