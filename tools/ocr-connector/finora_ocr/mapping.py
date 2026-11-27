"""pdfstruct `--fields-only` output (with thai-documents.spec.yaml) -> FINORA contract ocr-document.v1.

Pure functions, no I/O, so they are easy to test. Rules:
- never invent a number the document does not show, except where it follows arithmetically
  (amount = qty x unit price, subtotal = total - VAT); derived values get a lower confidence;
- unknown -> null; the app's review step (M19/M20) checks totals, tax ids and duplicates.
"""

from __future__ import annotations

import re
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

DERIVED = 0.5  # confidence for values computed rather than read
LINE_FIELDS = ("lines", "lines_unit", "lines_en", "lines_simple")


def money(v: Any) -> float | None:
    if v is None or v == "":
        return None
    try:
        return float(Decimal(str(v)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
    except Exception:
        return None


def document_type(title: str | None) -> str:
    t = (title or "").lower()
    has_tax = "ใบกำกับภาษี" in t or "tax invoice" in t
    has_receipt = "ใบเสร็จ" in t or "receipt" in t
    if "ใบลดหนี้" in t or "credit note" in t:
        return "credit_note"
    if "ใบเพิ่มหนี้" in t or "debit note" in t:
        return "debit_note"
    if has_tax and has_receipt:
        return "tax_invoice_receipt"
    if has_tax:
        return "tax_invoice"
    if has_receipt:
        return "receipt"
    if "บิลเงินสด" in t or "cash bill" in t:
        return "cash_bill"
    if "ใบแจ้งหนี้" in t or "invoice" in t:
        return "invoice"
    return "other"


def _tax_ids(v: Any) -> list[str]:
    vals = v if isinstance(v, list) else [v] if v else []
    out: list[str] = []
    for x in vals:
        s = re.sub(r"\D", "", str(x))
        if len(s) == 13 and s not in out:
            out.append(s)
    return out


def _lines(fields: dict, details: dict) -> tuple[list[dict], float | None]:
    for name in LINE_FIELDS:
        rows = fields.get(name)
        if not rows:
            continue
        out = []
        for r in rows:
            desc = str(r.get("description") or "").strip()
            qty = r.get("qty")
            unit = money(r.get("unit_price"))
            amount = money(r.get("amount"))
            if amount is None and qty is not None and unit is not None:
                amount = money(Decimal(str(qty)) * Decimal(str(r.get("unit_price"))))  # unrounded price
            if not desc or amount is None:
                continue  # blank / sub-total rows
            out.append({"description": desc[:500], "qty": qty, "unit_price": unit, "amount": amount})
        if out:
            return out, (details.get(name) or {}).get("confidence")
    return [], None


def to_contract(
    pdfstruct: dict,
    *,
    file_name: str,
    sha256: str | None = None,
    engine_version: str | None = None,
    ocr_used: bool | None = None,
) -> dict:
    fields: dict = pdfstruct.get("fields") or {}
    details: dict = pdfstruct.get("details") or {}
    conf: dict[str, float] = {}
    warnings: list[str] = []

    def c(field: str, key: str | None = None) -> None:
        v = (details.get(field) or {}).get("confidence")
        if v is not None and (details.get(field) or {}).get("found", True):
            conf[key or field] = round(float(v), 2)

    tax_ids = _tax_ids(fields.get("tax_ids"))
    seller = {
        "name": fields.get("seller_name"),
        "tax_id": tax_ids[0] if tax_ids else None,
        "branch": fields.get("branch"),
        "address": None,
    }
    buyer = {
        "name": fields.get("buyer_name"),
        "tax_id": tax_ids[1] if len(tax_ids) > 1 else None,
        "branch": None,
        "address": None,
    }
    c("seller_name", "seller.name")
    c("buyer_name", "buyer.name")
    if tax_ids:
        c("tax_ids", "seller.tax_id")
        if len(tax_ids) > 1:
            c("tax_ids", "buyer.tax_id")
    if len(tax_ids) > 2:
        warnings.append(f"found {len(tax_ids)} tax ids; used the first as seller, second as buyer")

    total = money(fields.get("total"))
    vat_amount = money(fields.get("vat_amount"))
    vat_rate = fields.get("vat_rate")
    subtotal = money(fields.get("subtotal"))
    discount = money(fields.get("discount"))
    for f in (
        "total",
        "vat_amount",
        "vat_rate",
        "subtotal",
        "discount",
        "wht_rate",
        "wht_amount",
        "document_number",
        "issue_date",
    ):
        c(f)
    if subtotal is None and total is not None:
        subtotal = money(total - (vat_amount or 0))
        conf["subtotal"] = DERIVED
    if vat_rate is None and vat_amount and subtotal:
        guess = round(vat_amount / (subtotal - (discount or 0)) * 100, 2) if subtotal - (discount or 0) else None
        if guess is not None and abs(guess - 7) < 0.05:
            vat_rate = 7.0
            conf["vat_rate"] = DERIVED

    lines, lines_conf = _lines(fields, details)
    if lines:
        if lines_conf is not None:
            conf["lines"] = round(float(lines_conf), 2)
    elif subtotal is not None:
        lines = [
            {"description": fields.get("title") or "ตามเอกสาร", "qty": 1, "unit_price": subtotal, "amount": subtotal}
        ]
        conf["lines"] = DERIVED
        warnings.append("no item table found; one line for the whole amount")

    missing = pdfstruct.get("missing_required_fields") or []
    if missing:
        warnings.append("not found: " + ", ".join(missing))

    title = fields.get("title")
    doc = {
        "schema_version": "1",
        "document_type": document_type(title),
        "document_number": (fields.get("document_number") or None),
        "issue_date": fields.get("issue_date") or None,
        "due_date": None,
        "seller": seller,
        "buyer": buyer,
        "lines": lines,
        "subtotal": subtotal,
        "discount": discount,
        "vat_rate": vat_rate,
        "vat_amount": vat_amount,
        "wht_rate": fields.get("wht_rate"),
        "wht_amount": money(fields.get("wht_amount")),
        "total": total,
        "currency": "THB",
        "confidence": conf,
        "source_file": {"name": file_name[:255], "sha256": sha256, "pages": None},
        "engine": {
            "name": "pdfstruct",
            "version": engine_version or "",
            "template": pdfstruct.get("template"),
            "ocr_used": bool(ocr_used),
        },
        "warnings": warnings,
    }
    if title:
        c("title", "document_type")
    return doc
