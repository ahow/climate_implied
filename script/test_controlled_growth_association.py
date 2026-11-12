import copy
import json
import unittest
import subprocess
import sys
import numpy as np
from controlled_growth_association import estimate, digest, PROTOCOL_PATH, CONTROLS


def fixture(n=80):
    # Synthetic engineering only, not issuer input or scientific acceptance.
    protocol = json.loads(PROTOCOL_PATH.read_text())
    definitions = protocol["definitions"]
    manifest = {"protocolHash": digest(protocol), "frozenAt": "2026-11-12T15:52:36Z",
                "estimationAt": "2026-11-12T16:00:00Z", "cutoff": "2024-12-31T23:59:59Z",
                "issuerIds": [f"fixture-{i}" for i in range(n)], "solverSettingsId": "engineering-Gordon",
                "definitions": definitions, "levels": {"sector": ["a", "b"], "operatingRegion": ["x", "y"]}}
    rng = np.random.default_rng(12006)
    records = []
    for i in range(n):
        values = rng.normal(size=7)
        values[0] = abs(values[0])
        values[3] = abs(values[3])
        values[4] = float(rng.uniform())
        values[6] = float(rng.uniform(-.4,.5))
        y = .03 + .02*values[0] + .01*values[1] + .003*(i % 2) + rng.normal(scale=.001)
        fields = dict(zip(("transitionExposure", *CONTROLS), values))
        fields["impliedGrowth"] = y
        records.append({"issuerId": manifest["issuerIds"][i], "identityStatus": "accepted",
            "basis": "steady-state-earnings-Gordon-annual-fraction", "solverSettingsId": "engineering-Gordon",
            "originalRestated": "original", "observationAt": manifest["cutoff"],
            "sector": ["a","b"][i%2], "operatingRegion": ["x","y"][(i//2)%2],
            "categoryEvidence": {c: {"publishedAt": "2024-01-01T00:00:00Z", "sourceHash":"a"*64,
                                     "locator":"engineering"} for c in ("sector","operatingRegion")},
            "fields": {k: {"value": float(v), "definition": definitions[k], "publishedAt":"2024-01-01T00:00:00Z",
                           "periodEnd":"2023-12-31T23:59:59Z", "sourceHash":"a"*64, "locator":"engineering"}
                       for k,v in fields.items()}})
    return manifest, records


class AssociationTests(unittest.TestCase):
    def test_actual_ols_hc3_original_units_and_population(self):
        m, rows = fixture()
        r = estimate(m, rows)
        self.assertEqual(r["status"], "conditional-association")
        self.assertEqual(r["population"], 80)
        self.assertEqual(r["n"], 80)
        self.assertAlmostEqual(r["coefficients"][1]["estimate"], .02, delta=.001)
        self.assertGreater(r["coefficients"][1]["hc3SE"], 0)
        self.assertLess(r["coefficients"][1]["lower95"], r["coefficients"][1]["upper95"])
        self.assertEqual(r["df"], r["n"]-r["p"])
        self.assertIn("not climate-attributable", r["claim"])

    def test_missing_future_unknown_categories_never_zero_or_drop_denominator(self):
        m, rows = fixture()
        rows[0]["fields"]["transitionExposure"]["value"] = None
        rows[1]["fields"]["impliedGrowth"]["publishedAt"] = "2026-01-01T00:00:00Z"
        rows[2]["identityStatus"] = "pending"
        rows[3]["operatingRegion"] = "unknown"
        r = estimate(m, rows)
        self.assertEqual((r["population"], r["n"], len(r["excluded"])), (80,76,4))

    def test_input_order_does_not_change_coefficients(self):
        m,r = fixture()
        self.assertEqual(estimate(m,r)["coefficients"], estimate(m,list(reversed(r)))["coefficients"])

    def test_rank_deficiency_refuses(self):
        m,r = fixture()
        for row in r:
            row["fields"]["capexOverRevenue"]["value"] = row["fields"]["netDebtOverAssets"]["value"]
        self.assertEqual(estimate(m,r)["status"], "unavailable")

    def test_empty_records_preserve_all_missing_members(self):
        m,_ = fixture()
        r=estimate(m,[])
        self.assertEqual(len(r["excluded"]),80)
        self.assertIsNone(r["coefficients"])

    def test_protocol_drift_and_duplicates_refuse(self):
        m,r=fixture()
        bad=copy.deepcopy(m);bad["protocolHash"]="x"
        with self.assertRaises(ValueError): estimate(bad,r)
        with self.assertRaises(ValueError): estimate(m,r+[r[0]])

    def test_wrong_definitions_and_impossible_controls_do_not_fit(self):
        m,rows=fixture()
        bad=copy.deepcopy(m);bad["definitions"]["transitionExposure"]="marketcap intensity"
        with self.assertRaisesRegex(ValueError,"definitions"):estimate(bad,rows)
        rows[0]["fields"]["pastThreeYearRevenueCagr"]["value"]=-2
        rows[1]["fields"]["impliedGrowth"]["sourceHash"]="z"*64
        r=estimate(m,rows)
        self.assertEqual((r["population"],r["n"]),(80,78))

    def test_fresh_process_exact_result_and_source_identity(self):
        m,rows=fixture()
        expected=estimate(m,rows)
        program="import json; from test_controlled_growth_association import fixture; from controlled_growth_association import estimate; m,r=fixture(); print(json.dumps(estimate(m,r),sort_keys=True))"
        actual=json.loads(subprocess.check_output([sys.executable,"-c",program],cwd=PROTOCOL_PATH.parents[1]/"script",text=True))
        self.assertEqual(actual,expected)
        self.assertEqual(len(actual["modelCodeSha256"]),64)
        self.assertEqual(len(actual["dependencyLockSha256"]),64)

    def test_exact_numerical_oracle(self):
        m,rows=fixture()
        r=estimate(m,rows)
        X=np.array([[1,row["fields"]["transitionExposure"]["value"],
                     *[row["fields"][c]["value"] for c in CONTROLS],
                     float(row["sector"]=="b"),float(row["operatingRegion"]=="y")] for row in rows])
        Y=np.array([row["fields"]["impliedGrowth"]["value"] for row in rows])
        b=np.linalg.lstsq(X,Y,rcond=None)[0]
        inv=np.linalg.inv(X.T@X)
        h=np.diag(X@inv@X.T)
        residual=Y-X@b
        covariance=inv@X.T@np.diag((residual/(1-h))**2)@X@inv
        np.testing.assert_allclose([v["estimate"] for v in r["coefficients"]],b,atol=1e-12)
        np.testing.assert_allclose(r["covariance"],covariance,atol=1e-12)
