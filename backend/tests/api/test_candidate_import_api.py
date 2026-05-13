from io import BytesIO

import fitz

from app.models.candidate import Candidate
from app.repositories.candidate_repository import create_candidate
from app.repositories.job_repository import create_job
from app.schemas.candidate import CandidateCreate
from app.schemas.job import JobCreate


def _make_text_pdf_bytes(text: str) -> bytes:
    document = fitz.open()
    page = document.new_page()
    page.insert_text((72, 72), text)
    pdf_bytes = document.tobytes()
    document.close()
    return pdf_bytes


def _create_job(session, title: str = "Backend Engineer"):
    return create_job(
        session,
        JobCreate(
            title=title,
            description="Workspace for candidate import",
            required_skills_text="Python",
            status="draft",
        ),
    )


def test_import_candidate_pdf_returns_job_id(client, session) -> None:
    job = _create_job(session)
    pdf_bytes = _make_text_pdf_bytes(
        "Nguyen Van A\nSummary\nPython engineer\nExperience\nBuilt Python APIs with FastAPI and PostgreSQL on AWS using Docker."
    )

    response = client.post(
        f"/api/jobs/{job.id}/candidates/import",
        files={"file": ("candidate.pdf", BytesIO(pdf_bytes), "application/pdf")},
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["job_id"] == job.id
    assert payload["source_type"] == "cv_pdf"
    assert payload["extract_source"] == "text_layer"
    assert payload["parse_status"] == "processed"
    assert payload["parse_source"] in {"rule_based", "llm_hybrid", "rule_based_fallback"}
    assert payload["graph_sync_status"] in {"synced", "failed"}
    assert payload["structured_cv_json"] is not None
    assert "technical_skills" in payload["structured_cv_json"]
    assert payload["source_file_name"] == "candidate.pdf"


def test_import_candidate_pdf_returns_404_for_missing_job(client) -> None:
    pdf_bytes = _make_text_pdf_bytes("Nguyen Van A\nSummary\nPython engineer")
    response = client.post(
        "/api/jobs/99999/candidates/import",
        files={"file": ("candidate.pdf", BytesIO(pdf_bytes), "application/pdf")},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Job not found."


def test_import_candidate_pdf_rejects_non_pdf(client, session) -> None:
    job = _create_job(session)
    response = client.post(
        f"/api/jobs/{job.id}/candidates/import",
        files={"file": ("candidate.txt", BytesIO(b"not a pdf"), "text/plain")},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Only PDF uploads are supported."


def test_import_candidate_pdf_rejects_unreadable_pdf(client, session) -> None:
    job = _create_job(session)
    response = client.post(
        f"/api/jobs/{job.id}/candidates/import",
        files={"file": ("candidate.pdf", BytesIO(b"%PDF-1.4\n%%EOF"), "application/pdf")},
    )

    assert response.status_code == 400
    assert "readable text" in response.json()["detail"]
    assert session.query(Candidate).count() == 0


def test_import_candidate_bulk_returns_batch_result(client, session) -> None:
    job = _create_job(session)
    response = client.post(
        f"/api/jobs/{job.id}/candidates/import-bulk",
        files=[
            (
                "files",
                (
                    "one.pdf",
                    BytesIO(_make_text_pdf_bytes("Nguyen Van A\nSummary\nPython engineer")),
                    "application/pdf",
                ),
            ),
            (
                "files",
                (
                    "two.pdf",
                    BytesIO(_make_text_pdf_bytes("Tran Thi B\nSummary\nFastAPI engineer")),
                    "application/pdf",
                ),
            ),
        ],
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["total_files"] == 2
    assert payload["success_count"] == 2
    assert payload["failed_count"] == 0
    assert len(payload["results"]) == 2
    assert payload["results"][0]["status"] == "imported"
    assert payload["results"][0]["extract_source"] == "text_layer"


def test_import_candidate_bulk_returns_partial_success(client, session) -> None:
    job = _create_job(session)
    good_pdf = _make_text_pdf_bytes("Nguyen Van A\nSummary\nPython engineer")
    response = client.post(
        f"/api/jobs/{job.id}/candidates/import-bulk",
        files=[
            ("files", ("good.pdf", BytesIO(good_pdf), "application/pdf")),
            ("files", ("bad.txt", BytesIO(b"oops"), "text/plain")),
        ],
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["total_files"] == 2
    assert payload["success_count"] == 1
    assert payload["failed_count"] == 1
    assert any(
        item["filename"] == "bad.txt" and item["status"] == "failed"
        for item in payload["results"]
    )


def test_get_job_candidates_returns_only_job_scoped_candidates(client, session) -> None:
    job = _create_job(session, title="Backend Engineer")
    other_job = _create_job(session, title="Frontend Engineer")
    create_candidate(
        session,
        CandidateCreate(
            full_name="Alice",
            email=None,
            resume_text=None,
            skills_text=None,
            status="new",
        ),
    ).job_id = job.id
    session.commit()
    create_candidate(
        session,
        CandidateCreate(
            full_name="Bob",
            email=None,
            resume_text=None,
            skills_text=None,
            status="new",
        ),
    ).job_id = other_job.id
    session.commit()

    response = client.get(f"/api/jobs/{job.id}/candidates")

    assert response.status_code == 200
    payload = response.json()
    assert [item["full_name"] for item in payload] == ["Alice"]
