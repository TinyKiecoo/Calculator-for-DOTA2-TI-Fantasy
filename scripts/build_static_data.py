#!/usr/bin/env python3
"""Rebuild the compact snapshot and wrap it as a classic browser script.

The generated file deliberately avoids fetch() and ES modules so index.html
can be opened directly through file://.
"""

from __future__ import annotations

import json
from pathlib import Path

from fetch_ewc_2026 import build_summary


ROOT = Path(__file__).resolve().parent.parent
FULL_SOURCE = ROOT / "data" / "ewc_2026_fantasy.json"
SUMMARY_TARGET = ROOT / "data" / "ewc_2026_summary.json"
TARGET = ROOT / "data" / "ewc_2026_data.js"


def main() -> None:
    full_dataset = json.loads(FULL_SOURCE.read_text(encoding="utf-8"))
    dataset = build_summary(full_dataset)
    payload = json.dumps(
        dataset,
        ensure_ascii=False,
        separators=(",", ":"),
    )
    SUMMARY_TARGET.write_text(
        payload + "\n",
        encoding="utf-8",
        newline="\n",
    )
    TARGET.write_text(
        "window.FANTASY_EWC_2026=" + payload + ";\n",
        encoding="utf-8",
        newline="\n",
    )
    print(
        f"Wrote {SUMMARY_TARGET.relative_to(ROOT)} "
        f"({SUMMARY_TARGET.stat().st_size:,} bytes)"
    )
    print(f"Wrote {TARGET.relative_to(ROOT)} ({TARGET.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
