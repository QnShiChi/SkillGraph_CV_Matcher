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
    assert payload["extract_source"] == "text_layer"
    assert payload["parse_status"] == "processed"
    assert payload["parse_source"] == "rule_based"
    assert payload["parse_confidence"] is not None
    assert payload["graph_sync_status"] in {"synced", "failed"}
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


def test_get_jobs_allows_legacy_ocr_extract_source(client, session) -> None:
    legacy_job = Job(
        title="Legacy Imported JD",
        description="Imported before OCR was removed.",
        required_skills_text="Python",
        source_type="jd_pdf",
        source_file_name="legacy.pdf",
        extract_source="ocr_fallback",
        parse_status="processed",
        parse_source="rule_based_fallback",
        parse_confidence=0.7,
        graph_sync_status="synced",
        graph_sync_error=None,
        graph_synced_at=None,
        status="draft",
    )
    session.add(legacy_job)
    session.commit()

    response = client.get("/api/jobs")

    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 1
    assert payload[0]["extract_source"] == "ocr_fallback"
