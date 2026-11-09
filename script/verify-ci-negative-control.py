"""Authorized, explicit negative workflow rehearsal; never edits source/branches."""
import json
import os
from pathlib import Path
import sys
import time
import urllib.request
import urllib.error

BASE = "https://api.github.com/repos/ahow/climate_implied"


def api(path, payload=None):
    token = os.environ.get("GITHUB_PERSONAL_ACCESS_TOKEN")
    if not token:
        raise ValueError("Configured GitHub credential unavailable")
    request = urllib.request.Request(BASE + path,
        data=json.dumps(payload).encode() if payload is not None else None,
        headers={"Authorization": "Bearer " + token, "Accept": "application/vnd.github+json",
                 "Content-Type": "application/json", "X-GitHub-Api-Version": "2022-11-28"})
    with urllib.request.urlopen(request, timeout=30) as response:
        raw = response.read()
        return json.loads(raw) if raw else None


def branch(name):
    return api("/git/ref/heads/" + name)["object"]["sha"]


def assess(jobs, before, after):
    by_name = {job["name"]: job["conclusion"] for job in jobs}
    return (by_name.get("validate") == "failure" and
            by_name.get("promote") == "skipped" and before == after)


def main():
    if sys.argv[1:] != ["--dispatch"]:
        raise ValueError("Use --dispatch to explicitly request one negative-control run")
    before = branch("production-validated")
    head = branch("main")
    if before != head:
        raise ValueError("Wait until current main is validated before running the control")
    endpoint = "/actions/workflows/validation.yml/runs?event=workflow_dispatch&per_page=100"
    known = {r["id"] for r in api(endpoint)["workflow_runs"]}
    api("/actions/workflows/validation.yml/dispatches",
        {"ref": "main", "inputs": {"negative_control": True}})
    run = None
    for _ in range(60):
        candidates = [r for r in api(endpoint)["workflow_runs"]
                      if r["id"] not in known and r["head_sha"] == head]
        if len(candidates) > 1:
            raise ValueError("Concurrent dispatch makes this control ambiguous")
        if candidates:
            run = candidates[0]
            if run["status"] == "completed":
                break
        time.sleep(5)
    else:
        raise ValueError("Control did not complete within five minutes; inspect GitHub Actions")
    jobs = api(f"/actions/runs/{run['id']}/jobs")["jobs"]
    after = branch("production-validated")
    unchanged_main = branch("main") == head
    report = {"runUrl": run["html_url"], "runId": run["id"], "testedSource": head,
              "protectedBranchBefore": before, "protectedBranchAfter": after,
              "jobs": [{"name": j["name"], "conclusion": j["conclusion"]} for j in jobs],
              "mainUnchanged": unchanged_main, "passed": unchanged_main and assess(jobs, before, after),
              "scope": "Same workflow validate dependency and promotion job; not a broken-source main commit or recovery rehearsal"}
    directory = Path("generated-artifacts/ci-controls")
    directory.mkdir(parents=True, exist_ok=True)
    with (directory / f"{run['id']}.json").open("x") as stream:
        json.dump(report, stream, indent=2)
    print(json.dumps(report, indent=2))
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except urllib.error.HTTPError as error:
        print(f"GitHub request failed: HTTP {error.code}; credentials and response body withheld")
        sys.exit(1)
    except Exception as error:
        # Never stringify network requests or credential-bearing exception objects.
        print(str(error) if isinstance(error, ValueError) else type(error).__name__)
        sys.exit(1)
