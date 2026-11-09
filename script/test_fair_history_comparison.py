import unittest
from compare_fair_histories import compare


class HistoryComparisonTests(unittest.TestCase):
    def test_pairing_and_known_difference(self):
        a = {"baseline": "1850-1900", "years": [2024, 2100], "memberIds": ["a", "b"],
             "temperature": [[1, 2], [3, 4]]}
        b = {**a, "temperature": [[1, 2], [3.1, 4.1]]}
        self.assertAlmostEqual(compare(a, b)["maximumAbsolutePairedDifferenceC"], .1)
        with self.assertRaises(ValueError):
            compare(a, {**b, "memberIds": ["b", "a"]})
        with self.assertRaises(ValueError):
            compare(a, {**b, "temperature": [[float("nan"), 2], [3, 4]]})
