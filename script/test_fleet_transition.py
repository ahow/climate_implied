import unittest
from fleet_transition import evaluate, forecast

class FleetTransitionTests(unittest.TestCase):
    def test_holdout_never_enters_fitting(self):
        stock={y:.01+.002*(y-2010) for y in range(2010,2025)}
        sales={y:.1 for y in range(2010,2025)}
        first=evaluate(stock,sales)
        second=evaluate({y:(v if y<2019 else .9) for y,v in stock.items()},
                        {y:(v if y<2019 else .99) for y,v in sales.items()})
        for field in ["tau","tauQuantiles","forecast","parameterIntervals","trainingStability"]:
            self.assertEqual(first[field],second[field])
    def test_missing_and_invalid_are_not_imputed(self):
        self.assertEqual(evaluate({}, {})["status"],"unavailable")
        stock={y:.05 for y in range(2010,2025)}
        self.assertEqual(evaluate(stock,{y:.05 for y in range(2010,2019)})["status"],"unavailable")
        stock[2020]=float("nan")
        self.assertEqual(evaluate(stock,{y:.1 for y in range(2010,2019)})["status"],"unavailable")
    def test_transition_lag_and_bounds(self):
        self.assertEqual(forecast(.1,.2,1),[.2]*6)
        self.assertEqual(forecast(.1,.2,0),[.1]*6)

if __name__=="__main__":
    unittest.main()
