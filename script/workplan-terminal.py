"""Explicit true-end wrapper. No credentials or destination are read here."""
import argparse,json,subprocess,sys,re
from pathlib import Path
from terminal_cleanup import terminal_cleanup

if __name__ == "__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--checkpoint-id",required=True)
    p.add_argument("--end-of-run",action="store_true",required=True)
    p.add_argument("--timeout",type=int,default=600)
    p.add_argument("command",nargs=argparse.REMAINDER)
    a=p.parse_args()
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,128}",a.checkpoint_id):
        p.error("Stable safe checkpoint ID required")
    if a.timeout <= 0:p.error("Positive terminal operation timeout required")
    command=a.command[1:] if a.command[:1]==["--"] else a.command
    if not command:p.error("explicit final operation required")
    root=Path(__file__).resolve().parents[1]
    folder=root/"generated-artifacts/private-handoff"
    folder.mkdir(parents=True,exist_ok=True)
    receipt=folder/(a.checkpoint_id+"-cleanup.json")
    try:
        with receipt.open("x") as f:json.dump({"operation":"reserved"},f)
    except FileExistsError:
        p.error("terminal attempt already retained; do not automatically retry")
    def save(value):receipt.write_text(json.dumps(value,indent=2)+"\n")
    result=terminal_cleanup(
        lambda:subprocess.run(command,cwd=root,timeout=a.timeout).returncode,save,
        lambda:subprocess.run([sys.executable,"script/workplan-checkpoint.py","--checkpoint-id",a.checkpoint_id],cwd=root).returncode)
    print(json.dumps(result))
