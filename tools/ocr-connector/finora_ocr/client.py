"""Tiny HTTP client for the FINORA `ocr-agent` endpoint (standard library only)."""

from __future__ import annotations

import json
import mimetypes
import urllib.error
import urllib.request
import uuid
from pathlib import Path


class ApiError(Exception):
    def __init__(self, status: int, code: str, detail=None):
        super().__init__(f"{status} {code}" + (f": {detail}" if detail else ""))
        self.status, self.code, self.detail = status, code, detail


class Client:
    def __init__(self, url: str, key: str, timeout: float = 60):
        # url: https://<ref>.supabase.co  (or the full …/functions/v1/ocr-agent)
        url = url.rstrip("/")
        if not url.endswith("/ocr-agent"):
            url = url.split("/rest/v1")[0] + "/functions/v1/ocr-agent"
        self.base, self.key, self.timeout = url, key, timeout

    def _send(self, route: str, body: bytes, ctype: str) -> dict:
        req = urllib.request.Request(
            f"{self.base}/{route}", data=body, method="POST", headers={"x-finora-key": self.key, "content-type": ctype}
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as r:
                return json.loads(r.read() or b"{}")
        except urllib.error.HTTPError as e:
            try:
                err = json.loads(e.read())
            except Exception:
                err = {}
            raise ApiError(e.code, err.get("error") or err.get("code") or "HTTP_ERROR", err.get("detail")) from None

    def post(self, route: str, payload: dict | None = None) -> dict:
        return self._send(route, json.dumps(payload or {}, ensure_ascii=False).encode(), "application/json")

    def ping(self) -> dict:
        return self.post("ping")

    def claim(self, limit: int = 5) -> list[dict]:
        return self.post("claim", {"limit": limit}).get("jobs", [])

    def upload(self, path: Path) -> dict:
        boundary = uuid.uuid4().hex
        mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        head = (
            f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{path.name}"\r\n'
            f"Content-Type: {mime}\r\n\r\n"
        ).encode()
        body = head + path.read_bytes() + f"\r\n--{boundary}--\r\n".encode()
        return self._send("upload", body, f"multipart/form-data; boundary={boundary}")

    def result(self, job_id: str, raw: dict | None, document: dict | None, error: str | None = None) -> dict:
        return self.post("result", {"job_id": job_id, "raw": raw, "document": document, "error": error})

    def download(self, url: str, dst: Path) -> None:
        if url.startswith("/"):
            url = self.base.split("/functions/v1")[0] + url
        with urllib.request.urlopen(url, timeout=self.timeout) as r:
            dst.write_bytes(r.read())
