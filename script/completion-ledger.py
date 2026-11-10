#!/usr/bin/env python3
"""Maintain requirement-level evidence without equating tests with acceptance.

The original owner-supplied plan is private. Generated ledgers contain its
requirements, not licensed analytical inputs. Existing reports are pointers,
not automatically treated as verified test executions.
"""
import argparse
from collections import Counter
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from zipfile import ZipFile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
JSON_PATH = ROOT / "docs/workplan_completion_ledger.json"
SOURCE = ROOT / "attached_assets/Climate_Dashboard_—_Developer_Work_Plan_(1)_1794135026111.docx"
AMENDMENTS = ROOT / "docs/Developer_Workplan_Amendments.md"
EVIDENCE = [
    ("CI_Negative_Control.md", "Inventory privileged routes; rehearse isolated recovery; verify single scheduler."),
    ("Output_Controls_Execution.md", "Audit each response field and export against formula/unit/population register."),
    ("Analysis_Wide_Historical_Selection.md", "Investigate production database ownership; provision through supported route; implement complete overlay replay."),
    ("Remaining_Workplan_Execution.md", "Audit all 22 registry entries against every mandatory source/evidence field."),
    ("EV_and_Cost_Calibration_Results.md", "Complete heat-pump/storage/policy/nowcast studies and persist qualified parameter distributions."),
    ("Regional_and_Company_Engine_Execution.md", "Connect qualified distributions; run actual 10,000-member ensemble and convergence."),
    ("NGFS_Pathway_Assessment.md", "Locate compatible commitments inputs; run missing-gas and harmonisation sensitivities."),
    ("Minor_Gas_History_Sensitivity.md", "Reproduce independent SSP benchmark; reconcile history; couple accepted ensemble."),
    ("Regional_Attribution_Controls.md", "Run policy and between-vintage attribution; expose manifest-linked drilldowns."),
    ("Historical_Diagnostics_and_Skill_Results.md", "Implement quarterly origin runs and vintage audits; export every quarterly trajectory."),
    ("Remaining_Workplan_Execution.md", "Audit lifecycle/identity census; assemble review batches and broader financial coverage."),
    ("Valuation_and_Research_Completion_Status.md", "Assemble common-sample historical predictions; complete seven-criterion D8 comparison."),
    ("Company_Accounting_Controls.md", "Source operating exposures and carbon assumptions; execute three climate-linked cases."),
    ("Developer_Workplan_Amendments.md", "Implement evidenced sector mappings and assumption registry; locate confirmed identification thresholds."),
    ("Valuation_and_Research_Completion_Status.md", "Freeze complete research protocol before scoring; generate actual paired new-gap histories."),
    ("Workplan_Status_and_Conclusions.md", "Execute actual new-gap portfolios and full cost/rebalance/lifecycle sensitivity family."),
    ("Analysis_Wide_Historical_Selection.md", "Integrate remaining analyses and verify UI/API/export/approval consistency."),
    ("Application_Logic_and_Implementation.md", "Reproduce completed analyses in clean environment; prepare owner review pack."),
]


def paragraphs(path):
    with ZipFile(path) as z:
        root = ET.fromstring(z.read("word/document.xml"))
    ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    return [
        "".join(t.text or "" for t in p.findall(".//w:t", ns)).strip()
        for p in root.findall(".//w:p", ns)
    ]


def initialise():
    if JSON_PATH.exists():
        raise ValueError("Ledger already exists; refusing to overwrite evidence")
    now = datetime.now(timezone.utc).isoformat()
    stages = []
    stage = None
    section = None
    for text in paragraphs(SOURCE):
        match = re.match(r"Stage (\d+) — (.+)", text)
        if match and int(match[1]) < 18:
            number = int(match[1])
            stage = {"stage": number, "name": match[2], "requirements": []}
            stages.append(stage)
            section = None
            continue
        if not stage or not text:
            continue
        if text == "Developer plan.":
            section = "implementation"
            continue
        if text == "Efficacy test.":
            section = "acceptance"
            continue
        if text.startswith("Report back."):
            section = None
            continue
        if text.startswith(("Sources:", "Total effort", "10. Decision points")):
            section = None
        if section:
            n = stage["stage"]
            report, action = EVIDENCE[n]
            stage["requirements"].append({
                "id": f"S{n:02d}-{len(stage['requirements']) + 1:03d}",
                "source_section": section,
                "requirement": text,
                "status": "not-yet-reconciled",
                "origin": "pre-existing-scope",
                "existing_evidence": [f"docs/{report}"] if (ROOT / "docs" / report).exists() else [],
                "evidence_caveat": "Stage-level report pointer only; this individual requirement is not yet verified.",
                "files_functions_changed": [],
                "behaviour_delivered_this_run": None,
                "inputs_versions_assumptions": [],
                "executions": [],
                "numerical_results": [],
                "scientific_acceptance": "not-assessed",
                "git_commit": None,
                "deployment_revision": None,
                "remaining_gaps": ["Reconcile this exact requirement with code and direct evidence."],
                "next_action": action,
                "blockers": [],
            })
    if [s["stage"] for s in stages] != list(range(18)):
        raise ValueError("Original plan stage extraction is incomplete")
    # Preserve every binding amendment verbatim as separately tracked scope.
    amendment_text = AMENDMENTS.read_text()
    corrections = amendment_text.split("## Corrections incorporated before implementation", 1)[1].split("## Execution ledger", 1)[0]
    amendments = [m.group(0).strip() for m in re.finditer(r"(?ms)^\d+\..*?(?=^\d+\.|\Z)", corrections)]
    ledger = {
        "schema_version": 1, "created_at": now, "updated_at": now,
        "source_sha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        "amendments_sha256": hashlib.sha256(AMENDMENTS.read_bytes()).hexdigest(),
        "scope": "Original stages 0–17 plus all binding amendments; no criteria waived.",
        "baseline_release": {"github": "0a27ef512715c63edf332b604939310588cc0d65", "verification": "Prior-run record; not reverified by ledger creation"},
        "amendments": amendments,
        "stages": stages,
        "run_executions": [],
        "restart": {"next_requirement": "S00-001", "instruction": "Reconcile baseline identity and operational safety; then next actionable requirement. No full-stage acceptance inferred from software checks."},
    }
    JSON_PATH.write_text(json.dumps(ledger, indent=2, ensure_ascii=False) + "\n")
    return ledger


def validate(ledger):
    if [s["stage"] for s in ledger["stages"]] != list(range(18)):
        raise ValueError("All original stages must remain present")
    ids = set()
    for stage in ledger["stages"]:
        for r in stage["requirements"]:
            if r["id"] in ids:
                raise ValueError("Duplicate requirement")
            ids.add(r["id"])
            if not r["next_action"] and r["status"] != "verified":
                raise ValueError("Open requirement without next action")
            for e in r["executions"]:
                for key in ("command", "executed_at", "exit_code", "counts", "log"):
                    if key not in e:
                        raise ValueError(f"Execution missing {key}")
            if r["status"] == "verified" and not r["executions"]:
                raise ValueError("Verified requirement without actual execution evidence")
    return len(ids)


def refresh_summary(ledger):
    ledger["stage_status_counts"] = {
        str(stage["stage"]): dict(Counter(r["status"] for r in stage["requirements"]))
        for stage in ledger["stages"]
    }


def render(ledger):
    validate(ledger)
    refresh_summary(ledger)
    JSON_PATH.write_text(json.dumps(ledger, indent=2, ensure_ascii=False) + "\n")
    lines = ["# Workplan completion ledger", "",
             "Generated from `workplan_completion_ledger.json`. Original requirements remain individually tracked.",
             "**Not a completion statement.** Report pointers are not verified evidence; unexecuted tests have no pass counts.",
             "", f"Updated: {ledger['updated_at']}", "",
             "Binding amendments override conflicting original wording; see `Developer_Workplan_Amendments.md`.", ""]
    if ledger.get("latest_increment"):
        lines += ["## Latest implementation evidence", ""]
        for key, value in ledger["latest_increment"].items():
            lines += [f"- **{key}:** {json.dumps(value, ensure_ascii=False)}"]
        lines += [""]
    for s in ledger["stages"]:
        lines += [f"## Stage {s['stage']} — {s['name']}", ""]
        for r in s["requirements"]:
            lines += [f"### {r['id']} — {r['status']}", r["requirement"], "",
                      f"- Section: {r['source_section']}; origin: {r['origin']}",
                      f"- Existing evidence: {', '.join(r['existing_evidence']) or 'Not reconciled'}",
                      f"- Delivered this run: {r['behaviour_delivered_this_run'] or 'None recorded'}",
                      f"- Scientific acceptance: {r['scientific_acceptance']}",
                      f"- Executions: {json.dumps(r['executions'], ensure_ascii=False)}",
                      f"- Gaps: {'; '.join(r['remaining_gaps'])}",
                      f"- Next: {r['next_action']}", ""]
    lines += ["## Restart", json.dumps(ledger["restart"], indent=2), ""]
    (ROOT / "docs/WORKPLAN_COMPLETION_LEDGER.md").write_text("\n".join(lines))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--initialise", action="store_true")
    args = parser.parse_args()
    data = initialise() if args.initialise else json.loads(JSON_PATH.read_text())
    render(data)
    print(f"Tracked {validate(data)} individual requirements across 18 stages")
