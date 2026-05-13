from __future__ import annotations

from io import BytesIO

import fitz
from PIL import Image, ImageDraw

from app.services.pdf_text_extractor import extract_pdf_text


def _make_text_pdf_bytes(text: str) -> bytes:
    document = fitz.open()
    page = document.new_page()
    page.insert_text((72, 72), text)
    pdf_bytes = document.tobytes()
    document.close()
    return pdf_bytes


def _make_image_pdf_bytes(text: str) -> bytes:
    image = Image.new("RGB", (1400, 1800), "white")
    draw = ImageDraw.Draw(image)
    draw.text((80, 80), text, fill="black")

    image_buffer = BytesIO()
    image.save(image_buffer, format="PNG")
    image_bytes = image_buffer.getvalue()

    document = fitz.open()
    page = document.new_page(width=900, height=1200)
    page.insert_image(page.rect, stream=image_bytes)
    pdf_bytes = document.tobytes()
    document.close()
    return pdf_bytes


def test_extract_pdf_text_uses_text_layer_when_available() -> None:
    payload = extract_pdf_text(
        _make_text_pdf_bytes(
            "Senior Backend Engineer Required Skills Python FastAPI PostgreSQL Docker AWS CI/CD"
        )
    )

    assert payload["extract_source"] == "text_layer"
    assert "Senior Backend Engineer" in payload["raw_text"]


def test_extract_pdf_text_falls_back_to_ocr(monkeypatch) -> None:
    pdf_bytes = _make_image_pdf_bytes("Python FastAPI PostgreSQL Docker AWS")

    monkeypatch.setattr(
        "app.services.pdf_text_extractor.pytesseract.image_to_string",
        lambda image, lang: (
            "Python FastAPI PostgreSQL Docker AWS machine learning backend services "
            "cloud deployment CI CD engineering systems"
        ),
    )

    payload = extract_pdf_text(pdf_bytes)

    assert payload["extract_source"] == "ocr_fallback"
    assert "Python FastAPI PostgreSQL Docker AWS" in payload["raw_text"]
