"""Draws the "Project growth" line charts at the top of CHANGELOG.md.

- Total time spent: added up from each version's "(time spent: ~N min)"
- Lines of code: counted in index.html, css/ and js/ and remembered per version
  in stats/code-lines.json (the version comes from js/config.js)

Run:  python scripts/changelog_stats.py
Only the box between the PROJECT-STATS markers is changed. History entries are never touched.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CHANGELOG = ROOT / "CHANGELOG.md"
STATS = ROOT / "stats" / "code-lines.json"
START = "<!-- PROJECT-STATS:START (auto-updated by GitHub, don't edit by hand) -->"
END = "<!-- PROJECT-STATS:END -->"
ENTRY = re.compile(r"^## v(\d+\.\d+\.\d+) — (\d{4}-\d{2}-\d{2}) \(time spent: ~(\d+) min\)", re.MULTILINE)
VERSION = re.compile(r'version:\s*"(\d+\.\d+\.\d+)"')


def count_code_lines():
    files = [ROOT / "index.html", *sorted((ROOT / "css").glob("*.css")), *sorted((ROOT / "js").glob("*.js"))]
    return sum(1 for f in files if f.exists() for line in f.read_text(encoding="utf-8").splitlines() if line.strip())


def vkey(v):
    return tuple(int(x) for x in v.split("."))


def chart(title, labels, values, y_name):
    top = max(values) if values else 1
    return "\n".join([
        "```mermaid",
        "xychart-beta",
        f'    title "{title}"',
        "    x-axis [" + ", ".join(f'"v{v}"' for v in labels) + "]",
        f'    y-axis "{y_name}" 0 --> {int(top * 1.2) + 1}',
        "    line [" + ", ".join(str(v) for v in values) + "]",
        "```",
    ])


def main():
    text = CHANGELOG.read_text(encoding="utf-8")

    # Remember this version's code size
    current = VERSION.search((ROOT / "js" / "config.js").read_text(encoding="utf-8")).group(1)
    lines = json.loads(STATS.read_text(encoding="utf-8")) if STATS.exists() else {}
    lines[current] = count_code_lines()
    STATS.parent.mkdir(exist_ok=True)
    STATS.write_text(json.dumps(dict(sorted(lines.items(), key=lambda kv: vkey(kv[0]))), indent=2) + "\n", encoding="utf-8")

    # Time spent per version, oldest first
    entries = sorted(((v, int(m)) for v, _, m in ENTRY.findall(text)), key=lambda e: vkey(e[0]))
    versions = [v for v, _ in entries]
    total, minutes = 0, []
    for _, m in entries:
        total += m
        minutes.append(total)
    code = [lines.get(v) for v in versions]
    known = [(v, c) for v, c in zip(versions, code) if c is not None]

    box = "\n".join([
        START,
        "## Project growth",
        f"**{len(versions)}** versions · **{total}** min (~{total / 60:.1f} h) spent · **{lines[current]:,}** lines of code now",
        "",
        chart("Total time spent (minutes)", versions, minutes, "minutes"),
        "",
        chart("Lines of code", [v for v, _ in known], [c for _, c in known], "lines"),
        END,
    ])

    if START in text and END in text:
        new = text.split(START)[0] + box + text.split(END, 1)[1]
    else:  # first run: put the box right under the title
        title, _, rest = text.partition("\n")
        new = f"{title}\n\n{box}\n{rest}"
    if new != text:
        CHANGELOG.write_text(new, encoding="utf-8")
        print("CHANGELOG charts updated.")
    else:
        print("No change.")


if __name__ == "__main__":
    main()
