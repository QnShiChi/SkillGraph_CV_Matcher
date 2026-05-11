from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_db_session
from app.repositories.job_repository import (
    create_job,
    delete_job,
    get_job_by_id,
    list_jobs,
    update_job,
)
from app.schemas.job import JobCreate, JobRead, JobUpdate

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.get("", response_model=list[JobRead])
def get_jobs(session: Session = Depends(get_db_session)) -> list[JobRead]:
    return list_jobs(session)


@router.post("", response_model=JobRead, status_code=status.HTTP_201_CREATED)
def post_job(payload: JobCreate, session: Session = Depends(get_db_session)) -> JobRead:
    return create_job(session, payload)


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
