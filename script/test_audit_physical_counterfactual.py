"""Prescription classification fixtures, not physical calibration evidence."""
import copy
import unittest

from fair.io import read_properties
import numpy as np
import xarray as xr

from audit_physical_counterfactual import species_prescriptions
import test_physical_counterfactual_attribution as fixtures


class PrescriptionAuditTests(unittest.TestCase):
    def fixture(self):
        data, _ = fixtures.FreshModelTests().fixture()
        emissions = data.baseline_emissions.broadcast_like(data.emissions_native).copy(deep=True)
        natural = data.forcing_species_bounds.sel(specie=["Solar", "Volcanic"]).rename(specie="natural_specie")
        artifact = xr.Dataset({
            "counterfactual_native_emissions": emissions,
            "counterfactual_natural_forcing_bounds": natural.copy(deep=True),
            "factual_natural_forcing_bounds": natural.copy(deep=True)})
        _, properties = read_properties()
        return data, artifact, properties

    def test_all_species_including_land_use_and_contrails_explicitly_classified(self):
        data, artifact, properties = self.fixture()
        rows = species_prescriptions(data, artifact, properties)
        self.assertEqual(len(rows), 64)
        by_name = {r["species"]: r for r in rows}
        self.assertEqual(sum(r["inputMode"] == "emissions" for r in rows), 53)
        self.assertEqual(sum(r["inputMode"] == "forcing" for r in rows), 2)
        self.assertEqual(sum(r["inputMode"] == "calculated" for r in rows), 9)
        self.assertEqual([r["species"] for r in rows if r["heldFactual"]], ["Solar", "Volcanic"])
        for name in ("Land use", "Contrails"):
            self.assertEqual(by_name[name]["inputMode"], "calculated")
            self.assertFalse(by_name[name]["heldFactual"])
            self.assertIn("Recompute", by_name[name]["counterfactualPrescription"])
        self.assertIn("removes contrails", by_name["Contrails"]["baselineSource"])
        self.assertIn("AFOLU", by_name["Land use"]["calculation"])

    def test_mode_drift_or_unimplemented_direct_anthropogenic_forcing_fails_closed(self):
        data, artifact, properties = self.fixture()
        data.species_input_mode.loc[dict(specie="Contrails")] = "forcing"
        with self.assertRaisesRegex(ValueError, "mode/type differs"):
            species_prescriptions(data, artifact, properties)
        properties = copy.deepcopy(properties)
        properties["Contrails"]["input_mode"] = "forcing"
        with self.assertRaisesRegex(ValueError, "directly prescribed anthropogenic"):
            species_prescriptions(data, artifact, properties)

    def test_actual_native_and_natural_prescriptions_checked_not_just_claimed(self):
        data, artifact, properties = self.fixture()
        artifact.counterfactual_native_emissions.loc[dict(specie="CH4")] = 99
        with self.assertRaisesRegex(ValueError, "prescription mismatch"):
            species_prescriptions(data, artifact, properties)
        data, artifact, properties = self.fixture()
        artifact.counterfactual_natural_forcing_bounds.loc[dict(natural_specie="Solar")] = 99
        with self.assertRaisesRegex(ValueError, "Natural forcing preservation"):
            species_prescriptions(data, artifact, properties)


if __name__ == "__main__":
    unittest.main()
