# Update and Delete API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add partial-update `PUT` endpoints and hard-delete `DELETE` endpoints for `jobs` and `candidates`, while preserving the current PostgreSQL-backed CRUD structure and frontend read flow.

**Architecture:** The existing repository-first persistence layer will be extended with update schemas, get-by-id/update/delete repository functions, and thin route handlers that return `400` for empty update payloads, `404` for missing records, updated objects for `PUT`, and `204` for successful deletes. The frontend remains read-only and is only verified as a consumer of the changed backend state.

**Tech Stack:** FastAPI, Python 3.11, SQLAlchemy 2.x, PostgreSQL, Pydantic, Next.js 15, Docker Compose

---

## File Structure

### Backend

- Modify: `backend/app/schemas/job.py`
- Modify: `backend/app/schemas/candidate.py`
- Modify: `backend/app/repositories/job_repository.py`
- Modify: `backend/app/repositories/candidate_repository.py`
- Modify: `backend/app/api/job_routes.py`
- Modify: `backend/app/api/candidate_routes.py`

### Verification

- Verify: `frontend/app/page.tsx`
- Verify: running Docker services and existing data flow

### Task 1: Add Partial Update Schemas for Jobs and Candidates

**Files:**
- Modify: `backend/app/schemas/job.py`
- Modify: `backend/app/schemas/candidate.py`

- [ ] **Step 1: Extend the job schema module with `JobUpdate`**

```python
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
```

- [ ] **Step 2: Extend the candidate schema module with `CandidateUpdate`**

```python
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr


CandidateStatus = Literal["new", "reviewed", "matched"]


class CandidateCreate(BaseModel):
    full_name: str
    email: EmailStr | None = None
    resume_text: str | None = None
    skills_text: str | None = None
    status: CandidateStatus = "new"


class CandidateUpdate(BaseModel):
    full_name: str | None = None
    email: EmailStr | None = None
    resume_text: str | None = None
    skills_text: str | None = None
    status: CandidateStatus | None = None


class CandidateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: EmailStr | None
    resume_text: str | None
    skills_text: str | None
    status: CandidateStatus
    created_at: datetime
    updated_at: datetime
```

- [ ] **Step 3: Verify the schema modules**

Run: `sed -n '1,260p' backend/app/schemas/job.py backend/app/schemas/candidate.py`
Expected: each module includes `Create`, `Update`, and `Read` schemas, with all update fields optional

- [ ] **Step 4: Commit the update schemas**

```bash
git add backend/app/schemas/job.py backend/app/schemas/candidate.py
git commit -m "feat: add partial update schemas for jobs and candidates"
```

### Task 2: Extend Repositories With Get, Update, and Delete Operations

**Files:**
- Modify: `backend/app/repositories/job_repository.py`
- Modify: `backend/app/repositories/candidate_repository.py`

- [ ] **Step 1: Extend the job repository**

```python
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
        status=payload.status,
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
```

- [ ] **Step 2: Extend the candidate repository**

```python
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


def update_candidate(session: Session, candidate: Candidate, payload: CandidateUpdate) -> Candidate:
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
```

- [ ] **Step 3: Verify the repository modules**

Run: `sed -n '1,320p' backend/app/repositories/job_repository.py backend/app/repositories/candidate_repository.py`
Expected: each repository now supports list, get-by-id, create, update, and delete operations

- [ ] **Step 4: Commit the repository updates**

```bash
git add backend/app/repositories/job_repository.py backend/app/repositories/candidate_repository.py
git commit -m "feat: add update and delete repository operations"
```

### Task 3: Add `PUT` and `DELETE` Routes for Jobs

**Files:**
- Modify: `backend/app/api/job_routes.py`

- [ ] **Step 1: Add `HTTPException`, `Response`, and repository imports**

```python
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
```

- [ ] **Step 2: Add the `PUT` and `DELETE` handlers**

```python
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found.")

    return update_job(session, job, payload)


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_job(job_id: int, session: Session = Depends(get_db_session)) -> Response:
    job = get_job_by_id(session, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found.")

    delete_job(session, job)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
```

- [ ] **Step 3: Verify the job route module**

Run: `sed -n '1,320p' backend/app/api/job_routes.py`
Expected: the job routes include list, create, partial-update `PUT`, and hard-delete `DELETE`

- [ ] **Step 4: Commit the job route changes**

```bash
git add backend/app/api/job_routes.py
git commit -m "feat: add job update and delete routes"
```

### Task 4: Add `PUT` and `DELETE` Routes for Candidates

**Files:**
- Modify: `backend/app/api/candidate_routes.py`

- [ ] **Step 1: Add `HTTPException`, `Response`, and repository imports**

```python
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
from app.schemas.candidate import CandidateCreate, CandidateRead, CandidateUpdate
```

- [ ] **Step 2: Add the `PUT` and `DELETE` handlers**

```python
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
```

- [ ] **Step 3: Verify the candidate route module**

Run: `sed -n '1,340p' backend/app/api/candidate_routes.py`
Expected: the candidate routes include list, create, partial-update `PUT`, and hard-delete `DELETE`

- [ ] **Step 4: Commit the candidate route changes**

```bash
git add backend/app/api/candidate_routes.py
git commit -m "feat: add candidate update and delete routes"
```

### Task 5: Run End-to-End Update/Delete Verification

**Files:**
- Verify: running Docker services
- Verify: existing persisted data through API and frontend

- [ ] **Step 1: Rebuild and start the stack**

Run: `make up`
Expected: frontend, backend, PostgreSQL, and Neo4j are running without crash loops

- [ ] **Step 2: Ensure migrations are applied**

Run: `make migrate`
Expected: Alembic reports the database is already at head or upgrades cleanly with no schema changes needed

- [ ] **Step 3: Create a job and candidate if test data is missing**

Run: `curl -s http://localhost:8000/api/jobs`
Expected: if empty, create a test job with:

```bash
curl -s -X POST http://localhost:8000/api/jobs \
  -H 'Content-Type: application/json' \
  -d '{"title":"Frontend Developer","description":"Build HR-facing dashboard screens","required_skills_text":"Next.js, TypeScript, PostgreSQL","status":"draft"}'
```

Run: `curl -s http://localhost:8000/api/candidates`
Expected: if empty, create a test candidate with:

```bash
curl -s -X POST http://localhost:8000/api/candidates \
  -H 'Content-Type: application/json' \
  -d '{"full_name":"Nguyen Van A","email":"nguyenvana@example.com","resume_text":"Built internal dashboards with React and REST APIs.","skills_text":"React, REST API, SQL","status":"new"}'
```

- [ ] **Step 4: Verify partial update for jobs**

Run: `curl -s -X PUT http://localhost:8000/api/jobs/1 -H 'Content-Type: application/json' -d '{"status":"analyzed"}'`
Expected: response still contains the original title/description fields and only `status` changes to `analyzed`

- [ ] **Step 5: Verify `404` for missing job update**

Run: `curl -i -X PUT http://localhost:8000/api/jobs/99999 -H 'Content-Type: application/json' -d '{"status":"archived"}'`
Expected: HTTP `404` with `"Job not found."`

- [ ] **Step 6: Verify hard delete for jobs**

Run: `curl -i -X DELETE http://localhost:8000/api/jobs/1`
Expected: HTTP `204 No Content`

Run: `curl -s http://localhost:8000/api/jobs`
Expected: deleted job no longer appears in the returned array

- [ ] **Step 7: Verify partial update for candidates**

Create a fresh candidate if needed, then run:
`curl -s -X PUT http://localhost:8000/api/candidates/1 -H 'Content-Type: application/json' -d '{"status":"reviewed"}'`
Expected: response still contains the original `full_name` and `email`, while `status` changes to `reviewed`

- [ ] **Step 8: Verify `404` for missing candidate update**

Run: `curl -i -X PUT http://localhost:8000/api/candidates/99999 -H 'Content-Type: application/json' -d '{"status":"matched"}'`
Expected: HTTP `404` with `"Candidate not found."`

- [ ] **Step 9: Verify hard delete for candidates**

Run: `curl -i -X DELETE http://localhost:8000/api/candidates/1`
Expected: HTTP `204 No Content`

Run: `curl -s http://localhost:8000/api/candidates`
Expected: deleted candidate no longer appears in the returned array

- [ ] **Step 10: Verify the frontend still reflects remaining data**

Run: `curl -I http://localhost:3000`
Expected: HTTP `200` or redirect response confirming the frontend serves normally

Run: `curl -s http://localhost:3000`
Expected: HTML renders without crash and reflects the current state of any remaining job/candidate records

- [ ] **Step 11: Commit final update/delete adjustments**

```bash
git add .
git commit -m "feat: add update and delete APIs for jobs and candidates"
```
