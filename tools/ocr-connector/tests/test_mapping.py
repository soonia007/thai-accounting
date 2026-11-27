import json
from pathlib import Path

import pytest

from finora_ocr.mapping import document_type, money, to_contract

HERE = Path(__file__).parent
ROOT = HERE.parent.parent.parent
SCHEMA = json.loads((ROOT / "contracts" / "ocr-document.v1.json").read_text(encoding="utf-8"))


def load(name: str) -> dict:
    return json.loads((HERE / "fixtures" / f"{name}.pdfstruct.json").read_text(encoding="utf-8"))


def check_schema(doc: dict) -> None:
    jsonschema = pytest.importorskip("jsonschema")
    jsonschema.Draft202012Validator(SCHEMA).validate(doc)


def test_tax_invoice():
    doc = to_contract(load("tax-invoice"), file_name="tax-invoice.pdf")
    check_schema(doc)
    assert doc["document_type"] == "tax_invoice"
    assert doc["document_number"] == "INV-2026-0042"
    assert doc["issue_date"] == "2026-10-15"  # 15 ตุลาคม 2569 (BE) -> CE
    assert doc["seller"]["tax_id"] == "0105556012345"
    assert doc["buyer"]["tax_id"] == "0105561234561"
    assert [ln["amount"] for ln in doc["lines"]] == [1200.0, 900.0]
    assert (doc["subtotal"], doc["vat_rate"], doc["vat_amount"], doc["total"]) == (2100.0, 7.0, 147.0, 2247.0)
    assert doc["confidence"]["document_number"] >= 0.9


def test_receipt_without_vat():
    doc = to_contract(load("receipt-no-vat"), file_name="r.pdf")
    check_schema(doc)
    assert doc["document_type"] == "receipt"
    assert doc["vat_amount"] is None and doc["vat_rate"] is None
    assert doc["total"] == 300.0
    assert sum(ln["amount"] for ln in doc["lines"]) == 300.0


def test_service_with_withholding():
    doc = to_contract(load("service-wht"), file_name="s.pdf")
    check_schema(doc)
    assert doc["document_type"] == "tax_invoice_receipt"
    assert (doc["wht_rate"], doc["wht_amount"]) == (3.0, 240.0)


def test_no_table_gives_one_derived_line():
    raw = {"fields": {"title": "บิลเงินสด", "total": 450, "tax_ids": ["1103700012345"]}, "details": {}}
    doc = to_contract(raw, file_name="b.pdf")
    check_schema(doc)
    assert doc["lines"] == [{"description": "บิลเงินสด", "qty": 1, "unit_price": 450.0, "amount": 450.0}]
    assert doc["confidence"]["lines"] == 0.5 and doc["confidence"]["subtotal"] == 0.5
    assert doc["warnings"]


def test_vat_rate_inferred_only_when_it_is_7_percent():
    raw = {"fields": {"subtotal": 1000, "vat_amount": 70, "total": 1070}, "details": {}}
    assert to_contract(raw, file_name="x.pdf")["vat_rate"] == 7.0
    raw["fields"]["vat_amount"] = 50
    assert to_contract(raw, file_name="x.pdf")["vat_rate"] is None


def test_bad_tax_ids_dropped_and_rows_without_amount_skipped():
    raw = {
        "fields": {
            "tax_ids": ["12345", "0105556012345"],
            "lines": [
                {"description": "A", "qty": 2, "unit_price": 10.005},
                {"description": "รวม", "amount": None},
                {"description": "", "amount": 5},
            ],
        },
        "details": {},
    }
    doc = to_contract(raw, file_name="x.pdf")
    assert doc["seller"]["tax_id"] == "0105556012345" and doc["buyer"]["tax_id"] is None
    assert doc["lines"] == [{"description": "A", "qty": 2, "unit_price": 10.01, "amount": 20.01}]


@pytest.mark.parametrize(
    "title,expected",
    [
        ("ใบกำกับภาษี/ใบเสร็จรับเงิน", "tax_invoice_receipt"),
        ("TAX INVOICE", "tax_invoice"),
        ("ใบลดหนี้", "credit_note"),
        ("บิลเงินสด", "cash_bill"),
        ("ใบแจ้งหนี้", "invoice"),
        (None, "other"),
    ],
)
def test_document_type(title, expected):
    assert document_type(title) == expected


def test_money_rounds_half_up():
    assert money("1,000") is None and money(2.675) == 2.68 and money(None) is None


def test_committed_samples_match_contract():
    for p in sorted((ROOT / "samples" / "ocr").glob("*.json")):
        check_schema(json.loads(p.read_text(encoding="utf-8")))
