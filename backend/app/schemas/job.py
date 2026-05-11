from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


JobStatus = Literal["draft", "analyzed", "archived"]


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
    status: JobStatus
    created_at: datetime
    updated_at: datetime
