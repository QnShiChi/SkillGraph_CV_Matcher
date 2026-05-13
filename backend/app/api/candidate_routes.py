from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_db_session
from app.repositories.candidate_repository import (
    create_candidate,
    delete_candidate,
    get_candidate_by_id,
    list_candidates,
    update_candidate,
)
from app.schemas.candidate import (
    CandidateCreate,
    CandidateRead,
    CandidateUpdate,
)

router = APIRouter(prefix="/api/candidates", tags=["candidates"])


@router.get("", response_model=list[CandidateRead])
def get_candidates(session: Session = Depends(get_db_session)) -> list[CandidateRead]:
    return list_candidates(session)


@router.post("", response_model=CandidateRead, status_code=status.HTTP_201_CREATED)
def post_candidate(
    payload: CandidateCreate,
    session: Session = Depends(get_db_session),
) -> CandidateRead:
    return create_candidate(session, payload)

@router.put("/{candidate_id}", response_model=CandidateRead)
def put_candidate(
    candidate_id: int,
    payload: CandidateUpdate,
    session: Session = Depends(get_db_session),
) -> CandidateRead:
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one field must be provided for update.",
        )

    candidate = get_candidate_by_id(session, candidate_id)
    if candidate is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate not found.",
        )

    return update_candidate(session, candidate, payload)


@router.delete("/{candidate_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_candidate(
    candidate_id: int,
    session: Session = Depends(get_db_session),
) -> Response:
    candidate = get_candidate_by_id(session, candidate_id)
    if candidate is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate not found.",
        )

    delete_candidate(session, candidate)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
