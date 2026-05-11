from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.candidate import Candidate
from app.schemas.candidate import CandidateCreate, CandidateUpdate


def list_candidates(session: Session) -> list[Candidate]:
    statement = select(Candidate).order_by(Candidate.created_at.desc())
    return list(session.scalars(statement).all())


def get_candidate_by_id(session: Session, candidate_id: int) -> Candidate | None:
    return session.get(Candidate, candidate_id)


def create_candidate(session: Session, payload: CandidateCreate) -> Candidate:
    candidate = Candidate(
        full_name=payload.full_name,
        email=payload.email,
        resume_text=payload.resume_text,
        skills_text=payload.skills_text,
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
