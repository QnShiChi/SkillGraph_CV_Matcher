from datetime import datetime

from sqlalchemy import JSON, DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text(), nullable=True)
    required_skills_text: Mapped[str | None] = mapped_column(Text(), nullable=True)
    responsibilities_text: Mapped[str | None] = mapped_column(Text(), nullable=True)
    qualifications_text: Mapped[str | None] = mapped_column(Text(), nullable=True)
    raw_jd_text: Mapped[str | None] = mapped_column(Text(), nullable=True)
    source_type: Mapped[str] = mapped_column(String(50), nullable=False, default="manual")
    source_file_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    extract_source: Mapped[str | None] = mapped_column(String(50), nullable=True)
    parse_status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="processed",
    )
    parse_source: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="manual",
    )
    parse_confidence: Mapped[float | None] = mapped_column(nullable=True)
    graph_sync_status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="pending",
    )
    graph_sync_error: Mapped[str | None] = mapped_column(Text(), nullable=True)
    graph_synced_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    structured_jd_json: Mapped[dict | None] = mapped_column(JSON(), nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="draft")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
