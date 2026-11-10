import unittest
import io
import csv

import numpy as np
import xarray as xr

from physical_source_alignment import compare_gas_changes, parse_erf, inspect_human_reference, inspect_independent_history


class SourceAlignmentTests(unittest.TestCase):
    def fixture(self):
        years = np.arange(1750, 2015)
        values = np.zeros((265, 1, 3, 3))
        values[:] = np.arange(265)[:, None, None, None]*.01
        # Correlated member ordering changes: median subtraction is not equivalent
        # to subtraction of medians.
        values[:, 0, :, :] += np.array([0, 10, 20])[None, :, None]
        values[0, 0, :, :] = np.array([20, 0, 10])[:, None]
        data = xr.Dataset({
            "forcing_species_annual": (("year", "scenario", "config", "specie"), values,
                                      {"units": "W m-2"}),
            "baseline_concentration": (("config", "specie"), np.ones((3, 3))),
            "forcing_reference_concentration": (("config", "specie"), np.ones((3, 3))*2)},
            coords={"year": years, "scenario": ["historical"], "config": ["a", "b", "c"],
                    "specie": ["CO2", "CH4", "N2O"]})
        reference = {y: {s: (y-1750)*.01 for s in ("CO2", "CH4", "N2O")} for y in range(1750, 2025)}
        return data, reference

    def test_raw_preserved_memberwise_origin_not_fitted(self):
        data, reference = self.fixture()
        before = data.copy(deep=True)
        result = compare_gas_changes(data, reference)
        xr.testing.assert_identical(before, data)
        gas = result["directGasERF"]["CO2"]
        self.assertAlmostEqual(gas["raw"]["scenarios"][0]["model2014Wm2"], 12.64)
        self.assertAlmostEqual(gas["alignedAnnual1750Change"]["scenarios"][0]["model2014Wm2"], 12.64)
        self.assertAlmostEqual(gas["alignedAnnual1750Change"]["scenarios"][0]["model1750Wm2"], 0)
        self.assertEqual(gas["removedReferenceAnnual1750"], 0)
        self.assertIsNone(result["threshold"])
        self.assertFalse(result["annualReferenceGatePassed"])
        self.assertEqual(result["naturalAlignment"]["status"], "not applied")

    def test_nonfinite_wrong_units_or_missing_coordinates_rejected(self):
        data, reference = self.fixture()
        data.forcing_species_annual.attrs["units"] = "mW m-2"
        with self.assertRaisesRegex(ValueError, "W m-2"):
            compare_gas_changes(data, reference)
        data.forcing_species_annual.attrs["units"] = "W m-2"
        data.forcing_species_annual.values[1, 0, 0, 0] = np.nan
        with self.assertRaisesRegex(ValueError, "Finite"):
            compare_gas_changes(data, reference)
        del reference[2024]
        with self.assertRaisesRegex(ValueError, "years"):
            compare_gas_changes(data, reference)

    def test_duplicate_source_year_rejected(self):
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            parse_erf(b",CO2\n1750,0\n1750,1\n")


class HumanSourceTests(unittest.TestCase):
    def fixture(self):
        # Synthetic fixtures test definitions/coordinates; never used as evidence.
        base = b"time,timebound_lower,timebound_upper,anthropogenic_p05,anthropogenic_p50,anthropogenic_p95,notes\n2025.5,2025,2026,1.1,1.38,1.7,\n2025.5,2025,2026,1.1,1.37,1.7,SR15 definition\n2021,2016,2026,1,1.24,1.5,\n"
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["definition", "component", "percentile", "time", "GMST"])
        for definition, central in [("Annual", 1.38), ("SR1.5", 1.37)]:
            for percentile, value in [("p05", 1.1), ("p50", central), ("p95", 1.7)]:
                writer.writerow([definition, "anthropogenic", percentile, 2025, value])
        meta = xr.Dataset({"GMST": ("time", [1.38], {
            "units": "degC", "long_name": "Global mean surface temperature relative to 1850-1900"})},
            attrs={k: "fixture" for k in ("title", "source", "references", "license", "date_created", "version")})
        meta.attrs["summary"] = "Human-induced GMST"
        metadata = bytes(meta.to_netcdf(engine="h5netcdf"))
        method = b"time,timebound_lower,timebound_upper,anthropogenic_p50\n"+b"".join(
            f"{y+.5},{y},{y+1},1\n".encode() for y in range(1850, 2026))
        return base, output.getvalue().encode(), metadata, {"testMethod": method}

    def test_definitions_separate_actual_bounds_required_no_model_attribution(self):
        result = inspect_human_reference(*self.fixture())
        self.assertEqual(result["annualDefinitionsKeptSeparate"]["Annual"]["p50"], 1.38)
        self.assertEqual(result["annualDefinitionsKeptSeparate"]["SR1.5"]["p50"], 1.37)
        self.assertEqual(result["mean2016to2025"]["timeBoundsHalfOpen"], [2016, 2026])
        self.assertEqual(result["methods"]["testMethod"]["missing2016to2025"], [])
        self.assertIsNone(result["shareMeanMembersInRange"])
        self.assertFalse(result["centralEligible"])

    def test_publication_year_not_coordinate_and_sources_must_agree(self):
        base, standard, metadata, methods = self.fixture()
        with self.assertRaisesRegex(ValueError, "bounds"):
            inspect_human_reference(base.replace(b",2025,2026,", b",2024,2025,"), standard, metadata, methods)
        with self.assertRaisesRegex(ValueError, "disagree"):
            inspect_human_reference(base, standard.replace(b"1.37", b"1.38"), metadata, methods)

    def test_bad_annual_coordinates_and_unknown_definition_rejected(self):
        base, standard, metadata, methods = self.fixture()
        with self.assertRaisesRegex(ValueError, "bounds/midpoints"):
            inspect_human_reference(base, standard, metadata, {"test": methods["testMethod"].replace(b"2025.5", b"2025.0")})
        with self.assertRaisesRegex(ValueError, "Unknown"):
            inspect_human_reference(base.replace(b"SR15 definition", b"GSAT"), standard, metadata, methods)

    def test_partial_tree_is_not_evidence_of_absence(self):
        with self.assertRaisesRegex(ValueError, "Complete"):
            inspect_independent_history(b'{"tree": [], "truncated": true}', b"")


if __name__ == "__main__":
    unittest.main()
