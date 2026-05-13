from __future__ import annotations

import fitz

MIN_EXTRACTED_TEXT_LENGTH = 80
MIN_EXTRACTED_ALPHA_CHARS = 30
MIN_EXTRACTED_TOKENS = 6


def extract_pdf_text(pdf_bytes: bytes) -> dict[str, str]:
    if not pdf_bytes:
        raise ValueError("Uploaded PDF is empty.")

    try:
        document = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as error:  # pragma: no cover - third-party exception shape is unstable
        raise ValueError("Unable to open PDF for text extraction.") from error

    try:
        text_layer = _extract_text_layer(document)
        if _has_sufficient_text(text_layer):
            return {"raw_text": text_layer, "extract_source": "text_layer"}
    finally:
        document.close()

    raise ValueError(
        "Unable to extract readable text from PDF. Please upload a text-based PDF with selectable text."
    )


def _extract_text_layer(document: fitz.Document) -> str:
    return "\n".join(page.get_text("text") for page in document).strip()
def _has_sufficient_text(text: str) -> bool:
    normalized = " ".join(text.split())
    if len(normalized) >= MIN_EXTRACTED_TEXT_LENGTH:
        return True

    alpha_chars = sum(1 for char in normalized if char.isalpha())
    token_count = len(normalized.split())
    return alpha_chars >= MIN_EXTRACTED_ALPHA_CHARS and token_count >= MIN_EXTRACTED_TOKENS
