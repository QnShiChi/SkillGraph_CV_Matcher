from __future__ import annotations

from io import BytesIO

import fitz
from PIL import Image, ImageDraw
from fastapi import UploadFile
from starlette.datastructures import Headers

from app.core.config import Settings
from app.repositories.job_repository import create_job
from app.schemas.job import JobCreate
from app.services.candidate_import_service import import_candidate_pdf, import_candidates_bulk
from app.services.openrouter_client import OpenRouterError


class _StubOpenRouterClient:
    def __init__(self, responses: list[str] | None = None, error: Exception | None = None) -> None:
        self._responses = responses or []
        self._error = error
        self._index = 0

    def create_chat_completion(self, *, system_prompt: str, user_prompt: str) -> str:
        del system_prompt, user_prompt
        if self._error:
            raise self._error
        response = self._responses[self._index]
        self._index += 1
        return response


def _make_settings(**overrides) -> Settings:
    values = {
        "postgres_db": "skillgraph",
        "postgres_user": "skillgraph_user",
        "postgres_password": "skillgraph_password",
        "postgres_host": "localhost",
        "postgres_port": 5432,
        "neo4j_uri": "bolt://localhost:7687",
        "neo4j_username": "neo4j",
        "neo4j_password": "password",
        "openrouter_api_key": "test-key",
        "openrouter_base_url": "https://openrouter.ai/api/v1",
        "openrouter_model": "openai/gpt-5.5",
        "jd_parser_mode": "rule_based",
        "jd_parser_temperature": 0.1,
        "jd_parser_max_output_tokens": 12000,
        "jd_parser_timeout_seconds": 90,
        "jd_parser_enable_fallback": True,
        "cv_parser_mode": "hybrid",
        "cv_parser_temperature": 0.1,
        "cv_parser_max_output_tokens": 12000,
        "cv_parser_timeout_seconds": 90,
        "cv_parser_enable_fallback": True,
    }
    values.update(overrides)
    return Settings(**values)


def _make_text_pdf_bytes(text: str) -> bytes:
    document = fitz.open()
    page = document.new_page()
    page.insert_text((72, 72), text)
    pdf_bytes = document.tobytes()
    document.close()
    return pdf_bytes


def _make_upload_file(text: str) -> UploadFile:
    pdf_bytes = _make_text_pdf_bytes(text)
    return UploadFile(
        file=BytesIO(pdf_bytes),
        filename="candidate.pdf",
        headers=Headers({"content-type": "application/pdf"}),
    )


def _make_image_pdf_upload_file(text: str) -> UploadFile:
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

    return UploadFile(
        file=BytesIO(pdf_bytes),
        filename="scanned-candidate.pdf",
        headers=Headers({"content-type": "application/pdf"}),
    )


def _create_job(session, title: str = "Backend Engineer"):
    return create_job(
        session,
        JobCreate(
            title=title,
            description="Imported job workspace",
            required_skills_text="Python",
            status="draft",
        ),
    )


def test_import_candidate_pdf_hybrid_success_path(session) -> None:
    job = _create_job(session)
    upload = _make_upload_file(
        "Nguyen Van A\nSummary\nPython engineer\nExperience\nBuilt FastAPI systems on PostgreSQL and AWS with Docker."
    )
    client = _StubOpenRouterClient(
        responses=[
            """
            {
              "full_name": "Nguyen Van A",
              "summary": "Python engineer building backend services and cloud delivery workflows.",
              "technical_skills": [
                {
                  "name": "Python",
                  "section_origin": "experience",
                  "confidence": 0.95,
                  "evidence": ["Built FastAPI systems on PostgreSQL and AWS with Docker."]
                },
                {
                  "name": "FastAPI",
                  "section_origin": "experience",
                  "confidence": 0.93,
                  "evidence": ["Built FastAPI systems on PostgreSQL and AWS with Docker."]
                }
              ],
              "platforms_cloud": [
                {
                  "name": "AWS",
                  "section_origin": "experience",
                  "confidence": 0.9,
                  "evidence": ["Built FastAPI systems on PostgreSQL and AWS with Docker."]
                }
              ],
              "tooling_devops": [
                {
                  "name": "Docker",
                  "section_origin": "experience",
                  "confidence": 0.89,
                  "evidence": ["Built FastAPI systems on PostgreSQL and AWS with Docker."]
                }
              ],
              "competencies": [],
              "soft_skills": [],
              "experience": ["Built FastAPI systems on PostgreSQL and AWS with Docker."],
              "education": [],
              "language_requirements": [],
              "parser_confidence": 0.91
            }
            """
        ]
    )

    candidate = import_candidate_pdf(
        session,
        upload,
        job_id=job.id,
        settings=_make_settings(cv_parser_mode="hybrid"),
        client=client,
    )

    assert candidate.job_id == job.id
    assert candidate.parse_source == "llm_hybrid"
    assert candidate.extract_source == "text_layer"
    assert candidate.parse_confidence is not None
    assert candidate.structured_cv_json["technical_skills"][0]["canonical"] == "python"


def test_import_candidate_pdf_hybrid_falls_back_to_rule_based(session) -> None:
    job = _create_job(session)
    upload = _make_upload_file(
        "Tran Thi B\nSummary\nBackend engineer\nExperience\nBuilt Docker services with PostgreSQL on AWS."
    )
    client = _StubOpenRouterClient(error=OpenRouterError("provider failure"))

    candidate = import_candidate_pdf(
        session,
        upload,
        job_id=job.id,
        settings=_make_settings(cv_parser_mode="hybrid", cv_parser_enable_fallback=True),
        client=client,
    )

    assert candidate.parse_source == "rule_based_fallback"
    assert candidate.extract_source == "text_layer"
    assert candidate.parse_confidence is not None
    assert candidate.skills_text is not None


def test_import_candidate_pdf_marks_graph_sync_success(session, monkeypatch) -> None:
    job = _create_job(session)
    upload = _make_upload_file(
        "Nguyen Van A\nSummary\nPython engineer\nExperience\nBuilt Python and FastAPI systems on AWS with Docker."
    )

    def _fake_sync(candidate, *, settings):
        del settings
        return {
            "status": "synced",
            "error": None,
            "synced_at": candidate.created_at,
        }

    monkeypatch.setattr(
        "app.services.candidate_import_service.sync_candidate_to_graph",
        _fake_sync,
    )

    candidate = import_candidate_pdf(
        session,
        upload,
        job_id=job.id,
        settings=_make_settings(cv_parser_mode="rule_based"),
    )

    assert candidate.job_id == job.id
    assert candidate.source_type == "cv_pdf"
    assert candidate.extract_source == "text_layer"
    assert candidate.parse_status == "processed"
    assert candidate.graph_sync_status == "synced"
    assert candidate.graph_synced_at is not None
    assert candidate.structured_cv_json is not None


def test_import_candidate_pdf_keeps_candidate_when_graph_sync_fails(session, monkeypatch) -> None:
    job = _create_job(session)
    upload = _make_upload_file(
        "Tran Thi B\nSummary\nBackend engineer\nExperience\nBuilt Docker services with PostgreSQL."
    )

    def _fake_sync(candidate, *, settings):
        del settings
        return {
            "status": "failed",
            "error": "neo4j unavailable",
            "synced_at": None,
        }

    monkeypatch.setattr(
        "app.services.candidate_import_service.sync_candidate_to_graph",
        _fake_sync,
    )

    candidate = import_candidate_pdf(
        session,
        upload,
        job_id=job.id,
        settings=_make_settings(cv_parser_mode="rule_based"),
    )

    assert candidate.id is not None
    assert candidate.extract_source == "text_layer"
    assert candidate.graph_sync_status == "failed"
    assert candidate.graph_sync_error == "neo4j unavailable"


def test_import_candidates_bulk_returns_per_file_results(session, monkeypatch) -> None:
    job = _create_job(session)
    files = [
        _make_upload_file("Nguyen Van A\nSummary\nPython engineer"),
        _make_upload_file("Tran Thi B\nSummary\nFastAPI engineer"),
    ]

    def _fake_sync(candidate, *, settings):
        del settings
        return {"status": "synced", "error": None, "synced_at": candidate.created_at}

    monkeypatch.setattr(
        "app.services.candidate_import_service.sync_candidate_to_graph",
        _fake_sync,
    )

    result = import_candidates_bulk(
        session,
        files,
        job_id=job.id,
        settings=_make_settings(cv_parser_mode="rule_based"),
    )

    assert result["total_files"] == 2
    assert result["success_count"] == 2
    assert result["failed_count"] == 0
    assert {item["status"] for item in result["results"]} == {"imported"}
    assert {item["filename"] for item in result["results"]} == {"candidate.pdf"}
    assert {item["extract_source"] for item in result["results"]} == {"text_layer"}


def test_import_candidates_bulk_continues_when_one_file_fails(session, monkeypatch) -> None:
    job = _create_job(session)
    files = [
        _make_upload_file("Nguyen Van A\nSummary\nPython engineer"),
        UploadFile(
            file=BytesIO(b"not a pdf"),
            filename="broken.txt",
            headers=Headers({"content-type": "text/plain"}),
        ),
    ]

    def _fake_sync(candidate, *, settings):
        del settings
        return {"status": "synced", "error": None, "synced_at": candidate.created_at}

    monkeypatch.setattr(
        "app.services.candidate_import_service.sync_candidate_to_graph",
        _fake_sync,
    )

    result = import_candidates_bulk(
        session,
        files,
        job_id=job.id,
        settings=_make_settings(cv_parser_mode="rule_based"),
    )

    assert result["total_files"] == 2
    assert result["success_count"] == 1
    assert result["failed_count"] == 1
    assert any(item["status"] == "imported" for item in result["results"])
    assert any(
        item["filename"] == "broken.txt"
        and item["status"] == "failed"
        and item["error"] == "Only PDF uploads are supported."
        for item in result["results"]
    )


def test_import_candidate_pdf_rejects_scanned_pdf_without_text_layer(session) -> None:
    job = _create_job(session)
    upload = _make_image_pdf_upload_file(
        "Nguyen Van A Python engineer Built FastAPI systems on PostgreSQL and AWS with Docker."
    )

    try:
        import_candidate_pdf(
            session,
            upload,
            job_id=job.id,
            settings=_make_settings(cv_parser_mode="rule_based"),
        )
    except ValueError as error:
        assert "text-based PDF" in str(error)
    else:  # pragma: no cover - defensive assertion
        raise AssertionError("Expected scanned CV PDF without text layer to be rejected.")
