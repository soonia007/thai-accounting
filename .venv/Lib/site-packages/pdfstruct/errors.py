class PDFStructError(Exception):
    """Base error. Every fatal problem raised by pdfstruct derives from this."""


class NotAPDFError(PDFStructError):
    pass


class EncryptedPDFError(PDFStructError):
    pass


class UnreadablePDFError(PDFStructError):
    pass


class ExtractionTimeout(PDFStructError):
    pass


class SpecError(PDFStructError):
    """The field spec file is invalid."""
