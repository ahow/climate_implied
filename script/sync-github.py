"""Push a reviewed, code-only snapshot without exporting private workspace history.

Run after committing and checking changes: python script/sync-github.py
Requires the workspace's configured GitHub Git authentication.
Never force-pushes. Stops if GitHub has changed independently.
"""
import os
from pathlib import Path
import re
import subprocess
import tempfile

REPOSITORY = "https://github.com/ahow/climate_implied.git"
EXPORT_REF = "refs/heads/github-export"
ROOT_FILES = {
    ".gitignore", ".replit", ".replitignore", "README.md", "replit.md",
    "components.json", "drizzle.config.ts", "package.json", "package-lock.json",
    "postcss.config.js", "pyproject.toml", "tailwind.config.ts", "tsconfig.json",
    "uv.lock", "vite.config.ts",
}
SOURCE_DIRS = {"client", "server", "shared", "script", "docs"}


def git(*args, input=None, env=None, check=True):
    return subprocess.run(["git", *args], input=input, stdout=subprocess.PIPE,
                          stderr=subprocess.PIPE, env=env, check=check)


def approved(path):
    parts = Path(path).parts
    return (path in ROOT_FILES or parts[0] in SOURCE_DIRS) and not any(
        p in {"node_modules", "__pycache__", ".env"} or p.startswith(".env.")
        for p in parts
    )


def main():
    os.chdir(git("rev-parse", "--show-toplevel").stdout.decode().strip())
    if git("status", "--porcelain", "--untracked-files=normal").stdout:
        raise SystemExit("Commit/review workspace changes before exporting.")
    source = git("rev-parse", "HEAD").stdout.decode().strip()
    remote = git("ls-remote", REPOSITORY, "refs/heads/main").stdout.decode().split()
    remote_sha = remote[0] if remote else None
    previous = git("rev-parse", "--verify", EXPORT_REF, check=False)
    previous_sha = previous.stdout.decode().strip() if previous.returncode == 0 else None
    if remote_sha != previous_sha:
        raise SystemExit("GitHub differs from the last verified export. Review remote changes; do not force-push.")

    entries = git("ls-tree", "-rz", "HEAD").stdout.split(b"\0")
    selected = []
    fingerprints = [
        rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----",
        rb"gh[pousr]_[A-Za-z0-9]{30,}", rb"github_pat_[A-Za-z0-9_]{30,}",
        rb"AKIA[0-9A-Z]{16}",
        rb"postgres(?:ql)?://[^\s\"']+:[^\s\"']+@",
    ]
    for entry in entries:
        if not entry:
            continue
        info, path_bytes = entry.split(b"\t", 1)
        path = path_bytes.decode()
        if not approved(path):
            continue
        mode, kind, sha = info.split()
        if mode not in {b"100644", b"100755"} or kind != b"blob":
            raise SystemExit(f"Review unsupported export entry: {path}")
        content = git("cat-file", "blob", sha.decode()).stdout
        if any(re.search(pattern, content) for pattern in fingerprints):
            raise SystemExit(f"Possible credential in {path}; review without printing its value.")
        selected.append(mode + b" " + sha + b"\t" + path_bytes + b"\0")
    if not selected:
        raise SystemExit("No source files selected.")

    with tempfile.TemporaryDirectory(prefix="climate-github-index-") as temp:
        env = dict(os.environ, GIT_INDEX_FILE=str(Path(temp) / "index"))
        git("read-tree", "--empty", env=env)
        git("update-index", "-z", "--index-info", input=b"".join(selected), env=env)
        tree = git("write-tree", env=env).stdout.decode().strip()
    if remote_sha and git("rev-parse", f"{remote_sha}^{{tree}}").stdout.decode().strip() == tree:
        print(f"Already synchronized: {remote_sha}")
        return
    args = ["commit-tree", tree]
    if remote_sha:
        args.extend(["-p", remote_sha])
    message = f"Sync application source from workspace {source[:12]}\n\nWorkspace-Source: {source}\nCode-only export; uploaded data and workspace history excluded.\n"
    commit = git(*args, input=message.encode()).stdout.decode().strip()
    # A concurrent remote change causes a normal non-fast-forward rejection.
    git("push", REPOSITORY, f"{commit}:refs/heads/main")
    pushed = git("ls-remote", REPOSITORY, "refs/heads/main").stdout.decode().split()[0]
    if pushed != commit:
        raise SystemExit("Remote changed during verification; investigate before claiming synchronization.")
    git("update-ref", EXPORT_REF, commit)
    print(f"Verified GitHub main: {commit}")
    print(f"Source workspace commit: {source}; exported files: {len(selected)}")


if __name__ == "__main__":
    main()
