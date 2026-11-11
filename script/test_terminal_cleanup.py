import unittest
from terminal_cleanup import terminal_cleanup

class TerminalCleanupTests(unittest.TestCase):
    def test_failure_saves_then_invokes_once(self):
        calls=[]
        def fail(): raise OSError("private error not exposed")
        r=terminal_cleanup(fail,lambda x:calls.append(("save",x)),lambda:calls.append(("handoff",None)) or 0)
        self.assertEqual([x[0] for x in calls],["save","save","handoff","save"])
        self.assertEqual(r["error_type"],"OSError")
        self.assertNotIn("private",str(r))
    def test_nonzero_status_preserved(self):
        r=terminal_cleanup(lambda:7,lambda x:None,lambda:0)
        self.assertEqual(r["exit_code"],7)
    def test_no_retry_after_handoff_error(self):
        calls=[]
        def fail(): calls.append(1);raise TimeoutError()
        r=terminal_cleanup(lambda:0,lambda x:None,fail)
        self.assertEqual(calls,[1]);self.assertEqual(r["handoff"],"helper-error")
    def test_unsaved_evidence_never_sends(self):
        def save(x):raise OSError()
        with self.assertRaises(OSError):
            terminal_cleanup(lambda:0,save,lambda:self.fail("must not send"))
    def test_operation_timeout_is_saved_before_handoff(self):
        import subprocess
        saved=[]
        def timeout():raise subprocess.TimeoutExpired("not logged",1)
        def handoff():
            self.assertEqual(saved[-1]["error_type"],"TimeoutExpired")
            return 0
        r=terminal_cleanup(timeout,lambda x:saved.append(x),handoff)
        self.assertEqual(r["operation"],"failed")
        self.assertEqual(r["handoff_exit_code"],0)
