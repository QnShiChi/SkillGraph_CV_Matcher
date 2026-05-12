# JD Import and Job Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add text-based JD PDF import, graph-ready job persistence, and a dedicated `/jobs/[jobId]` workspace route while preserving manual job creation.

**Architecture:** The backend will extend the `jobs` schema with import- and graph-oriented fields, then introduce a rule-based JD import pipeline backed by a fixed taxonomy and `PyMuPDF`. The frontend will keep `Admin Jobs` as the entry point, add `Import JD PDF` as the primary action, add `Open Workspace` on job cards, and render a job-specific workspace for normalized and structured JD data.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, PyMuPDF, PostgreSQL JSONB, Next.js 15 App Router, TypeScript, Tailwind CSS

---

## File Structure

### Backend dependencies and test scaffolding

- Modify: `backend/requirements.txt`
- Create: `backend/requirements-dev.txt`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/services/test_jd_parser.py`
- Create: `backend/tests/api/test_job_import_api.py`

### Backend schema and persistence

- Modify: `backend/app/models/job.py`
- Modify: `backend/app/models/__init__.py`
- Modify: `backend/app/schemas/job.py`
- Modify: `backend/app/repositories/job_repository.py`
- Create: `backend/alembic/versions/20260512_01_expand_jobs_for_jd_import.py`

### Backend import and taxonomy services

- Create: `backend/app/services/skill_taxonomy.py`
- Create: `backend/app/services/jd_parser.py`
- Create: `backend/app/services/job_import_service.py`

### Backend API wiring

- Modify: `backend/app/api/job_routes.py`
- Modify: `backend/app/main.py`

### Frontend jobs admin import flow

- Modify: `frontend/lib/api.ts`
- Modify: `frontend/components/jobs/job-list.tsx`
- Modify: `frontend/components/jobs/job-admin-client.tsx`
- Create: `frontend/components/jobs/jd-import-form.tsx`

### Frontend job workspace

- Create: `frontend/app/(dashboard)/jobs/[jobId]/page.tsx`
- Create: `frontend/components/jobs/job-workspace.tsx`
- Create: `frontend/components/jobs/job-structured-data.tsx`

### Documentation

- Modify: `README.md`

## Task 1: Add PDF Parsing and Test Scaffolding

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/requirements-dev.txt`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/services/test_jd_parser.py`

- [ ] **Step 1: Add runtime and dev dependencies**

Update `backend/requirements.txt` to add PDF parsing and add a dev requirements file for tests.

```txt
# backend/requirements.txt
fastapi==0.116.1
uvicorn[standard]==0.35.0
pydantic-settings==2.10.1
psycopg[binary]==3.2.9
neo4j==5.28.1
sqlalchemy==2.0.41
alembic==1.16.1
email-validator==2.2.0
PyMuPDF==1.26.0
```

```txt
# backend/requirements-dev.txt
-r requirements.txt
pytest==8.3.5
httpx==0.28.1
```

- [ ] **Step 2: Add pytest fixtures for service and API tests**

Create a minimal test scaffold that later tasks can reuse.

```python
# backend/tests/conftest.py
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db_session
from app.main import app


@pytest.fixture
def session() -> Generator[Session, None, None]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
      yield db
    finally:
      db.close()
      Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client(session: Session) -> Generator[TestClient, None, None]:
    def override_get_db_session() -> Generator[Session, None, None]:
        yield session

    app.dependency_overrides[get_db_session] = override_get_db_session
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
```

- [ ] **Step 3: Write failing parser tests for graph-ready JD output**

Create tests that define the target behavior for section extraction, canonical skills, and relation hints.

```python
# backend/tests/services/test_jd_parser.py
from app.services.jd_parser import parse_jd_text


def test_parse_jd_text_returns_graph_ready_structure() -> None:
    jd_text = """
    Senior Frontend Developer

    Overview
    Build modern recruiting dashboards for enterprise HR teams.

    Responsibilities
    - Build Next.js interfaces
    - Integrate REST APIs

    Required Skills
    - Next.js
    - TypeScript
    - PostgreSQL

    Nice to Have
    - Neo4j
    """

    result = parse_jd_text(jd_text)

    assert result["title"] == "Senior Frontend Developer"
    assert "dashboard" in result["description"].lower()
    assert "Next.js" in result["required_skills_text"]
    assert result["structured_jd_json"]["required_skills"][0]["canonical"] == "nextjs"
    assert result["structured_jd_json"]["required_skills"][0]["importance"] == 5
    assert result["structured_jd_json"]["required_skills"][0]["requirement_type"] == "must_have"
    assert "react" in result["structured_jd_json"]["required_skills"][0]["prerequisites"]


def test_parse_jd_text_marks_preferred_skill_as_nice_to_have() -> None:
    jd_text = """
    Backend Engineer

    Requirements
    - Python
    - FastAPI

    Preferred Skills
    - Neo4j
    """

    result = parse_jd_text(jd_text)
    skills = {
        item["canonical"]: item for item in result["structured_jd_json"]["required_skills"]
    }

    assert skills["python"]["requirement_type"] == "must_have"
    assert skills["neo4j"]["requirement_type"] == "nice_to_have"
```

- [ ] **Step 4: Run parser tests to verify they fail**

Run: `cd backend && python -m pytest tests/services/test_jd_parser.py -v`

Expected: FAIL with `ModuleNotFoundError` or `ImportError` because `app.services.jd_parser` does not exist yet.

- [ ] **Step 5: Commit**

```bash
git add backend/requirements.txt backend/requirements-dev.txt backend/tests/conftest.py backend/tests/services/test_jd_parser.py
git commit -m "test: scaffold JD parser test baseline"
```

## Task 2: Expand the Jobs Schema for Import and Graph-ready Data

**Files:**
- Modify: `backend/app/models/job.py`
- Modify: `backend/app/models/__init__.py`
- Modify: `backend/app/schemas/job.py`
- Create: `backend/alembic/versions/20260512_01_expand_jobs_for_jd_import.py`

- [ ] **Step 1: Write the migration expectations into the schema types**

Update the job model and schemas so the intended persistence shape is explicit before writing the migration.

```python
# backend/app/models/job.py
from sqlalchemy import JSON, DateTime, String, Text, func

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
    parse_status: Mapped[str] = mapped_column(String(50), nullable=False, default="processed")
    structured_jd_json: Mapped[dict | None] = mapped_column(JSON(), nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="draft")
```

```python
# backend/app/schemas/job.py
from typing import Any, Literal

JobStatus = Literal["draft", "analyzed", "archived"]
JobSourceType = Literal["manual", "jd_pdf"]
JobParseStatus = Literal["processed", "failed"]

class JobRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str | None
    required_skills_text: str | None
    responsibilities_text: str | None
    qualifications_text: str | None
    raw_jd_text: str | None
    source_type: JobSourceType
    source_file_name: str | None
    parse_status: JobParseStatus
    structured_jd_json: dict[str, Any] | None
    status: JobStatus
    created_at: datetime
    updated_at: datetime
```

- [ ] **Step 2: Write the Alembic migration**

Create the schema migration for all new import-related columns.

```python
# backend/alembic/versions/20260512_01_expand_jobs_for_jd_import.py
from alembic import op
import sqlalchemy as sa


revision = "20260512_01"
down_revision = "20260511_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("jobs", sa.Column("responsibilities_text", sa.Text(), nullable=True))
    op.add_column("jobs", sa.Column("qualifications_text", sa.Text(), nullable=True))
    op.add_column("jobs", sa.Column("raw_jd_text", sa.Text(), nullable=True))
    op.add_column("jobs", sa.Column("source_type", sa.String(length=50), nullable=False, server_default="manual"))
    op.add_column("jobs", sa.Column("source_file_name", sa.String(length=255), nullable=True))
    op.add_column("jobs", sa.Column("parse_status", sa.String(length=50), nullable=False, server_default="processed"))
    op.add_column("jobs", sa.Column("structured_jd_json", sa.JSON(), nullable=True))
    op.alter_column("jobs", "source_type", server_default=None)
    op.alter_column("jobs", "parse_status", server_default=None)


def downgrade() -> None:
    op.drop_column("jobs", "structured_jd_json")
    op.drop_column("jobs", "parse_status")
    op.drop_column("jobs", "source_file_name")
    op.drop_column("jobs", "source_type")
    op.drop_column("jobs", "raw_jd_text")
    op.drop_column("jobs", "qualifications_text")
    op.drop_column("jobs", "responsibilities_text")
```

- [ ] **Step 3: Run migration checks**

Run: `make migrate`

Expected: Alembic applies revision `20260512_01` without errors.

- [ ] **Step 4: Commit**

```bash
git add backend/app/models/job.py backend/app/models/__init__.py backend/app/schemas/job.py backend/alembic/versions/20260512_01_expand_jobs_for_jd_import.py
git commit -m "feat: expand jobs schema for JD import"
```

## Task 3: Implement the Taxonomy and JD Parser

**Files:**
- Create: `backend/app/services/skill_taxonomy.py`
- Create: `backend/app/services/jd_parser.py`
- Test: `backend/tests/services/test_jd_parser.py`

- [ ] **Step 1: Add the fixed MVP skill taxonomy**

Create a single source of truth for canonical skills, aliases, groups, and relation hints.

```python
# backend/app/services/skill_taxonomy.py
SKILL_TAXONOMY = {
    "nextjs": {
        "display_name": "Next.js",
        "aliases": ["NextJS", "Next.js"],
        "skill_groups": ["frontend"],
        "prerequisites": ["react", "javascript"],
        "related_skills": ["typescript", "ssr"],
        "specializations": ["frontend_framework"],
    },
    "fastapi": {
        "display_name": "FastAPI",
        "aliases": ["FastAPI"],
        "skill_groups": ["backend"],
        "prerequisites": ["python", "rest_api"],
        "related_skills": ["docker", "postgresql"],
        "specializations": ["python_backend_framework"],
    },
    "postgresql": {
        "display_name": "PostgreSQL",
        "aliases": ["Postgres", "PostgreSQL"],
        "skill_groups": ["database"],
        "prerequisites": ["sql"],
        "related_skills": ["docker", "dbt"],
        "specializations": ["relational_database"],
    },
}
```

- [ ] **Step 2: Implement the minimal parser needed to satisfy the tests**

Add a parser that cleans text, detects sections, and produces the graph-ready structure.

```python
# backend/app/services/jd_parser.py
from __future__ import annotations

import re
from typing import Any

from app.services.skill_taxonomy import SKILL_TAXONOMY


def parse_jd_text(raw_text: str) -> dict[str, Any]:
    cleaned = _clean_text(raw_text)
    lines = [line.strip() for line in cleaned.splitlines() if line.strip()]
    title = lines[0]
    sections = _extract_sections(cleaned)
    required_skills = _extract_skills(sections)

    return {
        "title": title,
        "description": sections.get("summary") or sections.get("overview"),
        "required_skills_text": "\n".join(sections.get("required_skills", [])) or None,
        "responsibilities_text": "\n".join(sections.get("responsibilities", [])) or None,
        "qualifications_text": "\n".join(sections.get("qualifications", [])) or None,
        "raw_jd_text": cleaned,
        "structured_jd_json": {
            "title": title,
            "summary": sections.get("summary") or sections.get("overview"),
            "required_skills": required_skills,
            "responsibilities": [
                {"text": item, "section_origin": "responsibilities", "confidence": 0.75}
                for item in sections.get("responsibilities", [])
            ],
            "qualifications": [
                {"text": item, "section_origin": "qualifications", "confidence": 0.85}
                for item in sections.get("qualifications", [])
            ],
            "skill_groups": sorted({group for item in required_skills for group in item["skill_groups"]}),
            "soft_skills": [],
            "language_requirements": [],
            "experience_years": None,
        },
    }


def _clean_text(raw_text: str) -> str:
    return re.sub(r"\n{3,}", "\n\n", raw_text).strip()
```

- [ ] **Step 3: Run parser tests to verify they pass**

Run: `cd backend && python -m pytest tests/services/test_jd_parser.py -v`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/skill_taxonomy.py backend/app/services/jd_parser.py backend/tests/services/test_jd_parser.py
git commit -m "feat: add graph-ready JD parser and taxonomy"
```

## Task 4: Add the JD Import Service and API Endpoint

**Files:**
- Create: `backend/app/services/job_import_service.py`
- Modify: `backend/app/repositories/job_repository.py`
- Modify: `backend/app/api/job_routes.py`
- Create: `backend/tests/api/test_job_import_api.py`

- [ ] **Step 1: Write failing API tests for import**

Define the endpoint contract, success behavior, and failure for unreadable input.

```python
# backend/tests/api/test_job_import_api.py
from io import BytesIO


def test_import_job_pdf_creates_graph_ready_job(client) -> None:
    pdf_bytes = (
        b"%PDF-1.4\n"
        b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
        b"2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n"
        b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 300]/Contents 4 0 R>>endobj\n"
        b"4 0 obj<</Length 80>>stream\nBT /F1 12 Tf 20 250 Td (Senior Backend Engineer) Tj ET\nendstream endobj\ntrailer<</Root 1 0 R>>\n%%EOF"
    )

    response = client.post(
        "/api/jobs/import",
        files={"file": ("jd.pdf", BytesIO(pdf_bytes), "application/pdf")},
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["source_type"] == "jd_pdf"
    assert payload["parse_status"] == "processed"
    assert payload["structured_jd_json"] is not None


def test_import_job_pdf_rejects_non_pdf(client) -> None:
    response = client.post(
        "/api/jobs/import",
        files={"file": ("jd.txt", BytesIO(b"not a pdf"), "text/plain")},
    )

    assert response.status_code == 400
```

- [ ] **Step 2: Run API tests to verify they fail**

Run: `cd backend && python -m pytest tests/api/test_job_import_api.py -v`

Expected: FAIL because `/api/jobs/import` does not exist yet.

- [ ] **Step 3: Implement the import service and endpoint**

Add a service that extracts text with `PyMuPDF`, calls the parser, and persists the resulting job.

```python
# backend/app/services/job_import_service.py
import fitz
from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.repositories.job_repository import create_imported_job
from app.services.jd_parser import parse_jd_text


def import_job_pdf(session: Session, file: UploadFile):
    pdf_bytes = file.file.read()
    document = fitz.open(stream=pdf_bytes, filetype="pdf")
    raw_text = "\n".join(page.get_text() for page in document).strip()

    if not raw_text:
        raise ValueError("Unable to extract readable text from PDF. Please upload a text-based PDF.")

    parsed = parse_jd_text(raw_text)
    return create_imported_job(session, parsed=parsed, source_file_name=file.filename or "uploaded.pdf")
```

```python
# backend/app/api/job_routes.py
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.services.job_import_service import import_job_pdf


@router.post("/import", response_model=JobRead, status_code=status.HTTP_201_CREATED)
def import_job(
    file: UploadFile = File(...),
    session: Session = Depends(get_db_session),
) -> JobRead:
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF uploads are supported.")

    try:
        return import_job_pdf(session, file)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
```

- [ ] **Step 4: Run API tests to verify they pass**

Run: `cd backend && python -m pytest tests/api/test_job_import_api.py -v`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/job_import_service.py backend/app/repositories/job_repository.py backend/app/api/job_routes.py backend/tests/api/test_job_import_api.py
git commit -m "feat: add JD PDF import endpoint"
```

## Task 5: Add Admin Jobs Import UI and Open Workspace Action

**Files:**
- Modify: `frontend/lib/api.ts`
- Modify: `frontend/components/jobs/job-list.tsx`
- Modify: `frontend/components/jobs/job-admin-client.tsx`
- Create: `frontend/components/jobs/jd-import-form.tsx`

- [ ] **Step 1: Extend frontend API helpers**

Add types and upload helper for imported jobs.

```ts
// frontend/lib/api.ts
export type Job = {
  id: number;
  title: string;
  description: string | null;
  required_skills_text: string | null;
  responsibilities_text: string | null;
  qualifications_text: string | null;
  raw_jd_text: string | null;
  source_type: "manual" | "jd_pdf";
  source_file_name: string | null;
  parse_status: "processed" | "failed";
  structured_jd_json: Record<string, unknown> | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export async function importJobPdf(file: File): Promise<Job> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${getApiBaseUrl()}/api/jobs/import`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Unable to import JD PDF.");
  }

  return (await response.json()) as Job;
}
```

- [ ] **Step 2: Add the import drawer form**

Create a focused upload form for text-based PDF import.

```tsx
// frontend/components/jobs/jd-import-form.tsx
"use client";

import { useState } from "react";

export function JdImportForm({
  isSubmitting,
  errorMessage,
  onCancel,
  onSubmit,
}: {
  isSubmitting: boolean;
  errorMessage?: string | null;
  onCancel: () => void;
  onSubmit: (file: File) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);

  return (
    <form
      className="space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        if (file) {
          await onSubmit(file);
        }
      }}
    >
      <div className="rounded-[16px] bg-[rgba(148,151,169,0.08)] p-4 text-sm text-[var(--color-muted)]">
        Upload a text-based JD PDF. Scanned PDFs are not supported in this phase.
      </div>
      <input
        type="file"
        accept="application/pdf,.pdf"
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
      />
      {errorMessage ? <div className="text-sm text-[#8d2020]">{errorMessage}</div> : null}
      <div className="flex gap-3">
        <button type="submit" disabled={!file || isSubmitting}>Import JD PDF</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Add Import JD and Open Workspace to jobs admin**

Extend the client state so jobs admin supports two drawers and workspace navigation.

```tsx
// frontend/components/jobs/job-admin-client.tsx
import Link from "next/link";
import { importJobPdf } from "@/lib/api";
import { JdImportForm } from "@/components/jobs/jd-import-form";

const [importOpen, setImportOpen] = useState(false);

async function handleImport(file: File) {
  setIsSubmitting(true);
  setFormError(null);
  try {
    const importedJob = await importJobPdf(file);
    setJobs((current) => [importedJob, ...current]);
    setImportOpen(false);
  } catch (error) {
    setFormError(error instanceof Error ? error.message : "Unable to import JD PDF.");
  } finally {
    setIsSubmitting(false);
  }
}

<PageHeader
  action={
    <div className="flex gap-3">
      <button type="button" onClick={() => setImportOpen(true)}>Import JD PDF</button>
      <button type="button" onClick={openCreateDrawer}>Create Job</button>
    </div>
  }
/>
```

```tsx
// frontend/components/jobs/job-list.tsx
import Link from "next/link";

<div className="flex gap-2">
  <Link href={`/jobs/${job.id}`} className="rounded-[12px] bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white">
    Open Workspace
  </Link>
  <button type="button" onClick={() => onEdit(job)}>Edit</button>
  <button type="button" onClick={() => onDelete(job)}>Delete</button>
</div>
```

- [ ] **Step 4: Run frontend build and route checks**

Run:

- `docker compose exec -T frontend npm run build`
- `curl -I http://localhost:3000/admin/jobs`

Expected:

- Next.js build PASS
- route returns `200`

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/api.ts frontend/components/jobs/job-list.tsx frontend/components/jobs/job-admin-client.tsx frontend/components/jobs/jd-import-form.tsx
git commit -m "feat: add JD import UX to jobs admin"
```

## Task 6: Add the Job Workspace Route

**Files:**
- Create: `frontend/app/(dashboard)/jobs/[jobId]/page.tsx`
- Create: `frontend/components/jobs/job-workspace.tsx`
- Create: `frontend/components/jobs/job-structured-data.tsx`
- Modify: `frontend/lib/api.ts`

- [ ] **Step 1: Add a job detail fetch helper**

Extend the frontend API layer with a single-job fetch helper.

```ts
// frontend/lib/api.ts
export async function getJob(jobId: number): Promise<Job | null> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/jobs/${jobId}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as Job;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Add the backend read-by-id route if missing**

Expose a read endpoint for the workspace page.

```python
# backend/app/api/job_routes.py
@router.get("/{job_id}", response_model=JobRead)
def get_job(job_id: int, session: Session = Depends(get_db_session)) -> JobRead:
    job = get_job_by_id(session, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found.")
    return job
```

- [ ] **Step 3: Build the workspace page**

Create the dedicated route that renders normalized fields, structured graph-ready data, and raw text.

```tsx
// frontend/app/(dashboard)/jobs/[jobId]/page.tsx
import { notFound } from "next/navigation";

import { JobWorkspace } from "@/components/jobs/job-workspace";
import { getJob } from "@/lib/api";

export default async function JobWorkspacePage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const job = await getJob(Number(jobId));

  if (!job) {
    notFound();
  }

  return <JobWorkspace job={job} />;
}
```

```tsx
// frontend/components/jobs/job-workspace.tsx
import Link from "next/link";

import type { Job } from "@/lib/api";

import { JobStructuredData } from "@/components/jobs/job-structured-data";
import { PageHeader } from "@/components/page-header";
import { StateCard } from "@/components/state-card";

export function JobWorkspace({ job }: { job: Job }) {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Job Workspace"
        title={job.title}
        description={`Source: ${job.source_type} · Parse status: ${job.parse_status}`}
        action={<Link href="/admin/jobs">Back to Admin Jobs</Link>}
      />
      <JobStructuredData job={job} />
      <StateCard title="Raw JD Text" description={job.raw_jd_text ?? "No raw JD text available."} />
      <StateCard title="Candidate Import" description="Candidate upload and matching will be added in the next phase." />
    </div>
  );
}
```

- [ ] **Step 4: Verify the workspace route**

Run:

- `docker compose exec -T frontend npm run build`
- `curl -I http://localhost:3000/jobs/3`

Expected:

- build PASS
- workspace route returns `200` for an existing job

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/job_routes.py frontend/lib/api.ts frontend/app/(dashboard)/jobs/[jobId]/page.tsx frontend/components/jobs/job-workspace.tsx frontend/components/jobs/job-structured-data.tsx
git commit -m "feat: add job workspace route"
```

## Task 7: Update Documentation and End-to-end Verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document the new JD import workflow**

Add a short section documenting:

- `Import JD PDF` usage
- text-based PDF limitation
- `Open Workspace`
- `/jobs/[jobId]` purpose

```md
## JD Import Workflow

1. Start the stack with `make up`
2. Run migrations with `make migrate`
3. Open `http://localhost:3000/admin/jobs`
4. Use `Import JD PDF` to upload a text-based JD PDF
5. Open the generated job with `Open Workspace`

Current limitations:

- only text-based PDFs are supported
- CV upload and matching are not implemented yet
```

- [ ] **Step 2: Run the full verification sequence**

Run:

- `make up`
- `make migrate`
- `docker compose exec -T frontend npm run build`
- `curl -I http://localhost:3000/overview`
- `curl -I http://localhost:3000/admin/jobs`
- `curl -I http://localhost:3000/jobs/3`

Expected:

- stack is healthy
- migrations apply
- frontend build passes
- all three routes return `200`

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document JD import workspace flow"
```

## Self-Review

### Spec coverage

Covered:

- text-based JD PDF import
- graph-ready `structured_jd_json`
- fixed taxonomy-driven relation hints
- manual create job compatibility
- `Import JD PDF` primary action
- `Open Workspace` action
- `/jobs/[jobId]` route with normalized, structured, and raw JD views

No deliberate gaps remain relative to the current spec. Candidate import, matching, ranking, explanation, OCR, and Neo4j writes are intentionally out of scope and are called out as such.

### Placeholder scan

Checked for:

- `TBD`
- `TODO`
- vague “add validation” wording
- missing commands

No placeholders remain. Each task contains explicit files, commands, and code direction.

### Type consistency

Confirmed consistency across the plan for:

- `source_type`
- `parse_status`
- `structured_jd_json`
- `/api/jobs/import`
- `/jobs/[jobId]`
- `Open Workspace`

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-12-jd-import-job-workspace.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
