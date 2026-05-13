from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict


JobStatus = Literal["draft", "analyzed", "archived"]
JobSourceType = Literal["manual", "jd_pdf"]
JobExtractSource = Literal["text_layer", "ocr_fallback"]
JobParseStatus = Literal["processed", "failed"]
JobParseSource = Literal["manual", "rule_based", "llm_hybrid", "rule_based_fallback"]
JobGraphSyncStatus = Literal["pending", "synced", "failed"]


class JobCreate(BaseModel):
    title: str
    description: str | None = None
    required_skills_text: str | None = None
    status: JobStatus = "draft"


class JobUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    required_skills_text: str | None = None
    status: JobStatus | None = None


class JobRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str | None
    required_skills_text: str | None
    responsibilities_text: str | None
    qualifications_text: str | None
    raw_jd_text: str | None
    source_type: JobSourceType
    source_file_name: str | None
    extract_source: JobExtractSource | None
    parse_status: JobParseStatus
    parse_source: JobParseSource
    parse_confidence: float | None
    graph_sync_status: JobGraphSyncStatus
    graph_sync_error: str | None
    graph_synced_at: datetime | None
    structured_jd_json: dict[str, Any] | None
    status: JobStatus
    created_at: datetime
    updated_at: datetime
