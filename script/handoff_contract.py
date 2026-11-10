"""Listener contract. Importing this module never reads config or sends requests."""
PROJECT_TAG = "climate-implied-workplan-7Y7FDSOyaoDAG1SVtLd3ck"
EVENTS = frozenset({"continuation_ready", "workplan_complete", "owner_action_required"})


def validate_payload(payload):
    if payload.get("project_tag") != PROJECT_TAG:
        raise ValueError("Unexpected project_tag")
    if payload.get("event") not in EVENTS:
        raise ValueError("Unsupported continuation event")
    if payload["event"] == "workplan_complete" and payload.get("remaining_requirement_ids"):
        raise ValueError("Incomplete work cannot emit workplan_complete")
    return payload


def select_event(remaining, actionable):
    if actionable:
        return "continuation_ready"
    return "owner_action_required" if remaining else "workplan_complete"


def deliver_once(payload, url, directory, transport):
    """Reserve before I/O; never retry ambiguous delivery or claim matching."""
    import json
    import re
    from datetime import datetime, timezone
    from pathlib import Path
    validate_payload(payload)
    checkpoint = payload.get("checkpoint_id", "")
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", checkpoint):
        raise ValueError("Stable checkpoint_id required")
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / (checkpoint + ".json")
    receipt = {"checkpoint_id": checkpoint, "event": payload["event"],
               "attempted_at": datetime.now(timezone.utc).isoformat(),
               "outcome": "attempt-started", "continuation_matched": "unverified"}
    # Exclusive creation makes concurrent or repeated invocations safe.
    with path.open("x") as f:
        json.dump(receipt, f)
    try:
        status = transport(url, payload, {"Content-Type": "application/json", "Idempotency-Key": checkpoint})
        receipt.update(http_status=status, outcome="transport-accepted" if 200 <= status < 300 else "http-error")
    except Exception as error:
        receipt.update(http_status=None, outcome="transport-error", error_type=type(error).__name__)
    path.write_text(json.dumps(receipt, indent=2) + "\n")
    with (directory / "receipts.jsonl").open("a") as f:
        f.write(json.dumps(receipt) + "\n")
    return receipt
