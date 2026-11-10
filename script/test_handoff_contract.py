import unittest
from handoff_contract import EVENTS, PROJECT_TAG, select_event, validate_payload
from handoff_contract import deliver_once
import tempfile


class HandoffContract(unittest.TestCase):
    def test_exact_listener_contract(self):
        self.assertEqual(PROJECT_TAG, "climate-implied-workplan-7Y7FDSOyaoDAG1SVtLd3ck")
        self.assertEqual(EVENTS, {"continuation_ready", "workplan_complete", "owner_action_required"})
        for event in EVENTS:
            validate_payload({"project_tag": PROJECT_TAG, "event": event})

    def test_reject_unmatched_event_and_tag(self):
        for event, tag in [("run-end", PROJECT_TAG), ("continuation_ready", "wrong")]:
            with self.assertRaises(ValueError):
                validate_payload({"project_tag": tag, "event": event})

    def test_actionable_work_continues(self):
        self.assertEqual(select_event(["S04-001"], True), "continuation_ready")
        self.assertEqual(select_event(["S04-001"], False), "owner_action_required")
        self.assertEqual(select_event([], False), "workplan_complete")

    def test_incomplete_cannot_claim_complete(self):
        with self.assertRaises(ValueError):
            validate_payload({"project_tag": PROJECT_TAG, "event": "workplan_complete",
                              "remaining_requirement_ids": ["S04-001"]})

    def test_202_is_not_match_and_repeated_checkpoint_never_resends(self):
        calls = []
        def fake(url, payload, headers):
            calls.append(headers["Idempotency-Key"])
            return 202
        payload = {"project_tag": PROJECT_TAG, "event": "continuation_ready", "checkpoint_id": "offline-test"}
        with tempfile.TemporaryDirectory() as directory:
            receipt = deliver_once(payload, "unused-no-network", directory, fake)
            self.assertEqual(receipt["continuation_matched"], "unverified")
            self.assertEqual(receipt["outcome"], "transport-accepted")
            with self.assertRaises(FileExistsError):
                deliver_once(payload, "unused-no-network", directory, fake)
            self.assertEqual(calls, ["offline-test"])

    def test_invalid_contract_never_calls_transport(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(ValueError):
                deliver_once({"project_tag": PROJECT_TAG, "event": "run-end"},
                             "unused", directory, lambda *_: self.fail("transport called"))
