"""Explicit end-of-run handoff only. Never call during active implementation."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import urllib.request
import urllib.error
from handoff_contract import deliver_once, select_event

ROOT = Path(__file__).resolve().parents[1]


def transport(url, payload, headers):
    request = urllib.request.Request(url, data=json.dumps(payload).encode(), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.status
    except urllib.error.HTTPError as error:
        return error.code


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint-id", required=True, help="Stable ID for this run, reused on repeat invocation")
    parser.add_argument("--owner-action-only", action="store_true",
                        help="Only when no independent actionable work remains")
    args = parser.parse_args()
    path = ROOT / "docs/workplan_completion_ledger.json"
    ledger = json.loads(path.read_text())
    config = json.loads((ROOT / "generated-artifacts/private-handoff/config.json").read_text())
    remaining = [r["id"] for s in ledger["stages"] for r in s["requirements"] if r["status"] != "verified"]
    payload = {
        "project_tag": config["project_tag"],
        "event": select_event(remaining, bool(remaining) and not args.owner_action_only),
        "checkpoint_id": args.checkpoint_id,
        "remaining_requirement_ids": remaining, "next_action": ledger["restart"]["instruction"],
        "genuine_blockers": ledger.get("handoff_blockers", []),
        "commit_sha": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
        "test_evidence_paths": [e["log"] for e in ledger["run_executions"]],
        "report_path": "docs/WORKPLAN_IMPLEMENTATION_REPORT.md",
        "ledger_hash": hashlib.sha256(path.read_bytes()).hexdigest(),
    }
    receipt = deliver_once(payload, config["url"], ROOT / "generated-artifacts/private-handoff", transport)
    with (ROOT / payload["report_path"]).open("a") as report:
        report.write("\n## Continuation transport receipt (matching not verified)\n\n" + json.dumps(receipt, indent=2) + "\n")
    ledger["last_handoff"] = receipt
    path.write_text(json.dumps(ledger, indent=2, ensure_ascii=False) + "\n")
    subprocess.run(["python", "script/completion-ledger.py"], cwd=ROOT, check=True)
    print(json.dumps(receipt))


if __name__ == "__main__":
    main()
