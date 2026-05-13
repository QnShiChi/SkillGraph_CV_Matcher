from __future__ import annotations

from pydantic import BaseModel, Field


class CVLLMEvidenceItem(BaseModel):
    text: str
    section_origin: str | None = None
    confidence: float | None = None


class CVLLMSkill(BaseModel):
    name: str
    section_origin: str | None = None
    confidence: float | None = None
    aliases: list[str] = Field(default_factory=list)
    evidence: list[CVLLMEvidenceItem | str] = Field(default_factory=list)


class CVLLMTextItem(BaseModel):
    text: str
    confidence: float | None = None


class CVLLMParseResult(BaseModel):
    full_name: str | None = None
    summary: str | None = None
    technical_skills: list[CVLLMSkill] = Field(default_factory=list)
    platforms_cloud: list[CVLLMSkill] = Field(default_factory=list)
    tooling_devops: list[CVLLMSkill] = Field(default_factory=list)
    competencies: list[CVLLMSkill] = Field(default_factory=list)
    soft_skills: list[str] = Field(default_factory=list)
    experience: list[CVLLMTextItem | str] = Field(default_factory=list)
    education: list[CVLLMTextItem | str] = Field(default_factory=list)
    language_requirements: list[str] = Field(default_factory=list)
    parser_confidence: float | None = None
