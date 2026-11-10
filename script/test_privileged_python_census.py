import unittest
from privileged_python_census import inspect_source

class PythonPrivilegeCensus(unittest.TestCase):
    def test_new_calls_found_without_executing_or_exporting_arguments(self):
        source='urlopen("https://example.invalid/?secret=NO_EXPORT")\ncursor.execute("DELETE FROM x")\nsubprocess.run(["never-execute"])'
        row=inspect_source("fixture.py",source)
        self.assertEqual(len(row["operations"]),3)
        self.assertNotIn("NO_EXPORT",str(row))
        self.assertNotIn("never-execute",str(row))
        self.assertEqual(row,inspect_source("fixture.py",source))
