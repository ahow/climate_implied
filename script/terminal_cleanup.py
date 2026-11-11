"""Explicit terminal cleanup, never a watchdog or automatic active-run callback.

Cannot catch process termination, sandbox loss, SIGKILL or platform crashes.
The caller must invoke this ONLY at the true end of a run.
"""
def terminal_cleanup(operation, save, handoff):
    outcome = {"operation": "started", "handoff": "not-attempted"}
    save(dict(outcome))
    try:
        outcome["exit_code"] = operation()
        outcome["operation"] = "completed"
    except Exception as error:
        outcome.update(operation="failed", error_type=type(error).__name__)
    finally:
        # Evidence persistence failure deliberately prevents an unsupported
        # handoff claiming that the evidence was saved.
        save(dict(outcome))
        try:
            outcome["handoff_exit_code"] = handoff()
            outcome["handoff"] = "invoked-existing-helper"
        except Exception as error:
            outcome.update(handoff="helper-error", handoff_error_type=type(error).__name__)
        save(dict(outcome))
    return outcome
