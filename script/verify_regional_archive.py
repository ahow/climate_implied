"""Read-only verification of a completed regional ensemble archive."""
import gzip
import hashlib
import json
from pathlib import Path
import sys


def verify(directory):
    root = Path(directory)
    report = json.loads((root / "result.json").read_text())
    requested = report["sampling"]["members"]
    expected = {m["id"] for m in requested}
    if len(expected) != len(requested):
        raise ValueError("Duplicate requested member IDs")
    seen = set()
    digest = hashlib.sha256()
    milestones = {m["id"]: m for m in report["milestones"]}
    if len(milestones) != len(report["milestones"]):
        raise ValueError("Duplicate milestone IDs")
    with gzip.open(root / "members.jsonl.gz", "rb") as stream:
        for line in stream:
            digest.update(line)
            member = json.loads(line)
            identity = member["memberId"]
            if identity not in expected or identity in seen:
                raise ValueError("Unexpected or duplicate archived member")
            seen.add(identity)
            if member["inventoryId"] != report["inventoryHash"]:
                raise ValueError("Member inventory identity mismatch")
            rows = member["global"]
            if [r["year"] for r in rows] != list(range(2024, 2101)):
                raise ValueError("Incomplete annual trajectory")
            milestone = milestones.get(identity)
            if not milestone or any(milestone[key] != rows[year - 2024]["reportingGtCO2e"]
                for key, year in [("emissions2050GtCO2e", 2050), ("emissions2100GtCO2e", 2100)]):
                raise ValueError("Milestone does not match archived trajectory")
    rejected = [m["id"] for m in report["failures"]]
    if len(set(rejected)) != len(rejected) or seen & set(rejected) or seen | set(rejected) != expected:
        raise ValueError("Accepted/rejected partition is inconsistent")
    if (report["requestedMembers"] != len(expected) or report["acceptedMembers"] != len(seen)
        or report["rejectedMembers"] != len(rejected) or set(milestones) != seen
        or report["complete"] != (len(rejected) == 0)):
        raise ValueError("Archive summary counts are inconsistent")
    if digest.hexdigest() != report["membersSha256"]:
        raise ValueError("Archived member stream hash mismatch")
    return {"verifiedMembers": len(seen), "rejectedMembers": len(rejected),
            "membersSha256": digest.hexdigest(), "scientificValidation": False}


if __name__ == "__main__":
    print(json.dumps(verify(sys.argv[1]), indent=2))
