"""Run pdfstruct through its command line (the OCR program's public interface, not its internals)."""

from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from .mapping import to_contract

SPEC = Path(__file__).resolve().parent.parent / "thai-documents.spec.yaml"
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".heic"}
SUPPORTED = IMAGE_EXT | {".pdf"}


class ExtractError(Exception):
    pass


def pdfstruct_cmd() -> list[str]:
    exe = shutil.which("pdfstruct")
    if exe:
        return [exe]
    return [sys.executable, "-m", "pdfstruct.cli"]


def pdfstruct_version() -> str:
    try:
        out = subprocess.run([*pdfstruct_cmd(), "--version"], capture_output=True, text=True, timeout=30, check=False)
        return out.stdout.strip().split()[-1] if out.stdout.strip() else ""
    except Exception:
        return ""


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _image_to_pdf(src: Path, dst: Path) -> None:
    try:
        from PIL import Image  # pdfstruct depends on Pillow
    except ImportError as e:  # pragma: no cover
        raise ExtractError("Pillow is needed to read photos") from e
    with Image.open(src) as im:
        im.convert("RGB").save(dst, "PDF", resolution=300)


def _run(target: Path, ocr: str, timeout: float, extra: list[str]) -> tuple[int, str, str]:
    cmd = [
        *pdfstruct_cmd(),
        str(target),
        "--fields-only",
        "--ocr",
        ocr,
        "--isolate",
        "--timeout",
        str(int(timeout)),
        *extra,
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", timeout=timeout + 30, check=False)
    return proc.returncode, proc.stdout, proc.stderr


def extract(path: Path, *, spec: Path = SPEC, templates: Path | None = None, timeout: float = 180) -> tuple[dict, dict]:
    """Return (raw pdfstruct output, contract document).

    With `templates` (a pdfstruct template folder, e.g. from the pdfstruct app), a learned template is
    tried first; its variables should be named like the spec's (document_number, issue_date, total, ...).
    Otherwise / when no template matches, the general Thai spec is used.
    """
    path = Path(path)
    if path.suffix.lower() not in SUPPORTED:
        raise ExtractError(f"unsupported file type: {path.suffix}")
    raw = None
    with tempfile.TemporaryDirectory() as tmp:
        target, ocr = path, "auto"
        if path.suffix.lower() in IMAGE_EXT:
            target, ocr = Path(tmp) / (path.stem + ".pdf"), "force"
            _image_to_pdf(path, target)
        if templates and Path(templates).is_dir():
            code, out, _ = _run(target, ocr, timeout, ["--auto-template", "--store", str(templates)])
            if code in (0, 1) and out.strip():
                cand = json.loads(out)
                f = cand.get("fields") or {}
                if cand.get("template") and (f.get("total") is not None or f.get("document_number")):
                    raw = cand
        if raw is None:
            code, out, err = _run(target, ocr, timeout, ["--spec", str(spec)])
            if code not in (0, 1) or not out.strip():
                raise ExtractError((err or out or "pdfstruct failed").strip()[-2000:])
            raw = json.loads(out)
    doc = to_contract(
        raw, file_name=path.name, sha256=sha256_file(path), engine_version=pdfstruct_version(), ocr_used=ocr == "force"
    )
    return raw, doc
