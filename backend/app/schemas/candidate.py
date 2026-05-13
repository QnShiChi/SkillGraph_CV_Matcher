from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr


CandidateStatus = Literal["new", "reviewed", "matched"]
CandidateSourceType = Literal["manual", "cv_pdf"]
CandidateExtractSource = Literal["text_layer", "ocr_fallback"]
CandidateParseStatus = Literal["processed", "failed"]
CandidateParseSource = Literal["manual", "rule_based", "llm_hybrid", "rule_based_fallback"]
CandidateGraphSyncStatus = Literal["pending", "synced", "failed"]
CandidateImportItemStatus = Literal["imported", "failed"]


class CandidateCreate(BaseModel):
    full_name: str
    email: EmailStr | None = None
    resume_text: str | None = None
    skills_text: str | None = None
    status: CandidateStatus = "new"


class CandidateUpdate(BaseModel):
    full_name: str | None = None
    email: EmailStr | None = None
    resume_text: str | None = None
    skills_text: str | None = None
    status: CandidateStatus | None = None


class CandidateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    job_id: int | None
    full_name: str
    email: EmailStr | None
    resume_text: str | None
    skills_text: str | None
    source_type: CandidateSourceType
    source_file_name: str | None
    extract_source: CandidateExtractSource | None
    parse_status: CandidateParseStatus
    parse_source: CandidateParseSource
    parse_confidence: float | None
    graph_sync_status: CandidateGraphSyncStatus
    graph_sync_error: str | None
    graph_synced_at: datetime | None
    structured_cv_json: dict[str, Any] | None
    status: CandidateStatus
    created_at: datetime
    updated_at: datetime


class CandidateBulkImportItem(BaseModel):
    filename: str
    status: CandidateImportItemStatus
    candidate_id: int | None
    candidate_name: str | None
    extract_source: CandidateExtractSource | None
    parse_source: CandidateParseSource | None
    parse_confidence: float | None
    graph_sync_status: CandidateGraphSyncStatus | None
    error: str | None


class CandidateBulkImportResponse(BaseModel):
    total_files: int
    success_count: int
    failed_count: int
    results: list[CandidateBulkImportItem]
