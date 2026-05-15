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
from app.repositories.job_repository import get_job_by_id
from app.schemas.candidate import (
    CandidateCreate,
    CandidateJobRecommendationsRead,
    CandidateKnowledgeGraphRead,
    CandidateRead,
    CandidateUpdate,
)
from app.services.candidate_job_recommendation_service import (
    get_candidate_job_recommendations,
)
from app.services.candidate_knowledge_graph import get_candidate_knowledge_graph

router = APIRouter(prefix="/api/candidates", tags=["candidates"])


@router.get("", response_model=list[CandidateRead])
def get_candidates(session: Session = Depends(get_db_session)) -> list[CandidateRead]:
    return list_candidates(session)


@router.get("/{candidate_id}/graph", response_model=CandidateKnowledgeGraphRead)
def get_candidate_graph(
    candidate_id: int,
    session: Session = Depends(get_db_session),
) -> CandidateKnowledgeGraphRead:
    candidate = get_candidate_by_id(session, candidate_id)
    if candidate is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate not found.",
        )

    return CandidateKnowledgeGraphRead(**get_candidate_knowledge_graph(candidate))


@router.get(
    "/{candidate_id}/job-recommendations",
    response_model=CandidateJobRecommendationsRead,
)
def get_candidate_job_matches(
    candidate_id: int,
    session: Session = Depends(get_db_session),
) -> CandidateJobRecommendationsRead:
    candidate = get_candidate_by_id(session, candidate_id)
    if candidate is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate not found.",
        )

    return CandidateJobRecommendationsRead(
        **get_candidate_job_recommendations(session, candidate=candidate)
    )


@router.post("", response_model=CandidateRead, status_code=status.HTTP_201_CREATED)
def post_candidate(
    payload: CandidateCreate,
    session: Session = Depends(get_db_session),
) -> CandidateRead:
    if payload.job_id is not None and get_job_by_id(session, payload.job_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found.",
        )

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
