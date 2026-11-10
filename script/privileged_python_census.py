"""Static Python call-site discovery. Never imports or executes scanned programs."""
import ast
import hashlib
import json
from pathlib import Path

def inspect_source(path,source):
    tree=ast.parse(source,filename=path)
    operations=[]
    for node in ast.walk(tree):
        if not isinstance(node,ast.Call):
            continue
        fn=node.func
        name=fn.id if isinstance(fn,ast.Name) else fn.attr if isinstance(fn,ast.Attribute) else "dynamic"
        if name in {"urlopen","get","post","put","patch","request","fetch"}:
            kind="network-provider-candidate"
        elif name in {"execute","executemany","commit","rollback"}:
            kind="database-candidate"
        elif name in {"run","Popen","check_call","check_output","system"}:
            kind="subprocess-candidate"
        elif "cache" in name.lower() and any(x in name.lower() for x in ["clear","reset","invalidate"]):
            kind="cache-mutation-candidate"
        else:
            continue
        operations.append({"line":node.lineno,"callee":name,"kind":kind})
    return {"path":path,"sourceSha256":hashlib.sha256(source.encode()).hexdigest(),
            "operations":sorted(operations,key=lambda x:(x["line"],x["callee"]))}

if __name__=="__main__":
    rows=[inspect_source(str(p),p.read_text()) for p in sorted(Path("script").rglob("*.py"))
          if not p.name.startswith("test_")]
    result={"version":"python-privileged-discovery-1","files":rows,
            "limits":["Candidate calls, not authorization or whole-program proof.",
                      "Arguments/URL literals/credential values are deliberately not exported.",
                      "Dynamic Python and shell invocation targets require individual review."]}
    Path("docs/privileged_python_census.json").write_text(json.dumps(result,indent=2)+"\n")
    print(json.dumps({"files":len(rows),"candidates":sum(len(r["operations"]) for r in rows)}))
