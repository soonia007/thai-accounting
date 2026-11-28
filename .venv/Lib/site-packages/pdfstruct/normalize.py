"""Text normalisation applied to every extracted string."""

from __future__ import annotations

import re
import unicodedata

# Typographic ligatures are expanded (NFKC only for this range, so that
# Thai and other scripts are not altered by full NFKC).
_LIGATURES = {chr(c): unicodedata.normalize("NFKC", chr(c)) for c in range(0xFB00, 0xFB07)}
_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f￾￿]")
_PUA = re.compile(r"[-]")
# pdfminer writes "(cid:N)" for glyphs it cannot map to Unicode.
_CID = re.compile(r"\(cid:\d+\)")
# A lone unmapped glyph at the start of a line followed by text is almost always a bullet.
_CID_BULLET = re.compile(r"(?m)^(\s*)\(cid:\d+\)(?=\s+\S)")
_SPACES = re.compile(r"[ \t  -  　]+")

# Thai SARA AM is often emitted as NIKHAHIT + SARA AA by PDF producers.
_THAI_FIXES = (("ํา", "ำ"), ("ํ า", "ำ"))


def normalize_text(text: str | None) -> str:
    if not text:
        return ""
    text = _CONTROL.sub("", text)
    text = _CID_BULLET.sub("\\1\u2022", text)
    text = _CID.sub("\ufffd", text)
    for lig, repl in _LIGATURES.items():
        text = text.replace(lig, repl)
    for bad, good in _THAI_FIXES:
        text = text.replace(bad, good)
    text = unicodedata.normalize("NFC", text)
    lines = [_SPACES.sub(" ", ln).strip() for ln in text.splitlines()]
    return "\n".join(lines).strip()


def count_private_use(text: str) -> int:
    """Private-Use-Area chars usually mean a font without a usable ToUnicode map."""
    return len(_PUA.findall(text))


def count_unmapped(text: str) -> int:
    """Glyphs that could not be mapped to Unicode (replaced by U+FFFD)."""
    return text.count("\ufffd")
