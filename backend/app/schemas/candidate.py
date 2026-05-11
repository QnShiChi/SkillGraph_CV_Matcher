from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr


CandidateStatus = Literal["new", "reviewed", "matched"]


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
    full_name: str
    email: EmailStr | None
    resume_text: str | None
    skills_text: str | None
    status: CandidateStatus
    created_at: datetime
    updated_at: datetime
