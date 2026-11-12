#!/usr/bin/env python3
"""Mandatory local original-DOCX assertions. Missing bytes fail, never skip.

Public CI checks retained checksum/clauses and every public source hash. This
validator keeps the original private byte assertion and strengthens it with
exact original-clause comparisons. No collection, scoring or refreezing.
"""
import hashlib
import json
from pathlib import Path
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[1]
ORIGINAL = "attached_assets/Climate_Dashboard_—_Developer_Work_Plan_(1)_1794135026111.docx"
ORIGINAL_SHA256 = "f11261326be34b7f44129709a447017459de13e813046cd732721b4660df11f2"


def normalize(value):
    return " ".join(value.split())


def main():
    evidence = json.loads((ROOT / "docs/status-choice-width-increment-evidence.json").read_text())
    assert evidence["privateSources"] == [{"path": ORIGINAL, "sha256": ORIGINAL_SHA256}]
    # Intentionally unconditional: absent/corrupt private bytes are a failure.
    raw = (ROOT / ORIGINAL).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == ORIGINAL_SHA256, "Original DOCX checksum mismatch"
    with zipfile.ZipFile(ROOT / ORIGINAL) as archive:
        document = ET.fromstring(archive.read("word/document.xml"))
    ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    paragraphs = ["".join(p.itertext()) for p in document.findall(".//w:p", ns)]
    retained_text = normalize("\n".join(paragraphs))
    clauses = evidence["originalClauses"]
    exact = [
        *clauses["S07-003"],
        clauses["S11-001"]["parent"],
        *clauses["S11-001"]["children"],
        clauses["S13-010"]["exact"],
        *clauses["S13-010"]["adjacentBindingClauses"],
    ]
    assert len(exact) == 14, "The complete original clause domain must be retained"
    for clause in exact:
        assert normalize(clause) in retained_text, f"Original clause differs: {clause}"
    assert evidence["scientificAcceptance"] is False
    assert evidence["oldCorpusScored"] is False
    print(json.dumps({
        "validator": "status-choice-width-private-1", "originalByteAssertions": 1,
        "originalClauseAssertions": len(exact), "missingFilesSkipped": 0,
        "scientificAcceptance": False, "oldCorpusScored": False,
    }))


if __name__ == "__main__":
    main()
