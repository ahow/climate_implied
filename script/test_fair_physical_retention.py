import tempfile
import unittest

import numpy as np
import xarray as xr
from fair import FAIR
from fair.io import read_properties
from fair_physical_retention import physical_dataset, retain_physical


def fixture():
    model = FAIR()
    model.define_time(1750, 1752, 1)
    model.define_scenarios(["historical"])
    model.define_configs(["member-a", "member-b"])
    model.define_species(*read_properties())
    model.allocate()
    model.fill_species_configs()
    model.forcing.values[:] = 0
    model.forcing.loc[dict(specie="Solar")] = 1
    model.forcing.loc[dict(specie="Aerosol-radiation interactions")] = -0.2
    model.forcing.loc[dict(specie="Aerosol-cloud interactions")] = -0.3
    model.forcing.loc[dict(specie="CO2")] = 2
    model.forcing_sum.values[:] = model.forcing.sum("specie").values
    model.temperature.values[:] = 0
    for s in model.species:
        if model.properties[s]["input_mode"] == "emissions":
            model.emissions.loc[dict(specie=s)] = 1
    return model


class RetentionTests(unittest.TestCase):
    def test_native_units_decomposition_and_coordinates(self):
        ds = physical_dataset(fixture())
        self.assertEqual(ds.native_emissions_unit.sel(specie="CO2 FFI").item(), "Gt CO2/yr")
        self.assertEqual(ds.native_emissions_unit.sel(specie="CFC-11").item(), "kt CFC11/yr")
        self.assertTrue(np.isnan(ds.emissions_native.sel(specie="Solar")).all())
        np.testing.assert_array_equal(ds.year, [1750, 1751])
        np.testing.assert_allclose(ds.forcing_total_annual, 2.5)
        np.testing.assert_allclose(ds.forcing_anthropogenic_annual, 1.5)
        np.testing.assert_allclose(ds.forcing_aerosol_annual, -.5)
        xr.testing.assert_allclose(ds.forcing_total_annual,
            ds.forcing_natural_annual + ds.forcing_anthropogenic_annual)

    def test_refuse_nonfinite_emissions_and_forcing_closure(self):
        model = fixture()
        model.emissions.loc[dict(specie="CH4")] = np.nan
        with self.assertRaisesRegex(ValueError, "native emissions"):
            physical_dataset(model)
        model = fixture()
        model.forcing_sum.values[:] += .01
        with self.assertRaisesRegex(ValueError, "does not close"):
            physical_dataset(model)
        model = fixture()
        model.forcing.loc[dict(specie="Solar", timebounds=1751)] = np.nan
        with self.assertRaisesRegex(ValueError, "Nonfinite actual forcing"):
            physical_dataset(model)

    def test_preserve_structural_precursor_nan_without_zero_filling(self):
        model = fixture()
        model.forcing.loc[dict(specie="Sulfur", timebounds=1751)] = np.nan
        model.forcing_sum.values[:] = model.forcing.sum("specie").values
        data = physical_dataset(model)
        self.assertTrue(np.isnan(data.forcing_species_bounds.sel(specie="Sulfur", timebounds=1751)).all())
        np.testing.assert_allclose(data.forcing_total_annual, 2.5)

    def test_roundtrip_and_idempotence(self):
        with tempfile.TemporaryDirectory() as directory:
            model = fixture()
            report = retain_physical(model, directory, {"test": "explicit synthetic fixture"})
            self.assertEqual(retain_physical(model, directory, {"test": "explicit synthetic fixture"}), report)
            with xr.open_dataset(report["file"]) as ds:
                self.assertEqual(list(ds.config.values), ["member-a", "member-b"])
                self.assertIn("not established", ds.temperature_bounds.attrs["observable"])


if __name__ == "__main__":
    unittest.main()
