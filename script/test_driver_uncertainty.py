import unittest
from driver_uncertainty import uncertainty, logistic

class DriverUncertaintyTests(unittest.TestCase):
    def test_reproducible_and_holdout_not_used_in_fit(self):
        rows = [(y, logistic(-4+.2*(y-2010))) for y in range(2010,2025)]
        first = uncertainty(rows, replications=30)
        self.assertEqual(first, uncertainty(list(reversed(rows)), replications=30))
        changed = [(y, v if y < 2019 else .99) for y,v in rows]
        self.assertEqual(first["pairedBootstrapParameters"],
                         uncertainty(changed, replications=30)["pairedBootstrapParameters"])
        self.assertFalse(first["centralModelEligible"])
        self.assertEqual(len(first["holdoutIntervals"]), 6)
    def test_missing_holdout_is_unavailable(self):
        self.assertEqual(uncertainty([(2010,.1)])["status"], "unavailable")
