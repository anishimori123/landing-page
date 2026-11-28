"""Writes the version number into index.html, so I only change it in ONE place.

The version lives in js/config.js (version: "1.2.3"). index.html loads each file as
file.css?v=1.2.3, so browsers fetch the new files instead of an old saved copy.
This script copies the number from config.js into every ?v=... in index.html.

Run:  python scripts/stamp_version.py
The GitHub robot (.github/workflows/changelog-stats.yml) also runs it on every push.
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONFIG = ROOT / "js" / "config.js"
PAGE = ROOT / "index.html"
VERSION = re.compile(r'version:\s*"(\d+\.\d+\.\d+)"')
STAMP = re.compile(r"\?v=\d+\.\d+\.\d+")


def main():
    version = VERSION.search(CONFIG.read_text(encoding="utf-8")).group(1)
    old = PAGE.read_text(encoding="utf-8")
    new, count = STAMP.subn(f"?v={version}", old)
    if count == 0:
        raise SystemExit("No ?v=... found in index.html. Nothing to stamp.")
    if new != old:
        PAGE.write_text(new, encoding="utf-8")
        print(f"index.html stamped with v{version} ({count} places).")
    else:
        print(f"index.html already at v{version}.")


if __name__ == "__main__":
    main()
