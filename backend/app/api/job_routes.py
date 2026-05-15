from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from sqlalchemy.orm import Session

from app.api.runtime_settings import get_runtime_settings
from app.core.config import Settings
from app.db.session import get_db_session
from app.repositories.job_repository import (
    create_job,
    delete_job,
    get_job_by_id,
    list_jobs,
    update_job,
)
from app.repositories.candidate_repository import list_candidates_for_job
from app.schemas.candidate import (
    CandidateBulkImportResponse,
    CandidateRankingResponse,
    CandidateRead,
)
from app.schemas.job import JobCreate, JobRead, JobUpdate
from app.schemas.job import JobKnowledgeGraphRead
from app.services.job_import_service import import_job_pdf
from app.services.candidate_import_service import import_candidate_pdf, import_candidates_bulk
from app.services.candidate_screening_service import (
    get_job_candidate_ranking,
    screen_and_rank_job_candidates,
)
from app.services.agentscope_runner import AgentScopeUnavailableError
from app.services.job_knowledge_graph import get_job_knowledge_graph

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.get("", response_model=list[JobRead])
def get_jobs(session: Session = Depends(get_db_session)) -> list[JobRead]:
    return list_jobs(session)


@router.post("", response_model=JobRead, status_code=status.HTTP_201_CREATED)
def post_job(payload: JobCreate, session: Session = Depends(get_db_session)) -> JobRead:
    return create_job(session, payload)


@router.post("/import", response_model=JobRead, status_code=status.HTTP_201_CREATED)
def import_job(
    file: UploadFile = File(...),
    session: Session = Depends(get_db_session),
    settings: Settings = Depends(get_runtime_settings),
) -> JobRead:
    if file.content_type != "application/pdf":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF uploads are supported.",
        )

    try:
        return import_job_pdf(session, file, settings=settings)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        ) from error


@router.get("/{job_id}", response_model=JobRead)
def get_job(job_id: int, session: Session = Depends(get_db_session)) -> JobRead:
    job = get_job_by_id(session, job_id)
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found.",
        )

    return job


@router.get("/{job_id}/candidates", response_model=list[CandidateRead])
def get_job_candidates(job_id: int, session: Session = Depends(get_db_session)) -> list[CandidateRead]:
    job = get_job_by_id(session, job_id)
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found.",
        )

    return list_candidates_for_job(session, job_id)


@router.get("/{job_id}/ranking", response_model=CandidateRankingResponse)
def get_job_ranking(job_id: int, session: Session = Depends(get_db_session)) -> CandidateRankingResponse:
    job = get_job_by_id(session, job_id)
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found.",
        )

    return CandidateRankingResponse(**get_job_candidate_ranking(session, job_id=job_id))


@router.get("/{job_id}/graph", response_model=JobKnowledgeGraphRead)
def get_job_graph(job_id: int, session: Session = Depends(get_db_session)) -> JobKnowledgeGraphRead:
    job = get_job_by_id(session, job_id)
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found.",
        )

    return JobKnowledgeGraphRead(**get_job_knowledge_graph(job))


@router.post("/{job_id}/screen-and-rank", response_model=CandidateRankingResponse)
def screen_and_rank_job(
    job_id: int,
    session: Session = Depends(get_db_session),
    settings: Settings = Depends(get_runtime_settings),
) -> CandidateRankingResponse:
    job = get_job_by_id(session, job_id)
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found.",
        )

    try:
        result = screen_and_rank_job_candidates(session, job_id=job_id, settings=settings)
    except AgentScopeUnavailableError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(error),
        ) from error

    return CandidateRankingResponse(**result)


@router.post("/{job_id}/candidates/import", response_model=CandidateRead, status_code=status.HTTP_201_CREATED)
def import_job_candidate(
    job_id: int,
    file: UploadFile = File(...),
    session: Session = Depends(get_db_session),
    settings: Settings = Depends(get_runtime_settings),
) -> CandidateRead:
    job = get_job_by_id(session, job_id)
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found.",
        )

    if file.content_type != "application/pdf":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF uploads are supported.",
        )

    try:
        return import_candidate_pdf(session, file, job_id=job_id, settings=settings)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        ) from error


@router.post(
    "/{job_id}/candidates/import-bulk",
    response_model=CandidateBulkImportResponse,
    status_code=status.HTTP_200_OK,
)
def import_job_candidates_bulk(
    job_id: int,
    files: list[UploadFile] = File(...),
    session: Session = Depends(get_db_session),
    settings: Settings = Depends(get_runtime_settings),
) -> CandidateBulkImportResponse:
    job = get_job_by_id(session, job_id)
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found.",
        )

    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one PDF file is required.",
        )

    result = import_candidates_bulk(session, files, job_id=job_id, settings=settings)
    return CandidateBulkImportResponse(**result)


@router.put("/{job_id}", response_model=JobRead)
def put_job(
    job_id: int,
    payload: JobUpdate,
    session: Session = Depends(get_db_session),
) -> JobRead:
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one field must be provided for update.",
        )

    job = get_job_by_id(session, job_id)
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found.",
        )

    return update_job(session, job, payload)


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_job(job_id: int, session: Session = Depends(get_db_session)) -> Response:
    job = get_job_by_id(session, job_id)
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found.",
        )

    delete_job(session, job)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
