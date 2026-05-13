from __future__ import annotations

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.repositories.job_repository import create_imported_job, update_job_graph_sync
from app.services.job_graph_sync import sync_job_to_graph
from app.services.jd_parser import parse_jd_text, parse_jd_text_hybrid
from app.services.openrouter_client import (
    OpenRouterClient,
    OpenRouterConfigurationError,
    OpenRouterError,
)
from app.services.pdf_text_extractor import extract_pdf_text


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
            "Unable to extract readable text from PDF. Please upload a text-based PDF or a clearly scanned PDF."
        )

    try:
        extracted = extract_pdf_text(pdf_bytes)
    except ValueError as error:
        raise ValueError(
            "Unable to extract readable text from PDF. Please upload a text-based PDF or a clearly scanned PDF."
        ) from error

    parsed = _parse_imported_job(
        extracted["raw_text"],
        settings=resolved_settings,
        client=client,
    )
    parsed["extract_source"] = extracted["extract_source"]
    job = create_imported_job(
        session,
        parsed=parsed,
        source_file_name=file.filename or "uploaded.pdf",
    )
    graph_sync = sync_job_to_graph(job, settings=resolved_settings)
    return update_job_graph_sync(
        session,
        job,
        status=graph_sync["status"],
        error=graph_sync["error"],
        synced_at=graph_sync["synced_at"],
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
