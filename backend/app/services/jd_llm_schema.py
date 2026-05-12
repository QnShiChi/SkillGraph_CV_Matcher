from __future__ import annotations

from pydantic import BaseModel, Field


class JDLLMSkill(BaseModel):
    name: str
    importance: int | None = None
    requirement_type: str | None = None
    section_origin: str | None = None
    confidence: float | None = None
    aliases: list[str] = Field(default_factory=list)


class JDLLMTextItem(BaseModel):
    text: str
    confidence: float | None = None


class JDLLMParseResult(BaseModel):
    title: str
    summary: str | None = None
    technical_skills: list[JDLLMSkill] = Field(default_factory=list)
    platforms_cloud: list[JDLLMSkill] = Field(default_factory=list)
    tooling_devops: list[JDLLMSkill] = Field(default_factory=list)
    competencies: list[JDLLMSkill] = Field(default_factory=list)
    role_descriptors: list[JDLLMSkill] = Field(default_factory=list)
    soft_skills: list[str] = Field(default_factory=list)
    responsibilities: list[JDLLMTextItem | str] = Field(default_factory=list)
    qualifications: list[JDLLMTextItem | str] = Field(default_factory=list)
    language_requirements: list[str] = Field(default_factory=list)
    experience_years: int | None = None
    parser_confidence: float | None = None
