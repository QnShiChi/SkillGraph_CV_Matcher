from __future__ import annotations

import fitz
from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.repositories.job_repository import create_imported_job
from app.services.jd_parser import parse_jd_text, parse_jd_text_hybrid
from app.services.openrouter_client import (
    OpenRouterClient,
    OpenRouterConfigurationError,
    OpenRouterError,
)


def import_job_pdf(
    session: Session,
    file: UploadFile,
    *,
    settings: Settings | None = None,
    client: OpenRouterClient | None = None,
):
    resolved_settings = settings or get_settings()
    pdf_bytes = file.file.read()
    if not pdf_bytes:
        raise ValueError(
            "Unable to extract readable text from PDF. Please upload a text-based PDF."
        )

    try:
        document = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as error:  # pragma: no cover - PyMuPDF exception shape is unstable
        raise ValueError(
            "Unable to extract readable text from PDF. Please upload a text-based PDF."
        ) from error

    raw_text = "\n".join(page.get_text("text") for page in document).strip()
    document.close()
    if not raw_text:
        raise ValueError(
            "Unable to extract readable text from PDF. Please upload a text-based PDF."
        )

    parsed = _parse_imported_job(
        raw_text,
        settings=resolved_settings,
        client=client,
    )
    return create_imported_job(
        session,
        parsed=parsed,
        source_file_name=file.filename or "uploaded.pdf",
    )


def _parse_imported_job(
    raw_text: str,
    *,
    settings: Settings,
    client: OpenRouterClient | None,
) -> dict:
    if settings.jd_parser_mode == "rule_based":
        return parse_jd_text(raw_text)

    if settings.jd_parser_mode not in {"hybrid", "llm_only"}:
        raise ValueError(f"Unsupported JD parser mode: {settings.jd_parser_mode}")

    resolved_client = client or _build_openrouter_client(settings)
    try:
        return parse_jd_text_hybrid(raw_text, client=resolved_client)
    except OpenRouterConfigurationError as error:
        raise ValueError(str(error)) from error
    except (OpenRouterError, ValueError) as error:
        if settings.jd_parser_mode == "hybrid" and settings.jd_parser_enable_fallback:
            fallback = parse_jd_text(raw_text)
            fallback["parse_source"] = "rule_based_fallback"
            fallback["parse_confidence"] = min(
                round((fallback["parse_confidence"] or 0.0) + 0.05, 2),
                0.89,
            )
            return fallback
        raise ValueError(str(error)) from error


def _build_openrouter_client(settings: Settings) -> OpenRouterClient:
    return OpenRouterClient(
        api_key=settings.openrouter_api_key or "",
        base_url=settings.openrouter_base_url,
        model=settings.openrouter_model,
        temperature=settings.jd_parser_temperature,
        max_output_tokens=settings.jd_parser_max_output_tokens,
        timeout_seconds=settings.jd_parser_timeout_seconds,
        app_name=settings.app_name,
    )
