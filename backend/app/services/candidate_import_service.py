from __future__ import annotations

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.repositories.candidate_repository import (
    create_imported_candidate,
    update_candidate_graph_sync,
)
from app.services.candidate_graph_sync import sync_candidate_to_graph
from app.services.cv_parser import parse_cv_text, parse_cv_text_hybrid
from app.services.openrouter_client import (
    OpenRouterClient,
    OpenRouterConfigurationError,
    OpenRouterError,
)
from app.services.pdf_text_extractor import extract_pdf_text


def import_candidate_pdf(
    session: Session,
    file: UploadFile,
    *,
    job_id: int,
    settings: Settings | None = None,
    client: OpenRouterClient | None = None,
):
    resolved_settings = settings or get_settings()
    pdf_bytes = file.file.read()
    if not pdf_bytes:
        raise ValueError(
            "Unable to extract readable text from CV. Please upload a text-based PDF with selectable text."
        )

    try:
        extracted = extract_pdf_text(pdf_bytes)
    except ValueError as error:
        raise ValueError(
            "Unable to extract readable text from CV. Please upload a text-based PDF with selectable text."
        ) from error

    parsed = _parse_imported_candidate(
        extracted["raw_text"],
        settings=resolved_settings,
        client=client,
    )
    parsed["extract_source"] = extracted["extract_source"]
    candidate = create_imported_candidate(
        session,
        parsed=parsed,
        source_file_name=file.filename or "uploaded.pdf",
        job_id=job_id,
    )
    graph_sync = sync_candidate_to_graph(candidate, settings=resolved_settings)
    return update_candidate_graph_sync(
        session,
        candidate,
        status=graph_sync["status"],
        error=graph_sync["error"],
        synced_at=graph_sync["synced_at"],
    )


def import_candidates_bulk(
    session: Session,
    files: list[UploadFile],
    *,
    job_id: int,
    settings: Settings | None = None,
    client: OpenRouterClient | None = None,
) -> dict:
    resolved_settings = settings or get_settings()
    results: list[dict] = []
    success_count = 0
    failed_count = 0

    for file in files:
        filename = file.filename or "uploaded.pdf"
        try:
            if file.content_type != "application/pdf":
                raise ValueError("Only PDF uploads are supported.")

            candidate = import_candidate_pdf(
                session,
                file,
                job_id=job_id,
                settings=resolved_settings,
                client=client,
            )
            results.append(
                {
                    "filename": filename,
                    "status": "imported",
                    "candidate_id": candidate.id,
                    "candidate_name": candidate.full_name,
                    "extract_source": candidate.extract_source,
                    "parse_source": candidate.parse_source,
                    "parse_confidence": candidate.parse_confidence,
                    "graph_sync_status": candidate.graph_sync_status,
                    "error": None,
                }
            )
            success_count += 1
        except ValueError as error:
            results.append(
                {
                    "filename": filename,
                    "status": "failed",
                    "candidate_id": None,
                    "candidate_name": None,
                    "extract_source": None,
                    "parse_source": None,
                    "parse_confidence": None,
                    "graph_sync_status": None,
                    "error": str(error),
                }
            )
            failed_count += 1

    return {
        "total_files": len(files),
        "success_count": success_count,
        "failed_count": failed_count,
        "results": results,
    }


def _parse_imported_candidate(
    raw_text: str,
    *,
    settings: Settings,
    client: OpenRouterClient | None,
) -> dict:
    if settings.cv_parser_mode == "rule_based":
        return parse_cv_text(raw_text)

    if settings.cv_parser_mode not in {"hybrid", "llm_only"}:
        raise ValueError(f"Unsupported CV parser mode: {settings.cv_parser_mode}")

    resolved_client = client or _build_openrouter_client(settings)
    try:
        return parse_cv_text_hybrid(raw_text, client=resolved_client)
    except OpenRouterConfigurationError as error:
        raise ValueError(str(error)) from error
    except (OpenRouterError, ValueError) as error:
        if settings.cv_parser_mode == "hybrid" and settings.cv_parser_enable_fallback:
            fallback = parse_cv_text(raw_text)
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
        temperature=settings.cv_parser_temperature,
        max_output_tokens=settings.cv_parser_max_output_tokens,
        timeout_seconds=settings.cv_parser_timeout_seconds,
        app_name=settings.app_name,
    )
