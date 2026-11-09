import gzip
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from verify_regional_archive import verify


class ArchiveTests(unittest.TestCase):
    def test_valid_and_corrupt_archive(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            member = {"memberId": "m0", "inventoryId": "inventory",
                      "global": [{"year": y, "reportingGtCO2e": 10} for y in range(2024, 2101)]}
            raw = (json.dumps(member) + "\n").encode()
            (root / "members.jsonl.gz").write_bytes(gzip.compress(raw))
            report = {"sampling": {"members": [{"id": "m0"}]}, "inventoryHash": "inventory",
                      "milestones": [{"id": "m0", "emissions2050GtCO2e": 10, "emissions2100GtCO2e": 10}],
                      "failures": [], "requestedMembers": 1, "acceptedMembers": 1,
                      "rejectedMembers": 0, "complete": True, "membersSha256": hashlib.sha256(raw).hexdigest()}
            def save():
                (root / "result.json").write_text(json.dumps(report))
            save()
            self.assertEqual(verify(root)["verifiedMembers"], 1)
            report["milestones"][0]["emissions2100GtCO2e"] = 11
            save()
            with self.assertRaisesRegex(ValueError, "Milestone"):
                verify(root)
            report["milestones"][0]["emissions2100GtCO2e"] = 10
            report["membersSha256"] = "invalid"
            save()
            with self.assertRaisesRegex(ValueError, "hash mismatch"):
                verify(root)
