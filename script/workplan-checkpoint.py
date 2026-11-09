"""Explicit end-of-run handoff only. Private destination; minimal public evidence."""
import hashlib
import json
from pathlib import Path
import subprocess
import urllib.request
import urllib.error
import uuid
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
ledger_path = ROOT / "docs/workplan_completion_ledger.json"
ledger = json.loads(ledger_path.read_text())
config = json.loads((ROOT / "generated-artifacts/private-handoff/config.json").read_text())
remaining = [r["id"] for s in ledger["stages"] for r in s["requirements"] if r["status"] != "verified"]
checkpoint = hashlib.sha256(ledger_path.read_bytes()).hexdigest()
receipt_path = ROOT / f"generated-artifacts/private-handoff/{checkpoint}.json"
if receipt_path.exists():
    raise SystemExit("Checkpoint already attempted; not sending twice")
payload = {
    "project_tag": config["project_tag"],
    "event": "continuation_ready",
    "checkpoint_id": str(uuid.uuid4()),
    "remaining_requirement_ids": remaining,
    "next_action": ledger["restart"]["instruction"],
    "genuine_blockers": ["Production archive tables and guards absent; supported managed provisioning required. Independent engineering remains actionable."],
    "commit_sha": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
    "test_evidence_paths": [e["log"] for e in ledger["run_executions"]],
    "report_path": "docs/WORKPLAN_IMPLEMENTATION_REPORT.md",
}
# Persist attempt before sending. Do not retry ambiguous failures automatically.
receipt = {"checkpoint_id": payload["checkpoint_id"], "ledger_hash": checkpoint,
           "attempted_at": datetime.now(timezone.utc).isoformat(), "outcome": "attempt-started"}
receipt_path.write_text(json.dumps(receipt, indent=2) + "\n")
try:
    request = urllib.request.Request(config["url"], data=json.dumps(payload).encode(),
                                     headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(request, timeout=30) as response:
        receipt.update(http_status=response.status, outcome="http-success")
except urllib.error.HTTPError as error:
    receipt.update(http_status=error.code, outcome="http-error")
except Exception as error:
    # Exception messages may contain private destination URLs.
    receipt.update(http_status=None, outcome="transport-error", error_type=type(error).__name__)
receipt_path.write_text(json.dumps(receipt, indent=2) + "\n")
with (ROOT / payload["report_path"]).open("a") as report:
    report.write("\n## Continuation callback\n\n" + json.dumps(receipt, indent=2) + "\n")
ledger["last_handoff"] = receipt
ledger_path.write_text(json.dumps(ledger, indent=2, ensure_ascii=False) + "\n")
subprocess.run(["python", "script/completion-ledger.py"], cwd=ROOT, check=True)
print(json.dumps(receipt))
