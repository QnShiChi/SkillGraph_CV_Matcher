from __future__ import annotations

from io import BytesIO

import fitz
from PIL import Image, ImageDraw
from fastapi import UploadFile
from starlette.datastructures import Headers

from app.core.config import Settings
from app.services.job_import_service import import_job_pdf
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
        "jd_parser_mode": "hybrid",
        "jd_parser_temperature": 0.1,
        "jd_parser_max_output_tokens": 12000,
        "jd_parser_timeout_seconds": 90,
        "jd_parser_enable_fallback": True,
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
        filename="jd.pdf",
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
        filename="scanned-jd.pdf",
        headers=Headers({"content-type": "application/pdf"}),
    )


def test_import_job_pdf_hybrid_success_path(session) -> None:
    upload = _make_upload_file(
        "Senior Backend Engineer\n\nRequired Skills\nPython\nFastAPI\nPostgreSQL"
    )
    client = _StubOpenRouterClient(
        responses=[
            """
            {
              "title": "Senior Backend Engineer",
              "summary": "Build APIs and backend systems.",
              "technical_skills": [
                {"name": "Python", "importance": 5, "requirement_type": "must_have", "section_origin": "required_skills", "confidence": 0.95},
                {"name": "FastAPI", "importance": 5, "requirement_type": "must_have", "section_origin": "required_skills", "confidence": 0.94},
                {"name": "PostgreSQL", "importance": 5, "requirement_type": "must_have", "section_origin": "required_skills", "confidence": 0.93}
              ],
              "platforms_cloud": [],
              "tooling_devops": [],
              "competencies": [],
              "role_descriptors": [],
              "responsibilities": ["Build APIs and backend systems."],
              "qualifications": [],
              "soft_skills": [],
              "language_requirements": [],
              "experience_years": null,
              "parser_confidence": 0.92
            }
            """
        ]
    )

    job = import_job_pdf(
        session,
        upload,
        settings=_make_settings(jd_parser_mode="hybrid"),
        client=client,
    )

    assert job.parse_source == "llm_hybrid"
    assert job.extract_source == "text_layer"
    assert job.parse_confidence is not None
    assert job.structured_jd_json["technical_skills"][0]["canonical"] == "python"


def test_import_job_pdf_hybrid_falls_back_to_rule_based(session) -> None:
    upload = _make_upload_file(
        "Senior Frontend Developer\n\nRequired Skills\nNext.js\nTypeScript\nPostgreSQL"
    )
    client = _StubOpenRouterClient(error=OpenRouterError("provider failure"))

    job = import_job_pdf(
        session,
        upload,
        settings=_make_settings(jd_parser_mode="hybrid", jd_parser_enable_fallback=True),
        client=client,
    )

    assert job.parse_source == "rule_based_fallback"
    assert job.extract_source == "text_layer"
    assert job.parse_confidence is not None
    assert job.required_skills_text is not None


def test_import_job_pdf_marks_graph_sync_success(session, monkeypatch) -> None:
    upload = _make_upload_file(
        "Senior Backend Engineer\n\nRequired Skills\nPython\nFastAPI\nPostgreSQL"
    )

    def _fake_sync(job, *, settings):
        del settings
        assert job.title == "Senior Backend Engineer"
        return {
            "status": "synced",
            "error": None,
            "synced_at": job.created_at,
        }

    monkeypatch.setattr(
        "app.services.job_import_service.sync_job_to_graph",
        _fake_sync,
    )

    job = import_job_pdf(
        session,
        upload,
        settings=_make_settings(jd_parser_mode="rule_based"),
    )

    assert job.graph_sync_status == "synced"
    assert job.extract_source == "text_layer"
    assert job.graph_sync_error is None
    assert job.graph_synced_at is not None


def test_import_job_pdf_keeps_job_when_graph_sync_fails(session, monkeypatch) -> None:
    upload = _make_upload_file(
        "Senior Backend Engineer\n\nRequired Skills\nPython\nFastAPI\nPostgreSQL"
    )

    def _fake_sync(job, *, settings):
        del settings
        return {
            "status": "failed",
            "error": "neo4j unavailable",
            "synced_at": None,
        }

    monkeypatch.setattr(
        "app.services.job_import_service.sync_job_to_graph",
        _fake_sync,
    )

    job = import_job_pdf(
        session,
        upload,
        settings=_make_settings(jd_parser_mode="rule_based"),
    )

    assert job.id is not None
    assert job.extract_source == "text_layer"
    assert job.graph_sync_status == "failed"
    assert job.graph_sync_error == "neo4j unavailable"
    assert job.graph_synced_at is None


def test_import_job_pdf_rejects_scanned_pdf_without_text_layer(session) -> None:
    upload = _make_image_pdf_upload_file(
        "Senior Backend Engineer Required Skills Python FastAPI PostgreSQL"
    )

    try:
        import_job_pdf(
            session,
            upload,
            settings=_make_settings(jd_parser_mode="rule_based"),
        )
    except ValueError as error:
        assert "text-based PDF" in str(error)
    else:  # pragma: no cover - defensive assertion
        raise AssertionError("Expected scanned JD PDF without text layer to be rejected.")
