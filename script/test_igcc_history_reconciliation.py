import unittest
import numpy as np
import xarray as xr
from reconcile_igcc_history import reconcile

class HistoryTests(unittest.TestCase):
    def test_baseline_coordinates_and_rejection(self):
        years=np.arange(1850,2016)
        a=np.broadcast_to((years-1850)[:,None,None,None]*.01,(166,2,3,1)).copy()
        model=xr.DataArray(a,dims=["timebounds","scenario","config","layer"],
            coords={"timebounds":years,"scenario":["a","b"],"config":[0,1,2],"layer":[0]})
        observed={float(y)+.5:5+(y+.5-1850)*.01 for y in range(1850,2015)}
        result=reconcile(model,observed)
        self.assertLess(result["scenarios"][0]["rmse"],1e-12)
        self.assertFalse(result["centralEligible"])
        del observed[1850.5]
        with self.assertRaises(ValueError):
            reconcile(model,observed)

if __name__=="__main__":
    unittest.main()
