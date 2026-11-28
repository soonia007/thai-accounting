"""Command line interface: ``pdfstruct input.pdf [-o out.json]``."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from . import __version__
from .errors import PDFStructError
from .extractor import extract, extract_isolated
from .fields import filter_output, load_spec
from .models import Document

EXIT_OK, EXIT_PARTIAL, EXIT_ERROR = 0, 1, 2


def _run_one(src: Path, args: argparse.Namespace) -> tuple[int, str]:
    kwargs = {
        "password": args.password,
        "tables": not args.no_tables,
        "max_pages": args.max_pages,
        "spec": args.loaded_spec,
    }
    try:
        doc = extract_isolated(src, timeout=args.timeout, **kwargs) if args.isolate else extract(src, **kwargs)
    except PDFStructError as exc:
        return EXIT_ERROR, json.dumps({"error": type(exc).__name__, "message": str(exc), "file": src.name})
    ok = doc.extraction.status == "ok" and not doc.extraction.missing_required_fields
    code = EXIT_OK if ok else EXIT_PARTIAL
    indent = 2 if args.pretty else None
    if args.fields_only:
        out = {
            "file": doc.source.filename,
            "fields": {k: v.value for k, v in doc.fields.items()},
            "missing_required_fields": doc.extraction.missing_required_fields,
            "details": {k: v.model_dump(exclude_none=True) for k, v in doc.fields.items()},
        }
        return code, json.dumps(out, indent=indent, ensure_ascii=False)
    data = doc.model_dump(mode="json", exclude_none=args.compact)
    include = args.loaded_spec.include if args.loaded_spec else None
    return code, json.dumps(filter_output(data, include), indent=indent, ensure_ascii=False)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="pdfstruct", description="Extract PDF structure to JSON.")
    p.add_argument("input", nargs="?", type=Path, help="PDF file or directory of PDFs")
    p.add_argument("-o", "--output", type=Path, help="output file (single input) or directory")
    p.add_argument("--password", help="password for encrypted PDFs")
    p.add_argument("--no-tables", action="store_true", help="skip table detection (faster)")
    p.add_argument("--max-pages", type=int, help="only process the first N pages")
    p.add_argument("--isolate", action="store_true", help="run in a child process with a hard timeout")
    p.add_argument("--timeout", type=float, default=120.0, help="timeout in seconds for --isolate")
    p.add_argument("--spec", type=Path, help="YAML/JSON file listing the variables to extract (docs/FIELDS.md)")
    p.add_argument("--fields-only", action="store_true", help="output only the variables from --spec")
    p.add_argument("--pretty", action="store_true", help="indent the JSON output")
    p.add_argument("--compact", action="store_true", help="omit null fields")
    p.add_argument("--schema", action="store_true", help="print the JSON Schema of the output and exit")
    p.add_argument("--version", action="version", version=f"pdfstruct {__version__}")
    args = p.parse_args(argv)

    if args.schema:
        print(json.dumps(Document.model_json_schema(), indent=2, ensure_ascii=False))
        return EXIT_OK
    if args.input is None:
        p.error("input is required")
    if args.fields_only and not args.spec:
        p.error("--fields-only needs --spec")
    try:
        args.loaded_spec = load_spec(args.spec) if args.spec else None
    except PDFStructError as exc:
        print(json.dumps({"error": type(exc).__name__, "message": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return EXIT_ERROR

    if args.input.is_dir():
        files = sorted(args.input.rglob("*.pdf"))
        out_dir = args.output or args.input
        out_dir.mkdir(parents=True, exist_ok=True)
        worst = EXIT_OK
        for f in files:
            code, payload = _run_one(f, args)
            (out_dir / f"{f.stem}.json").write_text(payload, encoding="utf-8")
            print(f"[{'ok' if code == 0 else 'partial' if code == 1 else 'error'}] {f}", file=sys.stderr)
            worst = max(worst, code)
        return worst

    code, payload = _run_one(args.input, args)
    if args.output:
        args.output.write_text(payload, encoding="utf-8")
    else:
        sys.stdout.write(payload + "\n")
    if code == EXIT_ERROR:
        print(payload, file=sys.stderr)
    return code


if __name__ == "__main__":
    raise SystemExit(main())
