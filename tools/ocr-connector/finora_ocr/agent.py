"""The connector loop: a watched folder + files uploaded in the app, both read by pdfstruct."""

from __future__ import annotations

import json
import logging
import shutil
import tempfile
import time
from pathlib import Path

from .client import ApiError, Client
from .extract import SUPPORTED, ExtractError, extract

log = logging.getLogger("finora_ocr")


def _move(path: Path, folder: Path) -> Path:
    """Move a user's file (never delete it); keep both if the name is taken."""
    folder.mkdir(parents=True, exist_ok=True)
    dst = folder / path.name
    n = 1
    while dst.exists():
        dst = folder / f"{path.stem} ({n}){path.suffix}"
        n += 1
    shutil.move(str(path), dst)
    return dst


def _stable(path: Path, wait: float = 2.0) -> bool:
    """A file still being copied/scanned changes size; wait until it doesn't."""
    try:
        a = path.stat().st_size
        time.sleep(wait)
        return a == path.stat().st_size and a > 0
    except FileNotFoundError:
        return False


def process_file(client: Client, path: Path, templates: Path | None = None) -> str:
    """Watched-folder file: upload → read → send result. Returns the job status."""
    job = client.upload(path)
    if job.get("duplicate"):
        log.info("%s: already sent before (job %s) - skipped", path.name, job["id"])
        return "duplicate"
    try:
        raw, doc = extract(path, templates=templates)
    except (ExtractError, Exception) as e:
        client.result(job["id"], None, None, error=str(e) or type(e).__name__)
        raise
    res = client.result(job["id"], raw, doc)
    log.info("%s: sent (%s, total %s)", path.name, doc["document_type"], doc["total"])
    return res.get("status", "needs_review")


def process_claimed(client: Client, job: dict, templates: Path | None = None) -> None:
    """A file someone uploaded in the app/phone."""
    with tempfile.TemporaryDirectory() as tmp:
        dst = Path(tmp) / Path(job["file_name"]).name
        try:
            if not job.get("download_url"):
                raise ExtractError("file not found in storage")
            client.download(job["download_url"], dst)
            raw, doc = extract(dst, templates=templates)
        except Exception as e:  # noqa: BLE001
            log.warning("%s: %s", job["file_name"], e)
            client.result(job["id"], None, None, error=str(e) or type(e).__name__)
            return
        client.result(job["id"], raw, doc)
        log.info("%s: sent (%s, total %s)", job["file_name"], doc["document_type"], doc["total"])


def scan_folder(client: Client, folder: Path, templates: Path | None = None) -> int:
    done = 0
    for path in sorted(folder.iterdir()):
        if not path.is_file() or path.suffix.lower() not in SUPPORTED or path.name.startswith((".", "~")):
            continue
        if not _stable(path):
            continue
        try:
            status = process_file(client, path, templates)
            _move(path, folder / "processed" / ("duplicates" if status == "duplicate" else ""))
            done += 1
        except ApiError as e:
            if e.status in (401, 403):
                raise
            log.error("%s: %s", path.name, e)
            _keep_failed(folder, path, str(e))
        except Exception as e:  # noqa: BLE001
            log.error("%s: %s", path.name, e)
            _keep_failed(folder, path, str(e))
    return done


def _keep_failed(folder: Path, path: Path, reason: str) -> None:
    if path.exists():
        dst = _move(path, folder / "failed")
        dst.with_suffix(dst.suffix + ".error.txt").write_text(reason, encoding="utf-8")


def run(client: Client, folder: Path | None, templates: Path | None, interval: float = 10, once: bool = False) -> None:
    try:
        who = client.ping()
    except ApiError as e:
        if e.status in (401, 403):
            log.error("the agent key was refused - create a new one in FINORA (Settings → OCR)")
        else:
            log.error("FINORA is not reachable (%s) - check `url` in finora-ocr.json and that ocr-agent is deployed", e)
        raise SystemExit(2) from None
    except OSError as e:
        log.error("cannot reach FINORA: %s - check the internet connection and `url`", e)
        raise SystemExit(2) from None
    log.info("connected to FINORA: %s", who.get("company"))
    if folder:
        folder.mkdir(parents=True, exist_ok=True)
        log.info("watching %s", folder)
    while True:
        try:
            if folder:
                scan_folder(client, folder, templates)
            for job in client.claim(5):
                process_claimed(client, job, templates)
        except ApiError as e:
            if e.status in (401, 403):
                log.error("the agent key was refused - create a new one in FINORA (Settings → OCR)")
                raise SystemExit(2) from None
            log.error("FINORA: %s", e)
        except OSError as e:  # network down: keep going
            log.error("network: %s", e)
        if once:
            return
        time.sleep(interval)


def dump(doc: dict) -> str:
    return json.dumps(doc, ensure_ascii=False, indent=2)
