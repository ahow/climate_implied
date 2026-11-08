"""Produce a revised downloadable DOCX without altering the uploaded original."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from xml.etree import ElementTree as ET
import hashlib

SOURCE = Path("attached_assets/Climate_Dashboard_—_Developer_Work_Plan_(1)_1794135026111.docx")
OUTPUT = Path("generated-artifacts/documents/Climate_Dashboard_Amended_Workplan.docx")
NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"

def main():
    amendments = Path("docs/Developer_Workplan_Amendments.md").read_text()
    with ZipFile(SOURCE) as source:
        root = ET.fromstring(source.read("word/document.xml"))
        body = root.find(NS + "body")
        assert body is not None
        # Prepend a controlling amendment, preserving every original table and
        # paragraph. The appendix expressly supersedes conflicting original text.
        lines = ["IMPLEMENTATION AMENDMENTS — 8 November 2026",
                 "These amendments control over conflicting wording in the original plan that follows.",
                 *amendments.splitlines(), "ORIGINAL REVISED WORKPLAN FOLLOWS"]
        for index, line in enumerate(lines):
            p = ET.Element(NS + "p")
            r = ET.SubElement(p, NS + "r")
            t = ET.SubElement(r, NS + "t")
            t.text = line.lstrip("# ")
            body.insert(index, p)
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        with ZipFile(OUTPUT, "w", ZIP_DEFLATED) as out:
            for item in source.infolist():
                out.writestr(item, ET.tostring(root, encoding="utf-8", xml_declaration=True)
                             if item.filename == "word/document.xml" else source.read(item.filename))
    with ZipFile(OUTPUT) as check:
        assert check.testzip() is None
        text = "".join(ET.fromstring(check.read("word/document.xml")).itertext())
        assert "OCF" in text and "right-censored" in text and "Stage 17" in text
    print(f"{OUTPUT} sha256={hashlib.sha256(OUTPUT.read_bytes()).hexdigest()}")

if __name__ == "__main__":
    main()
