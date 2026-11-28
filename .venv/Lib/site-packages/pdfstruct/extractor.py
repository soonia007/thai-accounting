"""Main extraction pipeline.

Stability strategy
------------------
1. Validate input (magic bytes, size) before handing it to any parser.
2. Use several independent engines and fall back per page:
       pdfplumber (layout, tables)  ->  pypdfium2 (text)  ->  pypdf (text)
   so one broken page never kills the whole document.
3. Document-level data (metadata, outline, forms, links) comes from pypdf in
   non-strict mode, each part guarded separately.
4. Every problem is recorded in ``warnings`` instead of being swallowed.
5. ``extract_isolated`` runs everything in a child process with a hard
   timeout, protecting the caller from hangs / memory blow-ups in parsers.
"""

from __future__ import annotations

import hashlib
import io
import logging
import multiprocessing as mp
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from . import __version__, errors
from .errors import EncryptedPDFError, ExtractionTimeout, NotAPDFError, UnreadablePDFError
from .layout import (
    Word,
    body_font_size,
    classify,
    digits_stripped,
    group_blocks,
    group_lines,
    heading_levels,
)
from .models import (
    Annotation,
    BBox,
    Document,
    Extraction,
    FormField,
    Image,
    Link,
    OutlineItem,
    Page,
    Source,
    Table,
    TextBlock,
)
from .normalize import count_private_use, count_unmapped, normalize_text

log = logging.getLogger(__name__)

MAX_FILE_BYTES = 500 * 1024 * 1024
OCR_CHAR_THRESHOLD = 25
MARGIN_RATIO = 0.08


def _short(exc: BaseException) -> str:
    return f"{type(exc).__name__}: {str(exc)[:200]}"


# --------------------------------------------------------------------------- #
# Document-level information via pypdf
# --------------------------------------------------------------------------- #
class _PypdfInfo:
    def __init__(self, data: bytes, password: str | None, warnings: list[str]):
        from pypdf import PdfReader

        self.reader = None
        self.encrypted = False
        try:
            reader = PdfReader(io.BytesIO(data), strict=False)
        except Exception as exc:  # pragma: no cover - depends on corrupt input
            warnings.append(f"pypdf could not open file: {_short(exc)}")
            return
        if reader.is_encrypted:
            self.encrypted = True
            try:
                ok = reader.decrypt(password or "")
            except Exception as exc:
                raise EncryptedPDFError(f"cannot decrypt: {_short(exc)}") from exc
            if not ok:
                raise EncryptedPDFError("PDF is encrypted; a valid password is required")
        self.reader = reader

    def version(self) -> str | None:
        try:
            return self.reader.pdf_header.replace("%PDF-", "") if self.reader else None
        except Exception:
            return None

    def metadata(self, warnings: list[str]) -> dict[str, str]:
        if not self.reader:
            return {}
        try:
            meta = self.reader.metadata or {}
            return {str(k).lstrip("/"): normalize_text(str(v)) for k, v in meta.items() if v is not None}
        except Exception as exc:
            warnings.append(f"metadata: {_short(exc)}")
            return {}

    def outline(self, warnings: list[str]) -> list[OutlineItem]:
        if not self.reader:
            return []
        items: list[OutlineItem] = []

        def walk(nodes: Any, level: int) -> None:
            for node in nodes:
                if isinstance(node, list):
                    walk(node, level + 1)
                    continue
                try:
                    page = self.reader.get_destination_page_number(node)
                    page = page + 1 if page is not None and page >= 0 else None
                except Exception:
                    page = None
                items.append(OutlineItem(title=normalize_text(str(node.title)), level=level, page=page))

        try:
            walk(self.reader.outline, 1)
        except Exception as exc:
            warnings.append(f"outline: {_short(exc)}")
        return items

    def form_fields(self, warnings: list[str]) -> list[FormField]:
        if not self.reader:
            return []
        try:
            fields = self.reader.get_fields() or {}
        except Exception as exc:
            warnings.append(f"form fields: {_short(exc)}")
            return []
        out = []
        for name, f in fields.items():
            value = f.get("/V")
            out.append(
                FormField(
                    name=str(name),
                    type=str(f.get("/FT")).lstrip("/") if f.get("/FT") else None,
                    value=normalize_text(str(value)) if value is not None else None,
                )
            )
        return out

    def page_count(self) -> int:
        try:
            return len(self.reader.pages) if self.reader else 0
        except Exception:
            return 0

    def links_and_annotations(self, index: int, warnings: list[str]) -> tuple[list[Link], list[Annotation]]:
        links: list[Link] = []
        annots: list[Annotation] = []
        if not self.reader:
            return links, annots
        try:
            page = self.reader.pages[index]
            box = page.mediabox
            left, page_top = float(box.left), float(box.top)
            raw = page.get("/Annots") or []
            raw = raw.get_object() if hasattr(raw, "get_object") else raw
            for ref in raw:
                a = ref.get_object()
                subtype = str(a.get("/Subtype", "")).lstrip("/")
                bbox = None
                rect = a.get("/Rect")
                if rect and len(rect) == 4:
                    x0, y0, x1, y1 = (float(v) for v in rect)
                    bbox = BBox.of(
                        min(x0, x1) - left, page_top - max(y0, y1), max(x0, x1) - left, page_top - min(y0, y1)
                    )
                if subtype == "Link":
                    uri, dest_page = None, None
                    action = a.get("/A")
                    action = action.get_object() if action is not None else None
                    if action is not None and action.get("/URI") is not None:
                        uri = str(action.get("/URI"))
                    dest = a.get("/Dest") or (action.get("/D") if action is not None else None)
                    if dest is not None:
                        dest_page = self._dest_page(dest)
                    links.append(Link(bbox=bbox, uri=uri, dest_page=dest_page))
                elif subtype not in ("Widget", "Popup"):
                    contents = a.get("/Contents")
                    annots.append(
                        Annotation(
                            subtype=subtype,
                            contents=normalize_text(str(contents)) if contents is not None else None,
                            bbox=bbox,
                        )
                    )
        except Exception as exc:
            warnings.append(f"annotations: {_short(exc)}")
        return links, annots

    def _dest_page(self, dest: Any) -> int | None:
        try:
            dest = dest.get_object() if hasattr(dest, "get_object") else dest
            if isinstance(dest, (str, bytes)) or type(dest).__name__ in ("TextStringObject", "NameObject"):
                named = self.reader.named_destinations.get(str(dest))
                return self.reader.get_destination_page_number(named) + 1 if named else None
            page_ref = dest[0]
            for i, p in enumerate(self.reader.pages):
                if p.indirect_reference == page_ref:
                    return i + 1
        except Exception:
            return None
        return None

    def text(self, index: int) -> str:
        return self.reader.pages[index].extract_text() if self.reader else ""


# --------------------------------------------------------------------------- #
# Page extraction engines
# --------------------------------------------------------------------------- #
def _inside(word: dict, boxes: list[tuple[float, float, float, float]]) -> bool:
    cx, cy = (word["x0"] + word["x1"]) / 2, (word["top"] + word["bottom"]) / 2
    return any(x0 <= cx <= x1 and t <= cy <= b for x0, t, x1, b in boxes)


def _page_with_pdfplumber(pl_page: Any, number: int, with_tables: bool) -> tuple[Page, list]:
    warnings: list[str] = []
    tables: list[Table] = []
    table_boxes: list[tuple[float, float, float, float]] = []
    if with_tables:
        try:
            for t in pl_page.find_tables():
                rows = [[normalize_text(c) if c is not None else None for c in row] for row in t.extract()]
                n_cols = max((len(r) for r in rows), default=0)
                if len(rows) < 1 or n_cols < 2:
                    continue
                table_boxes.append(t.bbox)
                tables.append(
                    Table(
                        id=f"p{number}-t{len(tables) + 1}",
                        bbox=BBox.of(*t.bbox),
                        n_rows=len(rows),
                        n_cols=n_cols,
                        rows=rows,
                    )
                )
        except Exception as exc:
            warnings.append(f"tables: {_short(exc)}")

    raw_words = pl_page.extract_words(extra_attrs=["fontname", "size"], keep_blank_chars=False)
    words = [
        Word(
            text=normalize_text(w["text"]),
            x0=w["x0"],
            top=w["top"],
            x1=w["x1"],
            bottom=w["bottom"],
            font=w.get("fontname"),
            size=float(w.get("size") or 0),
        )
        for w in raw_words
        if not _inside(w, table_boxes) and w["text"].strip()
    ]
    raw_blocks = group_blocks(group_lines(words))

    images: list[Image] = []
    for img in pl_page.images:
        try:
            src = img.get("srcsize") or (None, None)
            images.append(
                Image(
                    id=f"p{number}-i{len(images) + 1}",
                    bbox=BBox.of(img["x0"], img["top"], img["x1"], img["bottom"]),
                    width_px=int(src[0]) if src[0] else None,
                    height_px=int(src[1]) if src[1] else None,
                )
            )
        except Exception as exc:
            warnings.append(f"image: {_short(exc)}")

    text = normalize_text(pl_page.extract_text() or "")
    page = Page(
        number=number,
        width=round(float(pl_page.width), 2),
        height=round(float(pl_page.height), 2),
        rotation=int(getattr(pl_page, "rotation", 0) or 0),
        engine="pdfplumber",
        text=text,
        char_count=len(text.replace("\n", "").replace(" ", "")),
        tables=tables,
        images=images,
        warnings=warnings,
    )
    return page, raw_blocks


def _page_with_pdfium(pdfium_doc: Any, index: int) -> Page:
    p = pdfium_doc[index]
    try:
        w, h = p.get_size()
        tp = p.get_textpage()
        try:
            text = normalize_text(tp.get_text_bounded())
        finally:
            tp.close()
        rotation = int(p.get_rotation() or 0)
    finally:
        p.close()
    return Page(
        number=index + 1,
        width=round(w, 2),
        height=round(h, 2),
        rotation=rotation,
        engine="pypdfium2",
        text=text,
        char_count=len(text.replace("\n", "").replace(" ", "")),
    )


def _page_with_pypdf(info: _PypdfInfo, index: int) -> Page:
    page = info.reader.pages[index]
    text = normalize_text(page.extract_text())
    box = page.mediabox
    return Page(
        number=index + 1,
        width=round(float(box.width), 2),
        height=round(float(box.height), 2),
        rotation=int(page.rotation or 0),
        engine="pypdf",
        text=text,
        char_count=len(text.replace("\n", "").replace(" ", "")),
    )


# --------------------------------------------------------------------------- #
# Document-level post-processing
# --------------------------------------------------------------------------- #
def _finalise_blocks(pages: list[Page], raw: dict[int, list]) -> None:
    all_blocks = [b for blocks in raw.values() for b in blocks]
    if not all_blocks:
        return
    body = body_font_size(all_blocks)

    # Repeated text in the top/bottom margin across pages => header / footer.
    margin_keys: Counter[str] = Counter()
    pages_by_no = {p.number: p for p in pages}
    for no, blocks in raw.items():
        h = pages_by_no[no].height
        keys = set()
        for b in blocks:
            _, top, _, bottom = b.bbox
            if bottom <= h * MARGIN_RATIO or top >= h * (1 - MARGIN_RATIO):
                keys.add(digits_stripped(b.text))
        margin_keys.update(keys)
    repeat_threshold = max(2, int(len(raw) * 0.5))

    typed: dict[int, list[tuple[Any, str]]] = {}
    heading_sizes = []
    for no, blocks in raw.items():
        h = pages_by_no[no].height
        typed[no] = []
        for b in blocks:
            _, top, _, bottom = b.bbox
            kind = classify(b, body)
            in_margin = bottom <= h * MARGIN_RATIO or top >= h * (1 - MARGIN_RATIO)
            if in_margin and len(raw) >= 2 and margin_keys[digits_stripped(b.text)] >= repeat_threshold:
                kind = "header" if top < h / 2 else "footer"
            if kind == "heading":
                heading_sizes.append(b.size)
            typed[no].append((b, kind))

    levels = heading_levels(heading_sizes)
    for no, items in typed.items():
        page = pages_by_no[no]
        page.blocks = [
            TextBlock(
                id=f"p{no}-b{i + 1}",
                type=kind,
                text=b.text,
                bbox=BBox.of(*b.bbox),
                font=b.font,
                font_size=round(b.size, 2),
                bold=b.bold,
                heading_level=levels.get(round(b.size, 1)) if kind == "heading" else None,
            )
            for i, (b, kind) in enumerate(items)
        ]


def _flag_ocr(page: Page) -> None:
    area = max(page.width * page.height, 1.0)
    img_area = sum((i.bbox.x1 - i.bbox.x0) * (i.bbox.bottom - i.bbox.top) for i in page.images)
    if page.char_count < OCR_CHAR_THRESHOLD and (page.char_count == 0 or img_area / area > 0.3):
        page.needs_ocr = True
        page.warnings.append("page has little or no text layer; OCR needed (see roadmap phase 3)")
    pua = count_private_use(page.text)
    if pua:
        page.warnings.append(f"{pua} private-use characters: font has no usable ToUnicode map, text may be garbled")
    unmapped = count_unmapped(page.text)
    if unmapped:
        page.warnings.append(f"{unmapped} glyphs could not be mapped to Unicode (shown as U+FFFD)")


# --------------------------------------------------------------------------- #
# Public API
# --------------------------------------------------------------------------- #
def extract(
    path: str | Path,
    *,
    password: str | None = None,
    tables: bool = True,
    max_pages: int | None = None,
    spec: Any = None,
) -> Document:
    """Extract the structure of a PDF into a :class:`Document`.

    ``spec`` (path to a YAML/JSON file, a dict or a :class:`pdfstruct.fields.Spec`)
    lists the variables to pull out into ``Document.fields``.
    """
    from .fields import apply_spec, load_spec

    loaded_spec = load_spec(spec) if spec is not None else None  # fail fast on a bad spec
    t0 = time.monotonic()
    started = datetime.now(timezone.utc).isoformat(timespec="seconds")
    path = Path(path)
    data = path.read_bytes()
    if len(data) > MAX_FILE_BYTES:
        raise UnreadablePDFError(f"file larger than {MAX_FILE_BYTES} bytes")
    if b"%PDF-" not in data[:1024]:
        raise NotAPDFError(f"{path.name}: no %PDF- header in the first 1024 bytes")

    warnings: list[str] = []
    engines: set[str] = set()
    info = _PypdfInfo(data, password, warnings)

    import pdfplumber
    import pypdfium2 as pdfium

    pl_doc = pdfium_doc = None
    try:
        pl_doc = pdfplumber.open(io.BytesIO(data), password=password or "")
    except Exception as exc:
        warnings.append(f"pdfplumber could not open file: {_short(exc)}")
    try:
        pdfium_doc = pdfium.PdfDocument(data, password=password)
    except Exception as exc:
        warnings.append(f"pypdfium2 could not open file: {_short(exc)}")

    counts = [info.page_count(), len(pl_doc.pages) if pl_doc else 0, len(pdfium_doc) if pdfium_doc else 0]
    n_pages = max(counts)
    if n_pages == 0:
        raise UnreadablePDFError("no engine could read any page; " + "; ".join(warnings))
    if len({c for c in counts if c}) > 1:
        warnings.append(f"engines disagree on page count {counts}; using {n_pages}")
    if max_pages is not None:
        n_pages = min(n_pages, max_pages)

    pages: list[Page] = []
    raw_blocks: dict[int, list] = {}
    failed: list[int] = []
    try:
        for i in range(n_pages):
            number = i + 1
            page: Page | None = None
            errors: list[str] = []
            if pl_doc and i < len(pl_doc.pages):
                try:
                    pl_page = pl_doc.pages[i]
                    page, blocks = _page_with_pdfplumber(pl_page, number, tables)
                    raw_blocks[number] = blocks
                    pl_page.close()
                except Exception as exc:
                    errors.append(f"pdfplumber: {_short(exc)}")
            if page is None and pdfium_doc and i < len(pdfium_doc):
                try:
                    page = _page_with_pdfium(pdfium_doc, i)
                except Exception as exc:
                    errors.append(f"pypdfium2: {_short(exc)}")
            if page is None and info.reader and i < info.page_count():
                try:
                    page = _page_with_pypdf(info, i)
                except Exception as exc:
                    errors.append(f"pypdf: {_short(exc)}")
            if page is None:
                failed.append(number)
                page = Page(number=number, width=0, height=0, engine="none")
            page.warnings.extend(f"engine failed - {e}" for e in errors)
            engines.add(page.engine)
            if page.engine != "none":
                links, annots = info.links_and_annotations(i, page.warnings)
                page.links, page.annotations = links, annots
                _flag_ocr(page)
            pages.append(page)
    finally:
        if pl_doc:
            pl_doc.close()
        if pdfium_doc:
            pdfium_doc.close()

    _finalise_blocks(pages, raw_blocks)

    status = "ok" if not failed else ("failed" if len(failed) == n_pages else "partial")
    doc = Document(
        source=Source(
            filename=path.name,
            size_bytes=len(data),
            sha256=hashlib.sha256(data).hexdigest(),
            pdf_version=info.version(),
            encrypted=info.encrypted,
            page_count=n_pages,
        ),
        metadata=info.metadata(warnings),
        outline=info.outline(warnings),
        form_fields=info.form_fields(warnings),
        pages=pages,
        warnings=warnings,
        extraction=Extraction(
            tool_version=__version__,
            started_at=started,
            duration_ms=int((time.monotonic() - t0) * 1000),
            status=status,
            engines_used=sorted(engines - {"none"}),
            pages_failed=failed,
        ),
    )
    if loaded_spec is not None:
        apply_spec(doc, loaded_spec)
        doc.extraction.duration_ms = int((time.monotonic() - t0) * 1000)
    return doc


def _worker(path: str, kwargs: dict, conn: Any) -> None:
    try:
        conn.send(("ok", extract(path, **kwargs).model_dump_json()))
    except errors.PDFStructError as exc:
        conn.send(("error", type(exc).__name__, str(exc)))
    except BaseException as exc:  # report anything, never leave the parent waiting
        conn.send(("crash", _short(exc)))
    finally:
        conn.close()


def extract_isolated(path: str | Path, *, timeout: float = 120.0, **kwargs: Any) -> Document:
    """Run :func:`extract` in a separate process with a hard timeout.

    Use this for untrusted / unknown PDFs: a parser hang, crash, segfault or
    memory blow-up only kills the child process. Raises ``ExtractionTimeout``
    on timeout and ``UnreadablePDFError`` if the child dies without a result.
    """
    ctx = mp.get_context("spawn")
    recv, send = ctx.Pipe(duplex=False)
    proc = ctx.Process(target=_worker, args=(str(path), kwargs, send), daemon=True)
    proc.start()
    send.close()  # the parent only reads; EOF now means "child is gone"
    try:
        if not recv.poll(timeout):
            raise ExtractionTimeout(f"extraction exceeded {timeout}s")
        try:
            msg = recv.recv()
        except EOFError:
            proc.join(5)
            raise UnreadablePDFError(f"worker process died without a result (exit code {proc.exitcode})") from None
    finally:
        if proc.is_alive():
            proc.kill()
        proc.join(5)
        recv.close()
    if msg[0] == "ok":
        return Document.model_validate_json(msg[1])
    if msg[0] == "error":
        exc_type = getattr(errors, msg[1], errors.PDFStructError)
        raise exc_type(msg[2])
    raise UnreadablePDFError(f"worker crashed: {msg[1]}")
