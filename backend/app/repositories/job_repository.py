from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.job import Job
from app.schemas.job import JobCreate, JobUpdate


def list_jobs(session: Session) -> list[Job]:
    statement = select(Job).order_by(Job.created_at.desc())
    return list(session.scalars(statement).all())


def get_job_by_id(session: Session, job_id: int) -> Job | None:
    return session.get(Job, job_id)


def create_job(session: Session, payload: JobCreate) -> Job:
    job = Job(
        title=payload.title,
        description=payload.description,
        required_skills_text=payload.required_skills_text,
        source_type="manual",
        parse_status="processed",
        parse_source="manual",
        parse_confidence=None,
        status=payload.status,
    )
    session.add(job)
    session.commit()
    session.refresh(job)
    return job


def create_imported_job(
    session: Session,
    *,
    parsed: dict,
    source_file_name: str,
) -> Job:
    job = Job(
        title=parsed["title"],
        description=parsed["description"],
        required_skills_text=parsed["required_skills_text"],
        responsibilities_text=parsed["responsibilities_text"],
        qualifications_text=parsed["qualifications_text"],
        raw_jd_text=parsed["raw_jd_text"],
        source_type="jd_pdf",
        source_file_name=source_file_name,
        parse_status="processed",
        parse_source=parsed["parse_source"],
        parse_confidence=parsed["parse_confidence"],
        structured_jd_json=parsed["structured_jd_json"],
        status="draft",
    )
    session.add(job)
    session.commit()
    session.refresh(job)
    return job


def update_job(session: Session, job: Job, payload: JobUpdate) -> Job:
    updates = payload.model_dump(exclude_unset=True)

    for field, value in updates.items():
        setattr(job, field, value)

    session.add(job)
    session.commit()
    session.refresh(job)
    return job


def delete_job(session: Session, job: Job) -> None:
    session.delete(job)
    session.commit()
