"""Merge existing receipts only; never run checks, promote statuses, or release code."""
import argparse
import copy
import datetime
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import tempfile

ROOT = Path(__file__).resolve().parent.parent
KEY = "transport_drilldown_increment"
CONTRACT = "5e1a09aa71c87286779eb444db2e0b0361015b3d1bfb058e320f836ca46b4de5"
FILES = {
    "S02-009": "docs/disposable-cache-transport-evidence.json",
    "S08-005": "docs/headline-drilldown-evidence.json",
    "S08-006": "docs/headline-drilldown-evidence.json",
    "S08-009": "docs/headline-drilldown-evidence.json",
    "S08-010": "docs/headline-drilldown-evidence.json",
    "S16-004": "docs/retained-backtest-surface-evidence.json",
    "S12-017": "docs/qualified-primary-inputs-evidence.json",
    "S04-001": "docs/qualified-primary-inputs-evidence.json",
}
GAPS = {
    "S02-009": "Real disposable PostgreSQL transport now executed: company HTTP/calculator/material/archive round-trip and persistent helper namespaces passed. Six route-local mutation/TTL matrices remain distinct from PostgreSQL transport; application default MemStorage is not deployed PostgreSQL acceptance. Authorized refresh/DELETE lifecycle remains unexecuted: no genuine supported HTTP principal/importer; DEV/loopback/DB ownership is not authority. No production clear/delete/DDL. Finish exact original cache identity coverage and genuine authorized invalidation without bypass.",
    "S08-005": "Selected retained native candidates now have separately labelled one-driver-group-at-a-time sensitivity JSON/XLSX endpoints, distinct from additive within-model contributions. This verifies a supported local native-candidate surface only, not every production sensitivity or an accepted ensemble. Retain exact original endpoint/label acceptance for remaining actual consumers.",
    "S08-006": "Selected retained native candidate sector/gas/driver drilldowns and JSON/XLSX now reconcile to exact parent headline identity. Available source parent is Global only: no source regional allocation, six-region parent or accepted regional ensemble. Unsupported region/international-transport selectors refuse; synthetic signed-land/AIR/SEA controls are not source regional evidence. Full region × sector × gas × driver criterion remains partial.",
    "S08-009": "Separate contribution/sensitivity routes, derivation identities and labels are implemented on supported retained native candidates; contributions are explicitly within-model, sensitivities nonadditive, neither causal. Need full actual accepted production UI/API/export coverage; local engineering checks do not establish scientific or owner acceptance.",
    "S08-010": "Supported local retained-native drilldowns verify exact parent result/manifest/material/source/model/member/seed and derived content identity, rejecting mismatches. No accepted six-region headline source allocation or accepted full ensemble supplied. Continue exact accepted-headline and all-consumer scope; isolated immutable storage execution is not production persistence/publication.",
    "S16-004": "Actual unchanged paired pipeline is wired through retained public projection, eight-pin reviewed offline publisher, store, HTTP, browser verification and renderer. Real source-reviewed catalog remains empty; no authorized real retained paired research report, original-vintage/Stage9 authentication, independent prospective archives or redistribution approval supplied. WITHHELD; scientificAcceptance/investmentEvidence/authenticityVerified false. Empty catalog and synthetic DEV engineering reports do not satisfy scientific protocol/results/factor/robustness acceptance. Historical runtime/transitive dependency authentication remains unavailable.",
    "S12-017": "Six bounded primary-content reviews provide new scoped legal/operating/cash-category findings, but zero qualified original issuer economic-input pairs and zero common-FCFE insertion. FSLR §45X future integrated-component rule must not be backdated to 2026; eligible US watts/BOM/PFE/company eligibility and India grant amount/day/FX/classification remain unknown. NEER category totals/XPLR ownership and payer outflows are known, not named-LLC-to-NEE gross recipient cash, actual reserve/election priorities or commissioning marginal returns. Nucor live CCS status is known, not executed priced subsidiary instruments/novation, invoices/collection/opex/funded common cash waterfall. Preserve historical LLC terms, India receipt month, EnLink expected-recognition schedule and Williams volume in their proper scopes. Original utility/oil-and-gas/industrial requirement and all market/stub/identity/terminal gates remain: 0/3 qualified cases; FSLR does not silently replace original industrial.",
    "S04-001": "Two new primary research/policy contents supply contextual capacity/scenario ceilings only, not independently sourced regional solar/wind generation-share K or reviewed machine-readable whole joint source/structural/dependence bundles with rights and immutable binding. Zero newly qualified regional saturations/joint bundles; actual fitting/bootstrap/heldout run UNEXECUTED. Preserve fixed 2010–2018 nine-observation train/2019–2024 six-observation holdout, ten cells, 1000 circular-block-3 replications and seed20261108. Nine original baseline failures and EU-solar point-only win remain. Original EV/heat-pump/storage-specific source/window/interval gates also remain; no arbitrary prior, shortened window, independent marginal synthesis or science/central promotion.",
}
DELIVERED = {
    "S02-009": "Disposable PostgreSQL transport passed: 5 company and 3 projection tests, 0 failed/skipped; 7 cache rows, 13 archive headers, 16 chunks, 5 enabled guards. Company witness: 8 analytical receipts/311 real PostgreSQL queries; namespace witness: 5 receipts/12 queries. Separate route-local mutation/matrix witnesses: 6/18 receipts, no PostgreSQL queries. Only regional default has 24h TTL (TTL-1/exact TTL checked). Prior SQL-literal semicolon and historical-selector fixture failures retained; initial implicit-ES5 scoped typecheck corrected to explicit ES2022 without implementation weakening.",
    "S08-005": "Actual constant/transition/dashboard captured native candidates use separate nonadditive sensitivity endpoints/labels and signed additive within-model contribution endpoints; no altered attribution kernel.",
    "S08-006": "Actual inventory: 122 source cells; constant 1 coalition/122 rows, transition 32 coalitions/610 rows, dashboard 4 coalitions/244 rows. Maximum per-cell reconciliation errors 0, 5.4569682106375694e-12, 1.8189894035458565e-12 native Mt respectively. Global headline totals 56.81226234083025/46.50375792679074/41.30313582844237 GtCO2e. These are isolated actual retained-producer diagnostics, not published or accepted research.",
    "S08-009": "Six read-only contribution/sensitivity JSON and XLSX routes plus actual mounted native-review consumer distinguish within-model contributions from nonadditive sensitivity; derived identity never borrows X-Producer-Identity.",
    "S08-010": "Exact parent and canonical derived-content browser verification, post-accounting selectors and corruption/lookalike/member/seed/source/model refusals exercised. 12 new drilldown tests plus 1 existing attribution test passed; 14 existing native export regressions passed separately; typecheck passed.",
    "S16-004": "Existing paired pipeline invoked, not fabricated report metrics: public projection/store/API/browser/renderer and exact eight-pin offline publication boundary. 38 pipeline/frontend/integration tests passed (13 unchanged frontend, 17 unchanged pipeline, 8 new integration); separate 14 Track-B regression tests and typecheck passed. Initial cwd source-module and incomplete two-month CLI engineering-fixture failures corrected; entirely absent periods/artifacts still explicitly unavailable. Parent reports restarted /decarb-gap card now reads 'No authorized retained paired research reports', no browser errors or forced metric; this is local preview, not a new deployed release.",
    "S12-017": "Official §45X module credit 7 cents/DC watt; same-facility integrated-component 65% US direct-material-cost condition expressly prospective for taxable years beginning after 2026-12-31. NEER nine-month unaudited USDm categories: equity-method earnings distributions366 operating, differential-member proceeds1334/payments(597) financing, investments(19044), parent net12409 financing. XPLR Q3 adjusted EBITDA471m/FCFBG164m and Class-B/tax-equity cash34m/8m, exact Sep30 ownership appendix, ~85% of ~180MW repowerings and ~400MW rights sold to NEER are scoped positives, not gross NEE cash or commissioning returns. XOM says Nucor Convent is operating/third commercial CCS operation; Rose up-to5Mt/year for13years is prospective capacity, not billed throughput. Source URLs/locators/dates/extraction hashes/rights and exact limitations retained in evidence.",
    "S04-001": "New Zealand logistic article discusses uncertain early saturation and capacity ceilings; NewClimate draft's combined VRE 70%/30% scenario ceilings and Denmark historical illustration are not technology-specific regional generation-share priors. No numerical prior borrowed or actual fit run. Five discovery calls/six new primary contents/11 fetch calls (five continuations), no request UTC timestamps recorded; extraction hashes identify transformed markdown, not original authenticated PDF/HTTP bytes. Supplementary appendix not acquired; licensing and joint-draw qualification remain unresolved.",
}


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


def requirements(ledger):
    return [r for s in ledger["stages"] for r in s["requirements"]]


def contract(ledger):
    return digest([{k: r.get(k) for k in ("id", "requirement", "source_section", "origin")}
                   for r in requirements(ledger)])


def read_receipt(path):
    raw = path.read_bytes()
    return {"file": str(path.relative_to(ROOT)),
            "sha256": hashlib.sha256(raw).hexdigest(), "detail": json.loads(raw)}


def verified_checks(receipt, history):
    """Authenticate existing execution bytes, not a new execution or acceptance."""
    detail = receipt["detail"]
    if detail.get("exit_code") != 0:
        raise ValueError("Final coherent receipt did not pass")
    expected = {
        "typescript": {"tests": 1129, "pass": 1129, "fail": 0, "skipped": 0},
        "python": {"tests": 248, "pass": 248, "fail": 0, "skipped": 0},
    }
    if detail.get("suite_counts") != expected:
        raise ValueError("Final coherent suite counts differ from reviewed execution")
    log = ROOT / detail["log"]
    if hashlib.sha256(log.read_bytes()).hexdigest() != detail["log_sha256"]:
        raise ValueError("Final coherent log hash mismatch")
    coherent = history["detail"]["coherentExecution"]
    if (coherent["receipt"] != receipt["file"]
            or coherent["receiptSha256"] != receipt["sha256"]
            or coherent["logSha256"] != detail["log_sha256"]
            or coherent["status"] != "passed"):
        raise ValueError("Repair history does not bind this final receipt")
    if len(coherent["mandatoryStagesPassed"]) != 8:
        raise ValueError("Missing mandatory stage evidence")
    # Preserve and authenticate every named original/intermediate receipt and log.
    # Source paths are intentionally not treated as historical execution bytes.
    def walk(value):
        if isinstance(value, dict):
            for key, item in value.items():
                if key in ("receiptSha256", "logSha256") and isinstance(item, str):
                    filename = value.get("receipt" if key == "receiptSha256" else "log")
                    if filename and hashlib.sha256((ROOT / filename).read_bytes()).hexdigest() != item:
                        raise ValueError("Historical evidence hash mismatch: " + filename)
                walk(item)
        elif isinstance(value, list):
            for item in value:
                walk(item)
        elif isinstance(value, str) and value.startswith("generated-artifacts/"):
            if not (ROOT / value).is_file():
                raise ValueError("Historical evidence missing: " + value)
    walk(history["detail"])


def replace_section(text, section):
    start = "<!-- transport-drilldown-increment:start -->"
    end = "<!-- transport-drilldown-increment:end -->"
    block = start + "\n" + section + "\n" + end + "\n"
    if start in text:
        if text.count(start) != 1 or text.count(end) != 1:
            raise ValueError("Ambiguous existing incremental markdown section")
        a, b = text.index(start), text.index(end) + len(end)
        return text[:a] + block.rstrip("\n") + text[b:]
    return block + "\n" + text


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--receipt", default="generated-artifacts/cache-drilldown-report-full-final.json")
    parser.add_argument("--failure-history", default="docs/integrated-contract-repair-evidence.json")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    receipt_path = (ROOT / args.receipt).resolve()
    if not receipt_path.is_file():
        raise SystemExit("Full receipt not available; no documents changed. Run this script again after the existing checks finish; do not launch duplicate checks.")
    receipt = read_receipt(receipt_path)
    if not isinstance(receipt["detail"], (dict, list)) or not receipt["detail"]:
        raise ValueError("Empty/invalid full receipt; no documents changed")
    history = read_receipt((ROOT / args.failure_history).resolve())
    verified_checks(receipt, history)
    ledger_path = ROOT / "docs/workplan_completion_ledger.json"
    original_bytes = ledger_path.read_bytes()
    original = json.loads(original_bytes)
    if len(requirements(original)) != 300 or contract(original) != CONTRACT:
        raise ValueError("Original 300-clause contract/hash changed; manual reconciliation required")
    ledger = copy.deepcopy(original)
    by_id = {r["id"]: r for r in requirements(ledger)}
    evidence = {f: read_receipt(ROOT / f) for f in sorted(set(FILES.values()))}
    identity = digest({"evidence": {f: e["sha256"] for f, e in evidence.items()},
                       "full_receipt": receipt["sha256"], "failure_history": history["sha256"]})
    prior = ledger.get("latest_increment", {}).get(KEY, {})
    stamp = prior.get("recorded_at") if prior.get("evidence_identity") == identity else None
    stamp = stamp or datetime.datetime.now(datetime.timezone.utc).isoformat()
    boundary = {
        "new_work": "Local/development engineering and documentary source qualification only; no release, data approval, scientific promotion, owner acceptance or privileged HTTP activation.",
        "existing_verified_runtime": copy.deepcopy(original.get("current_release")),
        "new_release_verified": False,
        "parent_preview_observation": {
            "path": "/decarb-gap", "workflow_restarted_by_parent": True,
            "message": "No authorized retained paired research reports",
            "browser_errors": False, "forced_metric": False,
            "scope": "Parent-provided local preview observation; supersedes worker's pre-restart route-registration error, not a production release verification.",
        },
    }
    for clause, filename in FILES.items():
        row = by_id[clause]
        previous = row.get(KEY)
        if previous and previous.get("evidence_identity") != identity:
            history = row.setdefault(KEY + "_history", [])
            if previous not in history:
                history.append(previous)
        row.setdefault("before_" + KEY, {
            k: copy.deepcopy(row[k]) for k in
            ("remaining_gaps", "remainingGaps", "exactRemainingGaps", "next_action",
             "nextAction", "blockers", "behaviour_delivered_this_run") if k in row
        })
        row[KEY] = {
            "recorded_at": stamp, "evidence_identity": identity,
            "original_written_criterion": row["requirement"],
            "status_decision": "Retain existing partial status; exact entire written criterion not established.",
            "evidence": evidence[filename], "full_checks_receipt": receipt,
            "failure_history": history,
            "boundary": boundary, "delivered": DELIVERED[clause],
            "remaining_original_scope": GAPS[clause],
        }
        row["behaviour_delivered_this_run"] = DELIVERED[clause]
        row["remaining_gaps"] = [GAPS[clause]]
        for alias in ("remainingGaps", "exactRemainingGaps"):
            if alias in row:
                row[alias] = [GAPS[clause]]
        row["next_action"] = GAPS[clause]
        if "nextAction" in row:
            row["nextAction"] = GAPS[clause]
        for path in (filename, "script/record-transport-drilldown-increment.py"):
            if path not in row["existing_evidence"]:
                row["existing_evidence"].append(path)
    counts = {}
    for row in requirements(ledger):
        counts[row["status"]] = counts.get(row["status"], 0) + 1
    summary = {
        "recorded_at": stamp, "evidence_identity": identity,
        "updated_clauses": list(FILES), "updated_clause_count": 8,
        "status_promotions": 0, "original_criteria": 300, "contract_sha256": CONTRACT,
        "status_counts": counts, "evidence": {f: e["sha256"] for f, e in evidence.items()},
        "full_checks_receipt": receipt, "failure_history": history, "boundary": boundary,
        "reviewed_component_coverage": {
            "reviewed": 77, "prior": 71, "new_headline": 2, "new_paired": 4,
            "evidence": "docs/integrated-contract-repair-evidence.json",
            "scope": "Actual source-reviewed policies and focused SSR evidence for all77 reachable consumers; not interactive-browser or scientific acceptance.",
            "scientificAcceptance": False,
        },
        "preservation": "Original1000/1001; previous S16-007/S16-014 verified receipts; all other clauses, original source/amendment hashes and scientific negatives unchanged. Zero eligible histories/zero of three qualified cases; real report catalog empty; all broad current items stay current original scope, no new follow-up tasks.",
    }
    if prior and prior.get("evidence_identity") != identity:
        history = ledger["latest_increment"].setdefault(KEY + "_history", [])
        if prior not in history:
            history.append(prior)
    ledger["latest_increment"][KEY] = summary
    ledger["updated_at"] = stamp
    # No status, original wording/hash, scientific values, release or non-target clause changes.
    assert contract(ledger) == contract(original) == CONTRACT
    old_by_id = {r["id"]: r for r in requirements(original)}
    for row in requirements(ledger):
        old = old_by_id[row["id"]]
        for field in ("status", "scientific_acceptance", "scientificAcceptance", "numerical_results"):
            assert row.get(field) == old.get(field), (row["id"], field)
        if row["id"] not in FILES:
            assert row == old, row["id"]
    for field in ("source_sha256", "amendments_sha256", "current_release", "stage_status_counts"):
        assert ledger.get(field) == original.get(field), field
    spec = importlib.util.spec_from_file_location("clause_matrix", ROOT / "script/merge-clause-reconciliation.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    # Preserve every non-target matrix row verbatim.
    matrix_path = ROOT / "docs/WORKPLAN_ACCEPTANCE_MATRIX.md"
    matrix_text = matrix_path.read_text()
    new_rows = {line.split(" | ")[0][2:]: line for line in module.matrix(ledger).splitlines()
                if any(line.startswith("| " + clause + " | ") for clause in FILES)}
    if len(new_rows) != 8:
        raise ValueError("Missing matrix clause rows")
    matrix_lines, seen = [], set()
    for line in matrix_text.splitlines():
        clause = line.split(" | ")[0][2:] if line.startswith("| S") else None
        if clause in FILES:
            if clause in seen:
                raise ValueError("Duplicate matrix clause row: " + clause)
            seen.add(clause)
            line = new_rows[clause]
        matrix_lines.append(line)
    if seen != set(FILES):
        raise ValueError("Existing matrix does not contain all eight original clauses")
    section = [
        "## Current transport, headline drilldown, retained-report and primary-source increment",
        "", "Recorded " + stamp + ". **8 original clauses updated; 0 statuses promoted.** "
        "300 criteria and contract SHA-256 `" + CONTRACT + "` preserved.",
        "", "Counts: " + json.dumps(counts, sort_keys=True) + ". Existing verified runtime remains "
        "`6584856eda62dd84e2d951eb767f0d3518f4e075`; new work is local/development only until parent verifies a new release.",
        "Full check receipt: `" + receipt["file"] + "` SHA-256 `" + receipt["sha256"]
        + "`. Exact commands, statuses, counts, failures and logs are retained verbatim in JSON "
        "`latest_increment.transport_drilldown_increment.full_checks_receipt`; no duplicate checks launched.",
         "", "Final coherent execution: **1129/1129 TypeScript; 248/248 Python; 0 failures/skips; "
         "typecheck, all mandatory private validators and production build passed.** "
         "Original failed and intermediate receipts/logs remain preserved under `failure_history`, bound to `"
         + history["file"] + "` SHA-256 `" + history["sha256"] + "`.",
         "", "**All 77 reachable consumers reviewed** (prior71 +2 headline +4 retained-paired), with "
         "actual focused render/source-policy evidence; no interactive-browser or scientific acceptance claimed.",
        "", "Parent's restarted `/decarb-gap` preview correctly shows **No authorized retained paired research reports**, "
        "without browser errors or forced metrics. This supersedes the worker's earlier pre-restart route error only; "
        "it does not authorize a real report or prove science. Regional drilldowns remain partial: Global source only, no source regional allocation.",
    ]
    for clause in FILES:
        section.extend(["", "### " + clause + " — retained " + by_id[clause]["status"],
                        "**Exact original criterion:** " + by_id[clause]["requirement"],
                        "", DELIVERED[clause], "", "**Remaining original scope:** " + GAPS[clause],
                        "", "**Direct source/function/test/failure/log receipt:** `" + FILES[clause]
                        + "` SHA-256 `" + evidence[FILES[clause]]["sha256"] + "`. Full original evidence, "
                        "including source/function lists, commands and unavailable inputs, is embedded under this clause's "
                        "`transport_drilldown_increment.evidence.detail` in the JSON ledger."])
    section.extend(["", summary["preservation"]])
    outputs = {ledger_path: json.dumps(ledger, indent=2, ensure_ascii=False) + "\n",
               matrix_path: "\n".join(matrix_lines) + "\n"}
    for filename in ("WORKPLAN_COMPLETION_LEDGER.md", "WORKPLAN_IMPLEMENTATION_REPORT.md"):
        path = ROOT / "docs" / filename
        outputs[path] = replace_section(path.read_text(), "\n".join(section))
    if args.dry_run:
        print(json.dumps({"dry_run": True, "clause_count": 8, "counts": counts,
                          "status_promotions": 0, "documents": len(outputs)}))
        return
    # Stage all bytes first; detect concurrently changed docs before replacing any file.
    snapshots = {path: path.read_bytes() for path in outputs}
    if snapshots[ledger_path] != original_bytes:
        raise RuntimeError("Ledger changed during merge; rerun against current documents")
    staged = {}
    try:
        for path, text in outputs.items():
            with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent,
                                             prefix="." + path.name + ".", delete=False) as handle:
                handle.write(text)
                staged[path] = Path(handle.name)
        if any(path.read_bytes() != snapshots[path] for path in outputs):
            raise RuntimeError("Concurrent document edit detected; no documents replaced")
        for path, temporary in staged.items():
            os.replace(temporary, path)
    finally:
        for temporary in staged.values():
            temporary.unlink(missing_ok=True)
    print(json.dumps({"updated_clauses": 8, "documents": 4, "status_promotions": 0,
                      "criteria": 300, "counts": counts, "contract_sha256": CONTRACT}))


if __name__ == "__main__":
    main()
