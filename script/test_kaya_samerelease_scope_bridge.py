"""Public unit tests use only synthetic source-contract fixtures."""
import hashlib
import unittest
from decimal import Decimal

from kaya_samerelease_scope_bridge import (complete_regional_sum,display_rounding_only_compatible,exact_source_binding,numeric_cell,
                                           provider_grid,source_specific_rights,table_eia_rights,unique_grid)


class SameReleaseScopeTests(unittest.TestCase):
    def test_source_bytes_require_both_version_checksum_and_size(self):
        raw=b"public-fixture"
        exact_source_binding(raw,hashlib.md5(raw).hexdigest(),len(raw))
        with self.assertRaises(ValueError):
            exact_source_binding(raw,"0"*32,len(raw))
        with self.assertRaises(ValueError):
            exact_source_binding(raw,hashlib.md5(raw).hexdigest(),len(raw)+1)

    def test_copyright_public_url_and403_are_not_permission(self):
        blocked=source_specific_rights("Copyright fixture publisher","403")
        self.assertFalse(blocked["numericUseAdmitted"])
        self.assertFalse(blocked["publicDownloadURLIsPermission"])
        self.assertTrue(source_specific_rights("CC BY 4.0")["numericUseAdmitted"])
        self.assertTrue(source_specific_rights("Public domain")["numericUseAdmitted"])

    def test_provider_projection_full_grid(self):
        rows=provider_grid("country,year,source\nfixture,1,ei\nfixture,2,eia\n",["fixture"],[1,2])
        self.assertEqual(len(rows),2)
        self.assertEqual(rows["fixture",2]["source"],"eia")

    def test_provider_rejects_missing_duplicate_unknown_and_numeric_extra(self):
        for text in ("country,year,source\nfixture,1,ei\n",
                     "country,year,source\nfixture,1,ei\nfixture,1,ei\n",
                     "country,year,source\nfixture,1,unknown\nfixture,2,eia\n",
                     "country,year,source,energy\nfixture,1,ei,1\nfixture,2,eia,2\n"):
            with self.assertRaises(ValueError):
                provider_grid(text,["fixture"],[1,2])

    def test_no_missing_or_nonfinite_zero_fill(self):
        self.assertIsNone(numeric_cell(""))
        self.assertIsNone(numeric_cell("[NONE]"))
        self.assertEqual(numeric_cell("0"),0)
        for text in ("NaN","Infinity","-1"):
            with self.assertRaises(ValueError):
                numeric_cell(text)

    def test_full_region_sum_is_separate_exact_sum(self):
        values={f"fixture-{i}":Decimal("1.125") for i in range(27)}
        self.assertEqual(complete_regional_sum(values,list(values)),Decimal("30.375"))
        values["fixture-0"]=None
        with self.assertRaises(ValueError):
            complete_regional_sum(values,list(values))
        del values["fixture-0"]
        with self.assertRaises(ValueError):
            complete_regional_sum(values,list(values))
        with self.assertRaises(ValueError):
            complete_regional_sum(values,list(values)+["fixture-1"])

    def test_region_rejects_zero_and_nonfinite(self):
        for invalid in (Decimal("0"),Decimal("-1"),Decimal("NaN")):
            values={f"fixture-{i}":Decimal(1) for i in range(27)}
            values["fixture-0"]=invalid
            with self.assertRaises(ValueError):
                complete_regional_sum(values,list(values))

    def eia_metadata(self):
        return {"dataset":{"namespace":"eia","version":"2026-05-05","short_name":"international_energy"},
                "fields":{"total_energy_consumption":{"unit":"terawatt-hours","origins":[
                    {"producer":"U.S. Energy Information Administration","license":{"name":"Public domain"}}]}}}

    def test_no_already_TWh_conversion_and_source_rights(self):
        metadata=self.eia_metadata()
        self.assertEqual(table_eia_rights(metadata)["unit"],"terawatt-hours")
        metadata["fields"]["total_energy_consumption"]["origins"].append(
            {"producer":"fixture mixed-rights source","license":{"name":"copyright"}})
        with self.assertRaises(ValueError):
            table_eia_rights(metadata)

    def test_wrong_source_version_and_unit_rejected(self):
        metadata=self.eia_metadata()
        metadata["dataset"]["version"]="other"
        with self.assertRaises(ValueError):
            table_eia_rights(metadata)
        metadata=self.eia_metadata()
        metadata["fields"]["total_energy_consumption"]["unit"]="terajoules"
        with self.assertRaises(ValueError):
            table_eia_rights(metadata)

    def test_foreign_grid_identity_rejected(self):
        with self.assertRaises(ValueError):
            unique_grid([{"country":"foreign","year":"1","v":"1"}],["country","year","v"],["fixture"],[1])

    def test_display_gate_does_not_relax_to_explain_exception(self):
        self.assertTrue(display_rounding_only_compatible(Decimal("1.0005"),Decimal("1")))
        self.assertFalse(display_rounding_only_compatible(Decimal("1.000507"),Decimal("1")))
        self.assertIsNone(display_rounding_only_compatible(None,Decimal("1")))


if __name__=="__main__":
    unittest.main()
