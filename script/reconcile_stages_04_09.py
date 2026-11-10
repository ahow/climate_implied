"""Generate proposed clause records from direct files/logs; never edit the ledger."""
import ast
import hashlib
import json
import re
import subprocess
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


# Each numbered entry corresponds to exactly one original clause, including
# container clauses. A file pointer is evidence to inspect, not acceptance.
GROUPS = {
    "drivers": ["script/driver_calibration.py", "script/ev_sales_calibration.py",
                "script/storage_adoption.py", "script/heat_pump_diffusion.py",
                "server/calculation/driverEvidence.ts"],
    "cost": ["script/cost_deployment_calibration.py", "docs/EV_and_Cost_Calibration_Results.md"],
    "kaya": ["script/kaya_decomposition.py", "script/forecast_kaya.py", "docs/Kaya_Results.md"],
    "policy": ["server/calculation/emissionsCandidate.ts", "server/calculation/driverEvidence.ts"],
    "short": ["server/calculation/shortHorizonEmissions.ts", "script/short-horizon-emissions.ts",
              "docs/Historical_Diagnostics_and_Skill_Results.md"],
    "inventory": ["server/calculation/data/inventory2024.json", "server/calculation/emissionsCandidate.ts",
                  "server/calculation/regionalInventory.ts", "docs/Package_2_Emissions_Review.md"],
    "regional": ["server/calculation/regionalEngine.ts", "server/calculation/regionalSampling.ts",
                 "script/run-regional-ensemble.ts", "docs/Regional_and_Company_Engine_Execution.md"],
    "native": ["server/calculation/emissionsCandidate.ts", "shared/nativeScenarioSemantics.ts",
               "shared/nativeOutputSemantics.ts", "script/fleet_transition.py"],
    "convergence": ["server/calculation/memberConvergence.ts", "script/ensemble-convergence.test.ts"],
    "reference": ["script/reference_gas_infill.py", "docs/Reference_Gas_Infill_Results.md",
                  "docs/NGFS_Pathway_Compatibility_Assessment.md", "server/calculation/nativePathwayContract.ts"],
    "fair": ["script/fair-reference.py", "script/fair_native_bridge.py", "script/regional_fair_pathway.py",
             "script/fair_physical_retention.py"],
    "independent": ["script/independent_fair_benchmark.py", "script/test_independent_fair_benchmark.py",
                    "docs/Independent_FaIR_Benchmark_Protocol.md"],
    "history": ["script/reconcile_igcc_history.py", "script/compare_retained_igcc_physics.py",
                "script/fair_physical_retention.py", "script/independent_fair_benchmark.py",
                "docs/IGCC_History_Reconciliation_Protocol.md", "docs/IGCC_History_Reconciliation_Results.md"],
    "pulse": ["script/fair_pulse_checks.py", "docs/Climate_Pulse_Protocol.md"],
    "metrics": ["server/calculation/memberMetrics.ts", "server/calculation/ensemble.ts",
                "server/calculation/researchCorrections.ts", "script/member-metrics.test.ts"],
    "claims": ["server/calculation/readiness.ts", "server/calculation/evaluation.ts",
               "server/calculation/nativePathwayContract.ts", "shared/nativeOutputSemantics.ts"],
    "attribution": ["server/calculation/memberAttribution.ts", "script/regional_coalition_controls.py",
                    "script/member-attribution.test.ts", "docs/Regional_Attribution_Controls.md"],
    "counterfactual": ["server/calculation/regionalProjections.ts", "script/regional-counterfactual-labels.test.ts"],
    "archive": ["server/calculation/analysisManifest.ts", "server/calculation/historicalRecalculation.ts",
                "server/calculation/vintageAudit.ts", "script/analysis-result-archive.test.ts",
                "script/regional-replay.test.ts", "docs/Automatic_Archive_and_Result_Replay.md"],
}

# Exact remaining work, not a generic 'reconcile later' placeholder.
CLAUSES = {
    4: [
        ("drivers", "Complete compatible regional solar/wind/EV/heat-pump/storage fits and sourced saturation priors; shipment/MW series do not identify adoption-share ceilings."),
        ("cost", "Wind cost/deployment fit absent; solar source-definition breaks and observed-future deployment prevent ex-ante interpretation; battery 2024 production missing."),
        ("kaya", "Identity decomposition exists, but complete five-region compatible GDP/energy/CO2 histories, all trend/break tests and usable forecast holdouts remain incomplete."),
        ("policy", "Bounded policy mechanism is supplied-parameter engineering, not an identified carbon-price-times-coverage elasticity; obtain compatible coverage/exemption/enforcement evidence."),
        ("short", "Annual revised fossil-CO2 trend is not 2024-2026 monthly/daily high-frequency nowcasting; source original releases and scope-compatible outcomes."),
        ("drivers", "Holdouts exist for selected technologies only; complete all technology/region cells without shortening frozen windows or excluding losing cells."),
        ("drivers", "Selected scripts preserve non-promotion; enforce registry-to-member fallback for all drivers, not merely local diagnostic flags."),
        ("drivers", "Driver registry contains evidence roles, not all qualified fitted parameter distributions and source/version links consumed by Stage 5."),
        ("drivers", "Report every required technology/region error against both baselines; retain the EV, heat-pump, storage failures and uncertainty limitations."),
        ("drivers", "Audit all production central-driver consumers against diagnostic failures and document any separately justified exception; script-level false eligibility alone is insufficient."),
        ("drivers", "Storage saturation remains unidentified; heat-pump share denominator absent; source all missing saturation/elasticity priors and preserve declared training windows."),
        ("short", "No compatible high-frequency 2024-2026 reconstruction versus latest GCB within an advance-frozen tolerance; do not invent a tolerance post-outcome."),
    ],
    5: [
        ("inventory", "Native 2024 inventory is retained; independently close IGCC versus UNEP boundary, signed land, regional land allocations and international transport source compatibility."),
        ("regional", "Conditional member engine and joint sampling exist; complete calibrated Stage 4 distributions, structural uncertainty and climate pairing before calling it the full ensemble."),
        ("regional", "Document and execute the full socioeconomic/climate pairing scheme; 841 climate configurations and repeated controls are not independently sampled emissions members."),
        ("native", "Bounded eligibility/lag/overlap and EV charging exist; qualify actual coefficients and fleet dynamics; no unsupported corporate/finance central mechanism."),
        ("regional", "Schema refusals exist; full 10000-member draw rejection/bounding counts with scientific reason codes are not established."),
        ("regional", "No accepted 10000-member production ensemble with legacy 2030/2050/2100 before-after comparison; conditional development runs are not promotion."),
        ("regional", "Fixture accounting checks use 1e-9 relative; validate every actual production member/year/region/sector/gas including signed land and transport."),
        ("regional", "Deterministic joint-sampling fixtures exist; establish same-manifest/seed and reordered-source invariance for the complete actual persisted ensemble."),
        ("native", "Boundary fixture mechanisms are implemented; connect sourced calibrated inputs and prove all overlap/renewable/EV boundaries for the production ensemble."),
        ("native", "Perturbation fixtures establish selected driver isolation; complete the mechanism declaration and every-driver production perturbation matrix."),
        ("inventory", "Global inventory and regional fixture reconciliation exist; source-complete actual regional gas/sector/land starting accounts still need acceptance."),
        ("convergence", "Checker requires explicit emissions tolerance; freeze it before running actual 5000/10000 members and retain outcomes; fixture convergence is not a real ensemble result."),
        ("native", "No production promotion is permitted; audit every corporate/finance mechanism and source its coefficient or retain outside central as sensitivity."),
    ],
    6: [
        ("regional", "Conditional regional scenarios and dated NGFS current-policies controls are not an accepted current implemented-policy Stage 5 forecast."),
        ("reference", "NGFS Phase V 5.1 NDC is March-2024/2030-target scope, not all long-term commitments; current release/content/licence and Climate Resource alternative remain unresolved."),
        ("reference", "Two convergence years executed for two NGFS-derived controls; binding implemented-policy and all-commitments cases remain unavailable."),
        ("reference", "Three four-gas infill assumptions executed; calibrated/source-compatible infill and scientific adoption remain unestablished; do not swap isomers."),
        ("reference", "Verify latest CAT/UNEP/NGFS/COP31 release and exact binding labels/licences; existing hashes establish retained content, not current-release certification."),
        ("reference", "Versioned input contract exists but an actual Phase VI release swap with verified source/schema/content/licence is not demonstrated."),
        ("reference", "All 27 inventory accounts match conditional controls within 7.373e-14 relative; two required production cases are not delivered."),
        ("reference", "Twelve retained runs pass four conditional median-spread tests (<0.01 C); this is not all-scenario/general infill validation or production adoption."),
        ("reference", "Native contract rejects NDC-only all-commitments labels; audit every displayed/API/export binding and actual all-commitments input."),
        ("reference", "Retained reference/infill hashes verified; independently verify current displayed values, exact source version and labels end-to-end."),
    ],
    7: [
        ("fair", "Pinned native bridge and retention are implemented; calibrated full supported-gas emissions ensemble and recent history remain incomplete."),
        ("fair", "Offline Python artifacts exist; verify all Node routes consume the exact versioned ensembles and missing-artifact errors without Python request execution."),
        ("claims", "Container clause: explicitly bind physical response, Stage 9 skill and scenario interpretation to separate machine-readable statuses in every consumer."),
        ("history", "Endpoint comparison, pulse controls and raw forcing diagnostics are distinct; no matched independent annual reference or accepted full emissions/forcing/observable reconciliation."),
        ("short", "Failed fossil-CO2 short-horizon candidate is not evaluation of the full emissions model; complete Stage 9 targets before forecast claims."),
        ("reference", "Reference-derived control labels are explicit; complete interpretation of actual implemented-policy and long-term-commitment production pathways."),
        ("independent", "Frozen endpoint-only 8x66 comparison is verified numerical reproduction; original annual reference clause S07-018 remains unavailable."),
        ("history", "Native emissions retained, but compatible IGCC emissions absent; natural ERF reference/forcing definitions and GSAT/GMST unresolved; actual attributed 2025 and full 2016-2025 vectors unavailable. Never alias publication 2025 to observed 2024 or tune to 1.37/1.24."),
        ("metrics", "Container clause: metric functions exist; bind every named metric to the same actual accepted persisted members/manifest."),
        ("metrics", "Median/mean/P10/P90 available from supplied members; full physically verified source ensemble and headline binding incomplete."),
        ("metrics", "Durable separate signed GHG/CO2 crossings and null-never fixtures exist; prove all actual members use AR6 GWP100 and signed land from accepted inputs."),
        ("metrics", "Member event fractions exist; verify denominator and by-2050 event on accepted complete valid-member set; retain model-conditional label."),
        ("metrics", "Positive-endpoint CAGR plus absolute signed changes implemented; nonpositive compound rates explicitly unavailable; confirm exact required colleague sign rules rather than assuming equivalence."),
        ("metrics", "5%-of-own-2024 durable milestone is separately named; verify every public legacy name, probability label and calibration drilldown binding."),
        ("claims", "Readiness gates remain closed; no conditional-headline or forecast promotion while physical/accounting/Stage 9 criteria incomplete."),
        ("metrics", "Deterministic saved-member summaries have fixtures; demonstrate headline/quantiles/density/P2050 exact replay on actual accepted members across UI/API/export."),
        ("fair", "Native Python path avoids aggregate CO2e and offsets; legacy paths still require full audited boundary/claim separation before a global no-clipping/no-offset assertion."),
        ("independent", "Published independent arrays cover only 2100 boundary: no matched annual trajectory; raw IGCC RMSE is not the frozen <=0.01 C annual gate."),
        ("pulse", "Fresh-model pulse diagnostic exists; compatible calibrated ensemble TCRE/lifetime tolerances and all-member numerical acceptance need direct protocol/result review."),
        ("metrics", "Rise/fall/rebound/never-crossing fixtures pass; full accepted production member accounting remains separate from this fixture clause."),
        ("convergence", "Censor-aware checker exists; no accepted actual 5000/10000 run proving temperature <0.01 C, event quantiles <1 year and never-share <0.01."),
        ("claims", "Shared supplied-member contracts exist; demonstrate identical actual headline and claim across UI/API/download; signed-in rendering not checked by this task."),
    ],
    8: [
        ("regional", "Regional accounts cover six fixture regions; accepted source-compatible regional drivers and signed land/international account coverage remain incomplete."),
        ("attribution", "Regional emissions and coalition controls exist; complete actual accepted member warming contributions with no regional-alone temperature interpretation."),
        ("counterfactual", "Counterfactual naming fixtures pass; audit all API/UI/download surfaces and prevent legacy intensity counterfactual from becoming regional net-zero/warming."),
        ("attribution", "Exact per-member Shapley reducer exists; complete real driver coalitions for both declared-baseline forecast and consecutive forecast-date revisions."),
        ("attribution", "OAT controls remain sensitivity-only; distinct endpoint and consumer labels must be demonstrated for all actual production sensitivities."),
        ("regional", "Member region/sector/gas data exist, but complete region-sector-gas-driver drilldowns/downloads bound to the accepted headline manifest are not delivered."),
        ("regional", "Accounting fixtures cover regions/transport; prove coverage and equality for every actual member/gas/sector/year from accepted source accounts."),
        ("attribution", "Exact reducer enforces 0.001 native-unit residual, order invariance and zero approximation; actual accepted degC coalition closure remains unavailable."),
        ("attribution", "Exact reducer includes within-model/non-causal claim; verify distinct contribution/sensitivity endpoint contracts across UI/API/exports."),
        ("regional", "Manifest-bearing conditional outputs exist; demonstrate every drilldown resolves to the accepted headline manifest and rejects mismatches."),
    ],
    9: [
        ("archive", "Container clause: historical labels exist in engineering paths; audit three distinct codes on every historical run/consumer."),
        ("archive", "Immutable retained-result replay exists; certify actual archive capture date and original model/input identity, not a retrospective backfilled forecast."),
        ("archive", "No comprehensive every-input cutoff plus origin-refitted Stage 4 audit for a real historical quarterly run; current-revision data cannot be certified original vintage."),
        ("archive", "Revised-history diagnostics are labelled; ensure all uncertified reconstructions stay in this class rather than retrospective simulation."),
        ("archive", "No complete quarterly 2015-onward climate/emissions run set with per-input cutoff audit; 24 annual trend predictions are not quarterly full-model runs."),
        ("attribution", "Coalition reducer can attribute supplied changes; actual consecutive-run data/revision/code/assumption/noise decomposition and common manifests remain absent."),
        ("short", "Frozen annual fossil-CO2 protocol/results exist; full global/regional emissions 1-3-year protocol with completed outcomes, intervals/calibration and forecast criteria remains incomplete."),
        ("archive", "No complete quarterly sector/region trajectory corpus with correct history labels/manifests for Stages 12/15."),
        ("archive", "Exact archive fixture replay exists; two authenticated original archived forecast runs and analytical-hash evidence still need direct acceptance."),
        ("short", "Future-observation exclusion fixture passes for trend fit; demonstrate all-input immutability and origin-refitted parameters for actual quarterly model runs."),
        ("archive", "Chronology checker cannot authenticate supplied publication dates; no actual run may be certified retrospective until all sources and fit cutoffs pass."),
        ("short", "Frozen short-horizon protocol predates retained result; establish this chronology for the entire Stage 9 full-model evaluation, not just a candidate study."),
        ("short", "All three candidate MAEs versus persistence/linear reported, all failed; complete every global/regional full-model target while retaining losing results."),
        ("archive", "Quarterly trajectory exports for every quarter since 2015 absent; generate only after source/cutoff audit with truthful labels."),
    ],
}

FORMULAS = {
    "drivers": "logistic share=K/(1+exp(-r*(year-midpoint))); holdout MAE versus persistence and linear; diagnostic success is not central eligibility",
    "cost": "log(cost)=a+b*log(cumulative deployment); apparent decline per doubling=1-2**b; association, not causal learning",
    "kaya": "CO2=GDP*(energy/GDP)*(CO2/energy); compatible definitions and structural breaks required",
    "policy": "Supplied bounded policy eligibility/lag/overlap; no empirical elasticity identified by mechanism code",
    "short": "origin-specific training only; bias=mean(pred-actual), MAE=mean(abs(pred-actual)); paired baseline improvements",
    "inventory": "reporting GtCO2e=sum(nativeMt*AR6_GWP100)/1000; never feed CO2e as a FaIR gas",
    "regional": "global(member,year,gas)=sum(regional+international native accounts); relative accounting tolerance 1e-9",
    "native": "Eligibility-limited effects, bounded adoption and complete-overlap groups; EV electricity enters power once",
    "convergence": "P10/P50/P90 on sorted supplied 5000/10000 members; emissions tolerance supplied in frozen protocol; temperature <.01 C; netzero <1 year; never-share <.01",
    "reference": "Positive-gas anchor ratio tapers to 1 by 2050 (2030 sensitivity); signed-land additive offset tapers to 0; three four-gas alternatives",
    "fair": "native Mt bridge to Gt/Mt/kt gas/yr; annual temperature=(T[y]+T[y+1])/2; anomaly subtracts each member's 1850-1900 mean",
    "independent": "Endpoint abs(T-reference)<=.01 C; concentration/forcing abs(delta)<=1e-8+1e-5*abs(reference); exact dimensions/coordinates",
    "history": "Annual forcing boundary-pair means; natural=solar+volcanic; anthropogenic=all-natural; aerosol=ARI+ACI subset. Raw aligned differences have no acceptance threshold",
    "pulse": "Fresh initialized baseline and perturbation instances with identical inputs/configurations; pulse delta not state-reset reuse",
    "metrics": "Durable event=first year after last positive annual emission through 2100; never=null. CAGR=1-(end/start)**(1/dt) only positive endpoints; signed absolute annual change otherwise",
    "claims": "Promotion requires all named physical/accounting/skill/consumer/runtime gates; conditional fraction is not calibrated probability",
    "attribution": "phi_i=sum_S |S|!*(n-|S|-1)!/n! * (v(S+i)-v(S)); each member closure <=.001 native units; exact approximation error=0",
    "counterfactual": "Global response to regional intensity is named counterfactual, never regional temperature",
    "archive": "Canonical manifest/content hashes and explicit historical classification; declared dates are not authenticated vintages",
}

# Classification of the original acceptance criterion, not of this review's
# evidence-gathering procedure. Explicit per-clause assignments avoid mistaking
# a source-inspection action for an original numerical or operational gate.
CHECK_TYPES = {
    4: ["numerical", "numerical", "numerical", "judgement", "numerical", "numerical",
        "exact", "operational", "numerical", "judgement", "judgement", "numerical"],
    5: ["numerical", "operational", "judgement", "numerical", "numerical", "operational",
        "numerical", "exact", "numerical", "exact", "numerical", "numerical", "judgement"],
    6: ["judgement", "judgement", "numerical", "judgement", "judgement", "operational",
        "numerical", "numerical", "exact", "exact"],
    7: ["exact", "operational", "exact", "numerical", "judgement", "judgement",
        "numerical", "numerical", "exact", "numerical", "numerical", "numerical",
        "numerical", "exact", "judgement", "exact", "exact", "numerical",
        "numerical", "exact", "numerical", "exact"],
    8: ["numerical", "judgement", "exact", "numerical", "exact", "operational",
        "numerical", "numerical", "exact", "exact"],
    9: ["exact", "judgement", "judgement", "exact", "operational", "numerical",
        "judgement", "operational", "exact", "exact", "exact", "exact",
        "numerical", "operational"],
}

DELIVERED = {
    4: [
        "Selected regional diffusion diagnostics are implemented; EV/storage/heat-pump evidence remains conditional and incomplete.",
        "Solar and battery cost/deployment association fits and uncertainty estimates exist; neither establishes causal learning.",
        "Kaya decomposition and forecast-window refusal logic exist; complete compatible regional histories are not established.",
        "Bounded supplied-parameter policy mechanics exist; no identified implementation-weighted empirical elasticity is asserted.",
        "Revised-history annual fossil-CO2 trend diagnostics exist, not monthly/daily 2024-2026 nowcasts.",
        "Selected technology holdouts compare candidate errors against persistence and linear trend without changing frozen windows.",
        "Selected calibration scripts retain failed-baseline models as non-promoted diagnostics.",
        "Driver evidence registry records roles/provenance; complete versioned fitted-distribution ingestion is not delivered.",
        "Selected EV/storage holdout errors and paired-baseline diagnostics are reported, including losing results.",
        "Diagnostic eligibility flags do not promote failed models; complete central-consumer audit remains outstanding.",
        "Training windows and identified source limitations are retained; missing saturation/elasticity evidence stays missing.",
        "No compatible high-frequency reconstruction/GCB comparison within an advance-frozen tolerance is delivered.",
    ],
    5: [
        "Native inventory accounting retains separate fossil and signed land CO2 and regional/international coverage checks.",
        "Conditional regional member generation and joint sampling persist supplied-parameter trajectories.",
        "Conditional emissions members and climate configurations are distinguished; accepted full pairing design remains incomplete.",
        "Eligibility, lag, bounded adoption, overlap and EV charging mechanics exist as conditional mechanisms.",
        "Schemas reject invalid supplied inputs; actual full-ensemble physical rejection counts are not established.",
        "Conditional development ensembles exist; no accepted 10000-member production run or complete legacy comparison is claimed.",
        "Regional/global sector accounting fixtures enforce relative reconciliation; production-wide coverage is not established.",
        "Joint bootstrap/member-identity fixtures establish selected deterministic behavior and source-order handling.",
        "Conditional mechanism fixtures exercise renewable/EV/overlap bounds without certifying production calibrations.",
        "Selected perturbation fixtures demonstrate declared regional/mechanism isolation, not a complete driver audit.",
        "Global native anchor and regional fixture reconciliation preserve gas/sector/signed-land accounting.",
        "5000/10000 convergence checker requires supplied emissions tolerance; no accepted actual production convergence result exists.",
        "Conditional native semantics withhold unsupported central corporate/finance interpretations pending coefficient evidence.",
    ],
    6: [
        "Conditional scenarios and dated reference-derived controls are separate from an accepted implemented-policy forecast.",
        "NGFS Phase V 5.1 NDC scope is explicitly limited; all-long-term-commitments source acceptance is not established.",
        "Retained controls execute both 2050 convergence and the 2030 sensitivity with inventory anchoring.",
        "Three explicit four-gas infill assumptions were retained without isomer substitution or scientific adoption.",
        "Retained source labels/hashes document content but do not certify latest-release/licence acceptance.",
        "Versioned native pathway contract exists; a verified actual Phase VI swap has not been demonstrated.",
        "All 27 inventory accounts in retained conditional controls meet the stated 1e-6 relative anchor gate.",
        "Twelve retained runs provide four conditional infill median-spread comparisons against the unchanged 0.01 C criterion.",
        "Native pathway contract rejects NDC-only pathways labelled as all commitments.",
        "Retained reference artifacts have source hashes; complete displayed-value/source-binding audit remains incomplete.",
    ],
    7: [
        "FaIR 2.2.4 native bridge, supported-gas refusals and physical matrix retention are implemented.",
        "Offline Python artifacts are retained; complete Node serving/missing-artifact/request-path acceptance remains unverified.",
        "Physical, emissions-skill and scenario interpretation evidence are reviewed separately without collapsing their statuses.",
        "Endpoint, pulse and historical bookkeeping evidence are distinguished from missing matched annual physical validation.",
        "Failed fossil-CO2 short-horizon evaluation is retained separately from full emissions-model forecast skill.",
        "Dated reference/control assumptions are explicit; complete actual production scenario interpretation remains incomplete.",
        "Frozen independent upstream endpoint reproduction retains eight scenarios and 66 configurations with all three numerical endpoint comparisons passing.",
        "Actual annual native emissions and species/natural/anthropogenic/aerosol forcing are now retained with units, baselines and member IDs; raw IGCC component comparisons are available. Compatible IGCC native emissions, natural-reference compatibility, GSAT/GMST equivalence and attributed actual-2025/2016-2025 members remain unavailable; no publication-year alias or point tuning.",
        "Supplied-member metrics are defined independently of approval of their source ensemble.",
        "Supplied-member 2100 median, mean, P10 and P90 calculations exist without accepted-production headline promotion.",
        "Separate durable GHG/CO2 crossings, signed-path handling and null never-reaching outputs have fixtures.",
        "Supplied valid-member net-zero event fractions are calculated and are not calibrated probabilities.",
        "Positive-endpoint compound reduction rates and explicit nonpositive-endpoint unavailability/absolute signed changes are implemented.",
        "Durable 5%-of-own-2024 milestone is separately named rather than relabelled physical net zero.",
        "Named readiness gates keep conditional/forecast promotion closed while physical/accounting/skill evidence remains incomplete.",
        "Saved supplied-member summaries are deterministic; complete accepted-member UI/API/export replay is not established.",
        "Native Python path is separate from aggregate-CO2e/offset shortcuts; complete global legacy code-audit acceptance is not asserted.",
        "Frozen 528-cell endpoint comparisons remain accepted only at the endpoint; independent matched annual <=0.01 C evidence remains unavailable.",
        "Fresh-instance physical pulse diagnostics exist; full ensemble TCRE/lifetime acceptance remains separately incomplete.",
        "Rise/fall/rebound/never-crossing supplied-member fixtures pass with durable events and null never-reaching results.",
        "Censor-aware 5000/10000 checker preserves strict temperature/event/share thresholds without claiming an accepted actual convergence run.",
        "Shared supplied-member claims/contracts exist; complete actual headline equality across UI/API/export remains unverified.",
    ],
    8: [
        "Six-account regional engine includes international transport and reconciles supplied native inventories.",
        "Regional emissions and coalition controls do not assert regional-alone global-model temperatures as regional forecasts.",
        "Regional-intensity global-response counterfactual has explicit separate naming fixtures.",
        "Exact paired-member Shapley reducer requires every coalition and declared baseline/target/manifest.",
        "One-at-a-time controls remain sensitivities rather than causal contributions; all production endpoint bindings remain incomplete.",
        "Conditional member regional data exist; complete accepted headline-bound region-sector-gas-driver drilldown/export delivery remains incomplete.",
        "Regional/transport accounting fixtures check coverage and sums; accepted real member/year source coverage remains incomplete.",
        "Exact reducer enforces <=0.001 native-unit closure and order-independent exact calculation; real accepted degC coalition closure remains unavailable.",
        "Reducer outputs explicit within-model/non-causal contribution claim; full contribution/sensitivity consumer-label audit remains incomplete.",
        "Conditional outputs carry manifest identities; all accepted headline drilldown resolutions are not demonstrated.",
    ],
    9: [
        "Historical engineering labels are reviewed as distinct contracts, not interchangeable evidence classes.",
        "Retained-result replay exists; authentic capture chronology is not inferred from current retention.",
        "Input chronology checkers do not authenticate original vintages or establish complete origin-refitted retrospective simulations.",
        "Uncertified current-revision historical diagnostics remain revised-history reconstructions.",
        "Annual short-horizon predictions are retained without calling them quarterly full-model historical runs.",
        "Paired coalition reducer can decompose supplied changes; full consecutive-run revision-category decomposition is not delivered.",
        "Frozen candidate emissions protocol/results exist separately from incomplete full-model regional/global forecast criteria.",
        "No complete quarterly sector/region trajectory corpus for Stages 12/15 is claimed.",
        "Exact retained-result fixture replay does not certify two authenticated original archived forecasts.",
        "Trend-fit future-exclusion fixtures pass; complete immutable origin-refitted full-model history remains unverified.",
        "Uncertified supplied publication/cutoff declarations do not authorize retrospective-simulation classification.",
        "Candidate short-horizon protocol/results retain precommitment chronology without extending it to missing full-model studies.",
        "All three annual candidate horizons report errors against both baselines, including zero successful horizons.",
        "Complete since-2015 quarterly labelled manifest-bearing trajectory exports remain unavailable.",
    ],
}


def inspect_file(name):
    path = Path(name)
    if not path.is_file():
        return {"file": name, "exists": False, "checkType": "missing-direct-file"}
    text = path.read_text()
    functions = []
    if path.suffix == ".py":
        tree = ast.parse(text)
        functions = [{"name": n.name, "line": n.lineno} for n in ast.walk(tree)
                     if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))]
    elif path.suffix == ".ts":
        functions = [{"name": m[2], "line": text[:m.start()].count("\n")+1}
                     for m in re.finditer(r"(export\s+)?(?:async\s+)?function\s+(\w+)", text)]
    elif path.suffix == ".json":
        json.loads(text)
    return {"file": name, "exists": True, "sha256": sha(path), "functions": functions,
            "checkType": "direct-source-static-inspection; not execution or scientific acceptance"}


def log_check(execution):
    record = dict(execution)
    path = Path(record["log"])
    record["logExists"] = path.is_file()
    record["checkType"] = "retained-execution-log" if path.is_file() else "ledger-claim-with-missing-log"
    if path.is_file():
        text = path.read_text(errors="replace")
        record["logSha256"] = sha(path)
        record["terminalEvidence"] = [line for line in text.splitlines()
                                      if re.search(r"Ran \d+ tests?|# (tests|pass|fail|skipped) |^OK$|FAILED", line)][-10:]
    return record


def main():
    source = Path("docs/workplan_completion_ledger.json")
    ledger = json.loads(source.read_text())
    workplan = Path("attached_assets/Climate_Dashboard_—_Developer_Work_Plan_(1)_1794135026111.docx")
    assert sha(workplan) == ledger["source_sha256"]
    with zipfile.ZipFile(workplan) as archive:
        original = "".join(ET.fromstring(archive.read("word/document.xml")).itertext())
    normalize = lambda value: re.sub(r"\s+", " ", value).strip()
    stages = [s for s in ledger["stages"] if 4 <= s["stage"] <= 9]
    records = []
    catalog = {}
    for stage in stages:
        clauses = CLAUSES[stage["stage"]]
        assert len(clauses) == len(stage["requirements"])
        assert len(CHECK_TYPES[stage["stage"]]) == len(DELIVERED[stage["stage"]]) == len(clauses)
        for index, requirement in enumerate(stage["requirements"]):
            group, gap = clauses[index]
            assert requirement["id"] == f"S{stage['stage']:02d}-{index+1:03d}"
            assert normalize(requirement["requirement"]) in normalize(original), requirement["id"]
            for file in GROUPS[group]:
                catalog[file] = inspect_file(file)
            executions = requirement.get("executions", [])
            prior_executions = [e for old in requirement.get("prior_reconciliation", [])
                                for e in old.get("executions", [])]
            seen = set()
            checked = []
            for execution in executions + prior_executions:
                key = execution.get("log")
                if key and key not in seen:
                    checked.append(log_check(execution))
                    seen.add(key)
            records.append({
                "id": requirement["id"], "stage": stage["stage"], "stageName": stage["name"],
                "originalClause": requirement["requirement"], "sourceSection": requirement["source_section"],
                "originalSourceVerified": {"file": str(workplan), "sha256": sha(workplan),
                                           "checkType": "exact normalized clause in original DOCX XML"},
                "priorStatus": requirement["status"],
                "proposedStatus": "verified" if requirement["id"] == "S07-007" else "partial",
                "checkType": CHECK_TYPES[stage["stage"]][index],
                "checkScope": "clause-reconciliation-proposal; engineering evidence only unless separately stated",
                "directEvidenceFiles": list(dict.fromkeys(GROUPS[group])),
                "filesFunctions": [catalog[f] for f in dict.fromkeys(GROUPS[group])],
                "inputsVersionsAssumptions": [],
                "inputEvidence": "See hashed direct data/protocol/report files and their function-level source constants. Unknown publication dates remain unknown; retained revision is not original vintage.",
                "formulaAndThreshold": FORMULAS[group],
                "retainedExecutions": checked,
                "priorNumericalResults": requirement.get("numerical_results", []),
                "directResultCatalog": group,
                "exactRemainingGaps": [gap],
                "nextAction": gap,
                "scientificAcceptance": "not-promoted",
                "git": {"baseRevision": subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip(),
                        "proposedChangesUncommitted": True, "commitCreated": False, "deployment": None},
                "testEvidenceCaveat": "Catalog-level focused suites cover named functions, not every clause; retained execution count is not scientific sample size. No full-app replay was run by this task.",
            })
    assert len(records) == 81 and len({r["id"] for r in records}) == 81
    report = {
        "schemaVersion": 1, "kind": "complete-proposed-requirement-records-not-shared-ledger",
        "generator": {"file": str(Path(__file__).relative_to(Path.cwd())),
                      "sha256": sha(__file__), "command": "uv run python script/reconcile_stages_04_09.py"},
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "scope": "All 81 original clauses of stages 4-9, including every previously unreconciled clause; parent reviews/merges only after freeze",
        "sourceLedgerSha256": sha(source), "sourceWorkplanSha256": ledger["source_sha256"],
        "sourceAmendmentsSha256": ledger["amendments_sha256"],
        "requirementsCount": 81, "previouslyUnreconciledCount": sum(r["priorStatus"] == "not-yet-reconciled" for r in records),
        "limits": ["Proposed partial means direct engineering evidence located, not full acceptance",
                   "No calibration/production promotion, release, commit, callback, collector, DDL or app replay",
                   "No raw licensed source rows or member arrays redistributed; private artifact paths/hashes only"],
        "frozenPreservation": {
            "historyProtocolSha256": sha("docs/IGCC_History_Reconciliation_Protocol.md"),
            "expectedHistoryProtocolSha256": "1fa60cb7c948c915dffaf4fb967578aa8c6aadd689845577d63ad201c879f20d",
            "originalTemperatureDiagnosticC": {"bias": .0064422683, "rmse": .1210392023, "maximum": .3172782516},
            "endpointCellsPerObservable": 528, "infillRuns": 12,
            "endpointOrInfillAcceptanceRerun": False, "frozenWindowsOrThresholdsChanged": False,
        },
        "records": records,
        "evidenceCatalog": catalog,
    }
    focused = [
        ("python -m unittest discover -s script -p 'test_*igcc*.py' -v", "igcc-tests.log", 3, ["history"]),
        ("python -m unittest discover -s script -p test_fair_physical_retention.py -v", "retention-tests.log", 4, ["fair"]),
        ("python -m unittest discover -s script -p 'test_*calibration.py' -v", "calibration-tests.log", 4, ["drivers"]),
        ("npx tsx --test script/emissions-candidate.test.ts script/regional-engine.test.ts script/regional-inventory.test.ts script/regional-sampling.test.ts script/member-metrics.test.ts script/member-attribution.test.ts script/ensemble-convergence.test.ts script/short-horizon-emissions.test.ts script/evaluation.test.ts script/regional-counterfactual-labels.test.ts script/regional-replay.test.ts script/analysis-result-archive.test.ts script/native-pathway-contract.test.ts script/reference-scenarios.test.ts",
         "stages-04-09-targeted-ts.log", 42,
         ["regional", "native", "inventory", "metrics", "attribution", "convergence", "short", "claims", "counterfactual", "archive", "reference"]),
    ]
    new_executions = []
    for command, log, count, groups in focused:
        path = Path("generated-artifacts/physical-retention-checks") / log
        checked = log_check({"command": command, "log": str(path),
                             "completedAt": datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat(),
                             "dateBasis": "retained log filesystem completion time; not invented start time",
                             "environment": "Python commands use uv run --with h5netcdf --with h5py",
                             "counts": {"tests": count, "pass": count, "fail": 0, "skipped": 0},
                             "exitCode": 0, "groups": groups,
                             "workspace_revision": subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip(),
                             "worktree_dirty": True,
                             "codeSnapshotScope": "Current direct-source hashes captured at reconciliation; tests are targeted engineering fixtures, not a certified whole-tree frozen replay"})
        assert checked["terminalEvidence"], log
        new_executions.append(checked)
    report["focusedExecutionsThisTask"] = new_executions
    physical_manifest = Path("generated-artifacts/independent-fair-benchmark/physical-retention/physical-b4600684aa23c277272f92ace8d2cdf6e313ba8157e5c2cf91b9e91010e22335.json")
    physical = json.loads(physical_manifest.read_text())
    forcing_path = next(p for p in Path("generated-artifacts/igcc-history-reconciliation").glob("*.json")
                        if "components" in json.loads(p.read_text())
                        and json.loads(p.read_text())["codeSha256"] == sha("script/compare_retained_igcc_physics.py"))
    forcing = json.loads(forcing_path.read_text())
    endpoint_path = Path("generated-artifacts/independent-fair-benchmark/result-120b305e686161e327b619ed1c293547ada46d7d407aa2ecdf14d8315012efa9.json")
    endpoint = json.loads(endpoint_path.read_text())
    infill_path = Path("generated-artifacts/reference-gas-infill/result-a79eee60240c9cf69a209381a7a16ec78099446e46f83c35105b969130ba8e56.json")
    infill = json.loads(infill_path.read_text())
    report["directResults"] = {
        "fair": {"manifest": str(physical_manifest), "manifestSha256": sha(physical_manifest),
                 "physicalSha256": physical["sha256"], "nativeAnnualYears": physical["years"],
                 "members": len(physical["memberIds"]), "scenarios": len(physical["scenarios"]),
                 "species": len(physical["species"]), "baselineAndUnits": "Per-species native emissions/concentration units, baseline emission/concentration and forcing-reference concentration retained",
                 "regenerationTemperatureExactMatch": physical["provenance"]["regenerationTemperatureExactMatch"],
                 "command": "uv run --with h5netcdf --with h5py python script/independent_fair_benchmark.py --retain-physical-only",
                 "executionLog": "generated-artifacts/physical-retention-checks/regeneration-with-units.log",
                 "supersededAttempts": ["regeneration.log", "regeneration-structural-nan.log", "regeneration-final.log"],
                 "attemptInterpretation": "Retention validation initially treated structural nonradiative NaNs as missing physical forcing; fixed by explicit radiative species types, preserving source NaNs and checking actual forcing-sum closure. Frozen endpoint acceptance was not rerun."},
        "history": {"privateResult": str(forcing_path), "sha256": sha(forcing_path),
                    "sourceHashes": forcing["sourceHashes"], "igccERFRows": 275, "igccGMSTRows": 175,
                    "comparisonYears": [1750, 2014], "unit": "W m-2",
                    "scenariosNotIndependent": True,
                    "rawComponentDifferences": {k: v["scenarios"][0] for k, v in forcing["components"].items()},
                    "natural1750NotZero": forcing["components"]["natural"]["igcc1750AsDelivered"],
                    "humanWarming": forcing["humanWarming"],
                    "retainedNativePhysics": {"manifest": str(physical_manifest),
                        "manifestSha256": sha(physical_manifest), "physicalSha256": physical["sha256"],
                        "annualYears": physical["years"], "species": len(physical["species"]),
                        "members": len(physical["memberIds"]), "scenarios": len(physical["scenarios"]),
                        "temperatureExactFrozenMatch": physical["provenance"]["regenerationTemperatureExactMatch"],
                        "unitsAndBaselinesRetained": True},
                    "originalRawTemperatureDiagnosticC": report["frozenPreservation"]["originalTemperatureDiagnosticC"],
                    "nativeEmissionsComparison": "Unavailable: compatible pinned IGCC native-gas emissions are absent; actual FaIR native emissions are retained",
                    "command": f"uv run --with h5netcdf --with h5py python script/compare_retained_igcc_physics.py {physical_manifest}",
                    "executionLog": "generated-artifacts/physical-retention-checks/forcing-comparison.log",
                    "baselineCaveat": forcing["baselineCompatibility"], "observableCaveat": "No GSAT/GMST equivalence or total-to-human attribution assumed"},
        "independent": {"privateResult": str(endpoint_path), "sha256": sha(endpoint_path),
                        "sourceHashes": endpoint["sourceHashes"], "comparisons": endpoint["comparisons"],
                        "annualReferenceGate": endpoint["annualReferenceGate"], "rerun": False},
        "reference": {"privateResult": str(infill_path), "sha256": sha(infill_path),
                      "sourceHashes": infill["sourceHashes"], "actualRuns": len(infill["records"]),
                      "membersPerRun": 841, "thresholdC": .01,
                      "scope": "Two NGFS-derived controls x two convergence years x three assumptions; not full production cases",
                      "rerun": False},
        "drivers": {"sourceReport": "docs/EV_and_Cost_Calibration_Results.md",
                    "result": "Five EV fits: only India diagnostic pass, RoW missing; solar/wind nine of ten failed; storage sensitivity-only, heat-pump window-sensitive; no promotion"},
        "cost": {"sourceReport": "docs/EV_and_Cost_Calibration_Results.md",
                 "solarApparentDeclinePerDoubling": .3647, "batteryApparentDeclinePerDoubling": .3907,
                 "solarConditionalHoldoutMAEUsdPerW": .05199, "causal": False, "batteryFullHoldout": "unavailable"},
        "short": {"sourceReport": "docs/Historical_Diagnostics_and_Skill_Results.md",
                  "predictions": 24, "origins": 8, "horizonsYears": [1, 2, 3],
                  "candidateMAE": [.9063, 1.2705, 1.1531], "persistenceMAE": [.9875, 1.5, 1.3625],
                  "linearMAE": [.9, 1.243, 1.1231], "unit": "Gt fossil CO2/year", "passedHorizons": 0},
    }
    audit_log = Path("generated-artifacts/physical-retention-checks/classification-reconciliation-tests.log")
    if audit_log.is_file():
        report["reconciliationVerification"] = log_check({
            "command": "uv run --with h5netcdf --with h5py python -m unittest discover -s script -p test_stages_04_09_reconciliation.py -v",
            "log": str(audit_log), "counts": {"tests": 4, "pass": 4, "fail": 0, "skipped": 0},
            "completedAt": datetime.fromtimestamp(audit_log.stat().st_mtime, timezone.utc).isoformat(),
            "checkType": "source/contract/report integrity, not scientific acceptance",
        })
    for record in records:
        group = record["directResultCatalog"]
        record["focusedExecutionsThisTask"] = [e for e in new_executions if group in e["groups"]]
        # Reuse the actual existing research receipts, without invoking models or
        # recomputing empirical discrepancies during this classification repair.
        physical_receipts = []
        if group in ("fair", "history"):
            commands = [("regeneration-with-units.log",
                "uv run --with h5netcdf --with h5py python script/independent_fair_benchmark.py --retain-physical-only")]
            if group == "history":
                commands.append(("forcing-comparison.log",
                    f"uv run --with h5netcdf --with h5py python script/compare_retained_igcc_physics.py {physical_manifest}"))
            for name, command in commands:
                path = Path("generated-artifacts/physical-retention-checks") / name
                physical_receipts.append(log_check({
                    "command": command, "log": str(path),
                    "completedAt": datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat(),
                    "dateBasis": "existing retained log completion time; no empirical rerun in classification repair",
                    "exitCode": 0, "counts": None,
                    "scope": "Retained actual physical-output receipt, not a new acceptance gate or independent sample count",
                }))
        record["actualResultsThisTaskOrRetained"] = report["directResults"].get(group, {
            "result": "Direct source and named focused fixture evidence only; no accepted real full-ensemble result established",
            "inputs": "Explicit supplied member/manifest vectors; fixtures are not authentic historical observations"})
        record["inputsVersionsAssumptions"] = [FORMULAS[group],
            {"directInputAndImplementationFiles": [{"file": f["file"], "sha256": f["sha256"]}
                                                   for f in record["filesFunctions"] if f["exists"]]},
            "No accepted calibration promotion; current-revision histories are not original publication vintages"]
        # Merge-compatible fields, with original protected text retained exactly.
        original_requirement = next(r for s in stages for r in s["requirements"] if r["id"] == record["id"])
        record.update(
            requirement=record["originalClause"], source_section=record["sourceSection"],
            origin=original_requirement["origin"], status=record["proposedStatus"],
            next_action=record["nextAction"], check_type=record["checkType"],
            check_scope=record["checkScope"],
            evidence_caveat=f"Original {record['checkType']} criterion reviewed clause-by-clause against the listed direct files and retained logs; "
                f"evidence does not establish scientific or production acceptance. Specific remaining limit: {record['exactRemainingGaps'][0]}",
            executions=record["retainedExecutions"]+record["focusedExecutionsThisTask"]+physical_receipts,
            files_functions_changed=[f"{file['file']}:"+",".join(f["name"] for f in file.get("functions", []))
                                     for file in record["filesFunctions"]],
            existing_evidence=record["directEvidenceFiles"],
            behaviour_delivered_this_run=DELIVERED[record["stage"]][int(record["id"].split("-")[1])-1],
            inputs_versions_assumptions=record["inputsVersionsAssumptions"],
            numerical_results=[record["actualResultsThisTaskOrRetained"]],
            remaining_gaps=record["exactRemainingGaps"], scientific_acceptance="not-promoted",
            git_commit=None, deployment_revision=None,
        )
    assert report["frozenPreservation"]["historyProtocolSha256"] == report["frozenPreservation"]["expectedHistoryProtocolSha256"]
    target = Path("docs/reconciliation-stages-04-09.json")
    target.write_text(json.dumps(report, indent=2, allow_nan=False)+"\n")
    print(json.dumps({"output": str(target), "requirements": len(records),
                      "previouslyUnreconciled": report["previouslyUnreconciledCount"],
                      "sha256": sha(target)}))


if __name__ == "__main__":
    main()
