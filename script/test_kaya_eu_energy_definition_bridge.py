"""Source-independent public fixtures;no raw/retained data dependencies."""
from decimal import Decimal
from fractions import Fraction
import unittest

from kaya_eu_energy_definition_bridge import conversion_fraction, isolate_member, require_terms, revision_accounting


class EUEnergyDefinitionTests(unittest.TestCase):
    def members(self):
        return {**{f"fixture-{n}":Decimal("1.000") for n in range(26)},"fixture-selected":Decimal("2.000")}

    def test_residual_member_is_not_an_observed_or_qualified_input(self):
        proof=isolate_member(Decimal("27.500"),self.members(),"fixture-selected")
        self.assertEqual(proof["other26NativeSumTWh"],Decimal("26.000"))
        self.assertEqual(proof["aggregateMinusOther26TWh"],Decimal("1.500"))
        self.assertEqual(proof["aggregateMinusAll27TWh"],Decimal("-0.500"))
        self.assertFalse(proof["impliedMemberIsObservedUpstreamValue"])
        self.assertFalse(proof["scientificBoundaryQualified"])

    def test_no_short_membership_or_missing_zero_fill(self):
        members=self.members()
        members["fixture-0"]=None
        with self.assertRaises(ValueError):
            isolate_member(Decimal(28),members,"fixture-selected")
        del members["fixture-0"]
        with self.assertRaises(ValueError):
            isolate_member(Decimal(28),members,"fixture-selected")

    def test_finite_nonnegative_and_named_member_required(self):
        for invalid in (Decimal("-1"),Decimal("NaN"),Decimal("Infinity")):
            members=self.members()
            members["fixture-0"]=invalid
            with self.assertRaises(ValueError):
                isolate_member(Decimal(28),members,"fixture-selected")
        with self.assertRaises(ValueError):
            isolate_member(Decimal(28),self.members(),"absent")

    def test_published_unit_division_exact_not_fitted_conversion(self):
        self.assertEqual(conversion_fraction("EJ_TO_TWH = 1e6 / 3600","EJ_TO_TWH"),Fraction(2500,9))
        self.assertEqual(conversion_fraction("TJ_TO_TWH = 1 / 3600","TJ_TO_TWH"),Fraction(1,3600))

    def test_exact_residual_revision_localization_not_causal_fit(self):
        old=self.members()
        new={**old,"fixture-selected":Decimal("2.500")}
        result=revision_accounting(Decimal(28),Decimal(28),new,old)
        self.assertEqual(result["residualChangeTWh"],Decimal("-0.500"))
        self.assertEqual(result["nativeMemberRevisionsTWh"],{"fixture-selected":Decimal("0.500")})
        self.assertEqual(result["revisionAccountingResidualTWh"],0)
        self.assertFalse(result["physicalCausationClaim"])
        old["fixture-selected"]=None
        result=revision_accounting(Decimal(28),Decimal(28),new,old)
        self.assertIsNone(result["legacyCompleteResidualTWh"])
        self.assertIsNone(result["residualChangeTWh"])
        self.assertEqual(result["missingLegacyMembers"],["fixture-selected"])

    def test_source_not_executed_or_inferred_when_missing(self):
        for source in ["X = unknown()", "X = other / 3", "Y = 1 / 3600"]:
            with self.assertRaises(ValueError):
                conversion_fraction(source,"X")

    def test_publisher_terms_have_exact_line_pointers(self):
        self.assertEqual(require_terms("first\nsource EI-first\nlast",["EI-first"]),{"EI-first":[2]})
        with self.assertRaises(ValueError):
            require_terms("source EI-first",["absent"])


if __name__=="__main__":
    unittest.main()
