from io import BytesIO

import fitz

from app.models.job import Job


def _make_text_pdf_bytes(text: str) -> bytes:
    document = fitz.open()
    page = document.new_page()
    page.insert_text((72, 72), text)
    return document.tobytes()


def test_import_job_pdf_creates_graph_ready_job(client) -> None:
    pdf_bytes = _make_text_pdf_bytes(
        "Senior Backend Engineer\n\nRequired Skills\nPython\nFastAPI\nPostgreSQL"
    )

    response = client.post(
        "/api/jobs/import",
        files={"file": ("jd.pdf", BytesIO(pdf_bytes), "application/pdf")},
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["source_type"] == "jd_pdf"
    assert payload["parse_status"] == "processed"
    assert payload["parse_source"] == "rule_based"
    assert payload["parse_confidence"] is not None
    assert payload["structured_jd_json"] is not None
    assert "technical_skills" in payload["structured_jd_json"]
    assert payload["source_file_name"] == "jd.pdf"


def test_import_job_pdf_rejects_non_pdf(client) -> None:
    response = client.post(
        "/api/jobs/import",
        files={"file": ("jd.txt", BytesIO(b"not a pdf"), "text/plain")},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Only PDF uploads are supported."


def test_import_job_pdf_rejects_unreadable_pdf(client, session) -> None:
    response = client.post(
        "/api/jobs/import",
        files={"file": ("jd.pdf", BytesIO(b"%PDF-1.4\n%%EOF"), "application/pdf")},
    )

    assert response.status_code == 400
    assert "readable text" in response.json()["detail"]
    assert session.query(Job).count() == 0
