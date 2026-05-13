from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Candidate(Base):
    __tablename__ = "candidates"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    job_id: Mapped[int | None] = mapped_column(
        ForeignKey("jobs.id"),
        nullable=True,
        index=True,
    )
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    resume_text: Mapped[str | None] = mapped_column(Text(), nullable=True)
    skills_text: Mapped[str | None] = mapped_column(Text(), nullable=True)
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
    verification_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    verification_score: Mapped[float | None] = mapped_column(nullable=True)
    verification_summary: Mapped[str | None] = mapped_column(Text(), nullable=True)
    verified_links_json: Mapped[list | None] = mapped_column(JSON(), nullable=True)
    screening_decision: Mapped[str | None] = mapped_column(String(50), nullable=True)
    screening_reason: Mapped[str | None] = mapped_column(Text(), nullable=True)
    match_score: Mapped[float | None] = mapped_column(nullable=True)
    match_rank: Mapped[int | None] = mapped_column(Integer(), nullable=True)
    match_summary: Mapped[str | None] = mapped_column(Text(), nullable=True)
    final_report_json: Mapped[dict | None] = mapped_column(JSON(), nullable=True)
    structured_cv_json: Mapped[dict | None] = mapped_column(JSON(), nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="new")
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
