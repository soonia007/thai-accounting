"""Command line:

  python -m finora_ocr check bill.pdf            read one file and print the JSON (nothing is sent)
  python -m finora_ocr run                        watch the folder + read files uploaded in the app
  python -m finora_ocr run --once                 one pass, then exit (for Task Scheduler / cron)

Settings come from finora-ocr.json next to this folder (see finora-ocr.example.json) or env vars
FINORA_URL, FINORA_OCR_KEY, FINORA_WATCH_DIR, FINORA_TEMPLATES.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from pathlib import Path

from . import __version__
from .agent import dump, run
from .client import Client
from .extract import extract

CONFIG = Path(__file__).resolve().parent.parent / "finora-ocr.json"


def load_config(path: Path) -> dict:
    cfg = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    env = {
        "url": "FINORA_URL",
        "key": "FINORA_OCR_KEY",
        "watch_dir": "FINORA_WATCH_DIR",
        "templates": "FINORA_TEMPLATES",
    }
    for k, e in env.items():
        if os.environ.get(e):
            cfg[k] = os.environ[e]
    return cfg


def main(argv: list[str] | None = None) -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    p = argparse.ArgumentParser(prog="finora_ocr", description="FINORA OCR connector (pdfstruct)")
    p.add_argument("--version", action="version", version=__version__)
    p.add_argument("--config", type=Path, default=CONFIG)
    sub = p.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("check", help="read one file and print the FINORA JSON (nothing is sent)")
    c.add_argument("file", type=Path)
    c.add_argument("--raw", action="store_true", help="print pdfstruct's own output too")
    r = sub.add_parser("run", help="send documents to FINORA")
    r.add_argument("--once", action="store_true")
    r.add_argument("--interval", type=float, default=10)
    args = p.parse_args(argv)
    cfg = load_config(args.config)
    templates = Path(cfg["templates"]) if cfg.get("templates") else None

    if args.cmd == "check":
        raw, doc = extract(args.file, templates=templates)
        print(dump({"pdfstruct": raw, "document": doc} if args.raw else doc))
        return 0

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s", datefmt="%H:%M:%S")
    if not cfg.get("url") or not cfg.get("key"):
        print("Missing url/key - copy finora-ocr.example.json to finora-ocr.json and fill it in.", file=sys.stderr)
        return 2
    folder = Path(cfg["watch_dir"]).expanduser() if cfg.get("watch_dir") else None
    run(Client(cfg["url"], cfg["key"]), folder, templates, args.interval, args.once)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
