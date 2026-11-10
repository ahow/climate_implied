"""Pure source-format fixtures: importing these never opens private artifacts."""
import unittest

from validate_igcc_official_sources import parse_actual_erf


class OfficialFormatTests(unittest.TestCase):
    def fixture(self):
        return ("time,timebound_lower,timebound_upper,CO2,solar,volcanic\n"+
                "".join(f"{y+.5},{y},{y+1},1,0,0\n" for y in range(1750, 2026))).encode()

    def test_actual_2025_coordinate_not_publication_2026(self):
        result = parse_actual_erf(self.fixture())
        self.assertEqual(len(result), 276)
        self.assertIn(2025, result)
        self.assertNotIn(2026, result)

    def test_missing_year_duplicate_and_nonfinite_fail(self):
        with self.assertRaisesRegex(ValueError, "never shorten"):
            parse_actual_erf(self.fixture().replace(b"2025.5,2025,2026,1,0,0\n", b""))
        with self.assertRaisesRegex(ValueError, "Unique exact"):
            parse_actual_erf(self.fixture()+b"2025.5,2025,2026,1,0,0\n")
        with self.assertRaisesRegex(ValueError, "Finite"):
            parse_actual_erf(self.fixture().replace(b",1,0,0", b",nan,0,0", 1))


if __name__ == "__main__":
    unittest.main()
