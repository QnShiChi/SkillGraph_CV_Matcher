from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.candidate import Candidate
from app.schemas.candidate import CandidateCreate, CandidateUpdate


def list_candidates(session: Session) -> list[Candidate]:
    statement = select(Candidate).order_by(Candidate.created_at.desc())
    return list(session.scalars(statement).all())


def list_candidates_for_job(session: Session, job_id: int) -> list[Candidate]:
    statement = (
        select(Candidate)
        .where(Candidate.job_id == job_id)
        .order_by(Candidate.created_at.desc())
    )
    return list(session.scalars(statement).all())


def get_candidate_by_id(session: Session, candidate_id: int) -> Candidate | None:
    return session.get(Candidate, candidate_id)


def create_candidate(session: Session, payload: CandidateCreate) -> Candidate:
    candidate = Candidate(
        job_id=payload.job_id,
        full_name=payload.full_name,
        email=payload.email,
        resume_text=payload.resume_text,
        skills_text=payload.skills_text,
        source_type="manual",
        parse_status="processed",
        parse_source="manual",
        parse_confidence=None,
        graph_sync_status="pending",
        graph_sync_error=None,
        graph_synced_at=None,
        structured_cv_json=None,
        status=payload.status,
    )
    session.add(candidate)
    session.commit()
    session.refresh(candidate)
    return candidate


def update_candidate(
    session: Session,
    candidate: Candidate,
    payload: CandidateUpdate,
) -> Candidate:
    updates = payload.model_dump(exclude_unset=True)

    for field, value in updates.items():
        setattr(candidate, field, value)

    session.add(candidate)
    session.commit()
    session.refresh(candidate)
    return candidate


def delete_candidate(session: Session, candidate: Candidate) -> None:
    session.delete(candidate)
    session.commit()


def create_imported_candidate(
    session: Session,
    *,
    parsed: dict,
    source_file_name: str,
    job_id: int,
) -> Candidate:
    candidate = Candidate(
        job_id=job_id,
        full_name=parsed["full_name"],
        email=parsed["email"],
        resume_text=parsed["resume_text"],
        skills_text=parsed["skills_text"],
        source_type="cv_pdf",
        source_file_name=source_file_name,
        extract_source=parsed["extract_source"],
        parse_status="processed",
        parse_source=parsed["parse_source"],
        parse_confidence=parsed["parse_confidence"],
        graph_sync_status="pending",
        graph_sync_error=None,
        graph_synced_at=None,
        structured_cv_json=parsed["structured_cv_json"],
        status="new",
    )
    session.add(candidate)
    session.commit()
    session.refresh(candidate)
    return candidate


def update_candidate_graph_sync(
    session: Session,
    candidate: Candidate,
    *,
    status: str,
    error: str | None,
    synced_at: datetime | None,
) -> Candidate:
    candidate.graph_sync_status = status
    candidate.graph_sync_error = error
    candidate.graph_synced_at = synced_at.astimezone(timezone.utc) if synced_at else None
    session.add(candidate)
    session.commit()
    session.refresh(candidate)
    return candidate
