#!/usr/bin/env python3
"""Execute one command and retain actual results, never planned pass counts."""
import argparse
from datetime import datetime, timezone
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]


def counts(text):
    tap = {key: re.search(rf"^# {key} (\d+)\s*$", text, re.M)
           for key in ("tests", "pass", "fail", "skipped")}
    if all(tap.values()):
        return {key: int(m[1]) for key, m in tap.items()}
    py = re.search(r"Ran (\d+) tests? in", text)
    if py:
        total = int(py[1])
        failures = re.search(r"failures=(\d+)", text)
        errors = re.search(r"errors=(\d+)", text)
        skips = re.search(r"skipped=(\d+)", text)
        failed = sum(int(m[1]) for m in (failures, errors) if m)
        skipped = int(skips[1]) if skips else 0
        if re.search(r"^OK(?: \(.*\))?$|^FAILED \(.*\)$", text, re.M):
            return {"tests": total, "pass": total - failed - skipped, "fail": failed, "skipped": skipped}
    return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--requirements", default="")
    parser.add_argument("--timeout", type=int, default=1200)
    parser.add_argument("command", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    command = args.command[1:] if args.command[:1] == ["--"] else args.command
    if not command:
        parser.error("command required")
    started = datetime.now(timezone.utc)
    output_dir = ROOT / "generated-artifacts/workplan-completion"
    output_dir.mkdir(parents=True, exist_ok=True)
    log = output_dir / f"{started.strftime('%Y%m%dT%H%M%S%fZ')}.log"
    begin = time.monotonic()
    with log.open("w") as handle:
        try:
            result = subprocess.run(command, cwd=ROOT, stdout=handle, stderr=subprocess.STDOUT, timeout=args.timeout)
            code = result.returncode
        except subprocess.TimeoutExpired:
            code = 124
            handle.write("\nEvidence runner: command timed out; no completion claimed.\n")
    text = log.read_text()
    entry = {
        "command": command, "executed_at": started.isoformat(), "exit_code": code,
        "elapsed_seconds": round(time.monotonic() - begin, 3),
        "counts": counts(text), "log": str(log.relative_to(ROOT)),
        "workspace_revision": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
        "worktree_dirty": bool(subprocess.check_output(["git", "status", "--porcelain"], cwd=ROOT, text=True).strip()),
        "scope": "Execution evidence only; does not establish scientific validity or full requirement acceptance",
    }
    ledger_path = ROOT / "docs/workplan_completion_ledger.json"
    ledger = json.loads(ledger_path.read_text())
    ledger["run_executions"].append(entry)
    wanted = set(filter(None, args.requirements.split(",")))
    known = {r["id"] for s in ledger["stages"] for r in s["requirements"]}
    if wanted - known:
        raise ValueError(f"Unknown requirement IDs: {wanted - known}; log retained at {log}")
    for s in ledger["stages"]:
        for r in s["requirements"]:
            if r["id"] in wanted:
                r["executions"].append(entry)
    ledger["updated_at"] = datetime.now(timezone.utc).isoformat()
    ledger_path.write_text(json.dumps(ledger, indent=2, ensure_ascii=False) + "\n")
    spec = importlib.util.spec_from_file_location("completion_ledger", ROOT / "script/completion-ledger.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.render(ledger)
    print(json.dumps(entry, indent=2))
    print(text[-2500:])
    raise SystemExit(code)


if __name__ == "__main__":
    main()
