"""JSON output model for an extracted PDF.

All coordinates are in PDF points (1/72 inch) with the origin at the
TOP-LEFT of the page (y grows downward), which is what most consumers expect.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

SCHEMA_VERSION = "1.1.0"

BlockType = Literal["heading", "paragraph", "list_item", "header", "footer"]
Status = Literal["ok", "partial", "failed"]


class BBox(BaseModel):
    x0: float
    top: float
    x1: float
    bottom: float

    @classmethod
    def of(cls, x0: float, top: float, x1: float, bottom: float) -> BBox:
        return cls(x0=round(x0, 2), top=round(top, 2), x1=round(x1, 2), bottom=round(bottom, 2))


class TextBlock(BaseModel):
    id: str
    type: BlockType
    text: str
    bbox: BBox
    font: str | None = None
    font_size: float | None = None
    bold: bool = False
    heading_level: int | None = Field(default=None, description="1 = largest heading")


class Table(BaseModel):
    id: str
    bbox: BBox
    n_rows: int
    n_cols: int
    rows: list[list[str | None]]


class Image(BaseModel):
    id: str
    bbox: BBox
    width_px: int | None = None
    height_px: int | None = None


class Link(BaseModel):
    bbox: BBox | None = None
    uri: str | None = None
    dest_page: int | None = None


class Annotation(BaseModel):
    subtype: str
    contents: str | None = None
    bbox: BBox | None = None


class Page(BaseModel):
    number: int = Field(description="1-based page number")
    width: float
    height: float
    rotation: int = 0
    engine: str = Field(description="Engine that produced this page's text")
    text: str = ""
    char_count: int = 0
    needs_ocr: bool = Field(default=False, description="True if the page looks scanned / has no text layer")
    blocks: list[TextBlock] = []
    tables: list[Table] = []
    images: list[Image] = []
    links: list[Link] = []
    annotations: list[Annotation] = []
    warnings: list[str] = []


class OutlineItem(BaseModel):
    title: str
    level: int
    page: int | None = None


class FormField(BaseModel):
    name: str
    type: str | None = None
    value: str | None = None


class FieldValue(BaseModel):
    """A user-requested variable (see docs/FIELDS.md)."""

    name: str
    found: bool
    value: Any = None
    raw: str | None = Field(default=None, description="text the value was parsed from")
    page: int | None = None
    method: str | None = Field(default=None, description="how it was located, e.g. label:same-line, regex, table")
    error: str | None = None


class Source(BaseModel):
    filename: str
    size_bytes: int
    sha256: str
    pdf_version: str | None = None
    encrypted: bool = False
    page_count: int = 0


class Extraction(BaseModel):
    tool: str = "pdfstruct"
    tool_version: str
    started_at: str
    duration_ms: int
    status: Status
    engines_used: list[str] = []
    pages_failed: list[int] = []
    missing_required_fields: list[str] = []


class Document(BaseModel):
    schema_version: str = SCHEMA_VERSION
    source: Source
    metadata: dict[str, str] = {}
    outline: list[OutlineItem] = []
    form_fields: list[FormField] = []
    fields: dict[str, FieldValue] = Field(default={}, description="variables requested by a spec file")
    pages: list[Page] = []
    warnings: list[str] = []
    extraction: Extraction
