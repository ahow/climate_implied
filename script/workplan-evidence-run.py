#!/usr/bin/env python3
"""Execute one command and retain actual results, never planned pass counts."""
import argparse
import hashlib
from datetime import datetime, timezone
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]

# Explicit coherent local mode. Private checks are mandatory and unconditional;
# public CI can still use the existing arbitrary-command receipt wrapper.
FULL_CHECK_COMMAND = [
    "bash", "-c",
    "set -e; "
    "echo '=== Typecheck ==='; npm run check; "
    # Several tests spawn additional source-only suites and real calculators.
    # Bound scheduling, not coverage or SQL/HTTP deadlines: otherwise competing
    # workers can starve pg's client event loop past its unchanged10s read bound.
    "echo '=== Complete TypeScript suite ==='; npx tsx --test --test-concurrency=2 --test-reporter=tap script/*.test.ts; "
    "echo '=== Complete Python suite ==='; uv run python -m unittest discover -s script -p 'test_*.py'; "
    "echo '=== Mandatory original choice/width document ==='; uv run python script/validate_status_choice_width_private.py; "
    "echo '=== Mandatory private monetary integration ==='; NODE_ENV=development npx tsx script/validate-workbook-money-integration-private.ts --private-primary; "
    "echo '=== Mandatory private issuer cashflow ==='; NODE_ENV=development npx tsx script/validate-issuer-cashflow-private.ts; "
    "echo '=== Mandatory private issuer reconciliation ==='; NODE_ENV=development npx tsx script/validate-issuer-cashflow-reconciliation-private.ts; "
    "echo '=== Production build ==='; npm run build",
]


def python_counts(text):
    py = re.search(r"^Ran (\d+) tests? in[^\n]*\n\s*(OK(?: \([^\n]*\))?|FAILED \([^\n]*\))\s*$",
                   text, re.M)
    if py:
        total = int(py[1])
        summary = py[2]
        failures = re.search(r"failures=(\d+)", summary)
        errors = re.search(r"errors=(\d+)", summary)
        skips = re.search(r"skipped=(\d+)", summary)
        failed = sum(int(m[1]) for m in (failures, errors) if m)
        skipped = int(skips[1]) if skips else 0
        return {"tests": total, "pass": total - failed - skipped, "fail": failed, "skipped": skipped}
    return None


def counts(text):
    tap = {key: re.search(rf"^# {key} (\d+)\s*$", text, re.M)
           for key in ("tests", "pass", "fail", "skipped")}
    if all(tap.values()):
        return {key: int(m[1]) for key, m in tap.items()}
    return python_counts(text)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--requirements", default="")
    parser.add_argument("--timeout", type=int, default=1200)
    parser.add_argument("--receipt-only", action="store_true",
                        help="Retain execution evidence without reading/writing canonical ledgers or Git history")
    parser.add_argument("--log", default="", help="Explicit execution log path")
    parser.add_argument("--receipt", default="", help="Receipt JSON path; requires --receipt-only")
    parser.add_argument("--full-checks", action="store_true",
                        help="Run coherent typecheck, both full suites, mandatory private validators and build")
    parser.add_argument("command", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    command = args.command[1:] if args.command[:1] == ["--"] else args.command
    if args.full_checks:
        if command:
            parser.error("--full-checks does not accept a replacement command")
        command = FULL_CHECK_COMMAND
    if not command:
        parser.error("command required")
    if args.receipt and not args.receipt_only:
        parser.error("--receipt requires --receipt-only")
    if args.receipt_only and args.requirements:
        parser.error("--receipt-only does not attach or amend canonical requirement records")
    started = datetime.now(timezone.utc)
    output_dir = ROOT / "generated-artifacts/workplan-completion"
    output_dir.mkdir(parents=True, exist_ok=True)
    log = Path(args.log).resolve() if args.log else output_dir / f"{started.strftime('%Y%m%dT%H%M%S%fZ')}.log"
    log.parent.mkdir(parents=True, exist_ok=True)
    begin = time.monotonic()
    with log.open("w") as handle:
        try:
            result = subprocess.run(command, cwd=ROOT, stdout=handle, stderr=subprocess.STDOUT, timeout=args.timeout)
            code = result.returncode
        except subprocess.TimeoutExpired:
            code = 124
            handle.write("\nEvidence runner: command timed out; no completion claimed.\n")
        except OSError as error:
            code = 127
            handle.write(f"\nEvidence runner: command launch failed ({type(error).__name__}); no completion claimed.\n")
    text = log.read_text()
    entry = {
        "command": command, "executed_at": started.isoformat(), "exit_code": code,
        "elapsed_seconds": round(time.monotonic() - begin, 3),
        "counts": counts(text), "log": str(log.relative_to(ROOT)) if log.is_relative_to(ROOT) else str(log),
        "workspace_revision": None if args.receipt_only else subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
        "worktree_dirty": None if args.receipt_only else bool(subprocess.check_output(["git", "status", "--porcelain"], cwd=ROOT, text=True).strip()),
        "scope": "Execution evidence only; does not establish scientific validity or full requirement acceptance",
    }
    if args.receipt_only:
        entry["log_sha256"] = hashlib.sha256(log.read_bytes()).hexdigest()
        py = re.search(r"Ran \d+ tests? in", text)
        entry["suite_counts"] = {
            "typescript": counts(text) if re.search(r"^# tests \d+", text, re.M) else None,
            "python": python_counts(text) if py else None,
        }
        entry["canonical_ledgers_modified"] = False
        entry["revision_boundary"] = "Receipt-only source execution; no Git/history lookup, deployment or scientific acceptance claim"
        if args.receipt:
            receipt = Path(args.receipt).resolve()
            receipt.parent.mkdir(parents=True, exist_ok=True)
            receipt.write_text(json.dumps(entry, indent=2) + "\n")
        print(json.dumps(entry, indent=2))
        print(text[-2500:])
        raise SystemExit(code)
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
