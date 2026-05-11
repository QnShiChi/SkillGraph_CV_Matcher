# Backend Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add SQLAlchemy, Alembic, initial PostgreSQL schema, and minimal CRUD APIs for jobs and candidates so the frontend can read real data from PostgreSQL.

**Architecture:** The backend gains a conventional persistence stack with SQLAlchemy models, a shared engine/session module, Alembic-managed schema migrations, repository functions for ORM access, and thin FastAPI route modules. The frontend dashboard keeps its current visual shell and adds two data-driven sections that fetch real jobs and candidates from the backend.

**Tech Stack:** FastAPI, Python 3.11, SQLAlchemy 2.x, Alembic, PostgreSQL, Pydantic, Next.js 15, TypeScript, Docker Compose

---

## File Structure

### Backend persistence

- Modify: `backend/requirements.txt`
- Modify: `backend/app/core/config.py`
- Modify: `backend/app/main.py`
- Create: `backend/alembic.ini`
- Create: `backend/alembic/env.py`
- Create: `backend/alembic/versions/20260511_01_create_initial_tables.py`
- Create: `backend/app/db/base.py`
- Create: `backend/app/db/session.py`
- Create: `backend/app/models/__init__.py`
- Create: `backend/app/models/job.py`
- Create: `backend/app/models/candidate.py`
- Create: `backend/app/models/match_run.py`
- Create: `backend/app/schemas/job.py`
- Create: `backend/app/schemas/candidate.py`
- Create: `backend/app/repositories/job_repository.py`
- Create: `backend/app/repositories/candidate_repository.py`
- Create: `backend/app/api/job_routes.py`
- Create: `backend/app/api/candidate_routes.py`

### Frontend integration

- Modify: `frontend/lib/api.ts`
- Modify: `frontend/app/page.tsx`

### Documentation and tooling

- Modify: `README.md`
- Modify: `Makefile`

### Task 1: Add SQLAlchemy and Alembic Dependencies and Shared DB Configuration

**Files:**
- Modify: `backend/requirements.txt`
- Modify: `backend/app/core/config.py`
- Create: `backend/app/db/base.py`
- Create: `backend/app/db/session.py`

- [ ] **Step 1: Add persistence dependencies**

```text
fastapi==0.116.1
uvicorn[standard]==0.35.0
pydantic-settings==2.10.1
psycopg[binary]==3.2.9
neo4j==5.28.1
sqlalchemy==2.0.41
alembic==1.16.1
email-validator==2.2.0
```

- [ ] **Step 2: Extend application settings for SQLAlchemy**

```python
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "SkillGraph CV Matcher API"
    postgres_db: str
    postgres_user: str
    postgres_password: str
    postgres_host: str
    postgres_port: int
    neo4j_uri: str
    neo4j_username: str
    neo4j_password: str

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    @property
    def postgres_dsn(self) -> str:
        return (
            f"postgresql://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def sqlalchemy_database_url(self) -> str:
        return (
            f"postgresql+psycopg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

- [ ] **Step 3: Create the shared SQLAlchemy declarative base**

```python
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
```

- [ ] **Step 4: Create the SQLAlchemy engine and session factory**

```python
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings

settings = get_settings()

engine = create_engine(settings.sqlalchemy_database_url, future=True)
SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    class_=Session,
    future=True,
)


def get_db_session() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
```

- [ ] **Step 5: Verify dependency and DB foundation files**

Run: `sed -n '1,220p' backend/requirements.txt backend/app/core/config.py backend/app/db/base.py backend/app/db/session.py`
Expected: output shows SQLAlchemy and Alembic in dependencies, the new `sqlalchemy_database_url` setting, and a working engine/session module

- [ ] **Step 6: Commit the DB foundation**

```bash
git add backend/requirements.txt backend/app/core/config.py backend/app/db/base.py backend/app/db/session.py
git commit -m "feat: add SQLAlchemy database foundation"
```

### Task 2: Define ORM Models for Jobs, Candidates, and Match Runs

**Files:**
- Create: `backend/app/models/__init__.py`
- Create: `backend/app/models/job.py`
- Create: `backend/app/models/candidate.py`
- Create: `backend/app/models/match_run.py`

- [ ] **Step 1: Create the `Job` ORM model**

```python
from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text(), nullable=True)
    required_skills_text: Mapped[str | None] = mapped_column(Text(), nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="draft")
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
```

- [ ] **Step 2: Create the `Candidate` ORM model**

```python
from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Candidate(Base):
    __tablename__ = "candidates"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    resume_text: Mapped[str | None] = mapped_column(Text(), nullable=True)
    skills_text: Mapped[str | None] = mapped_column(Text(), nullable=True)
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
```

- [ ] **Step 3: Create the `MatchRun` ORM model**

```python
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class MatchRun(Base):
    __tablename__ = "match_runs"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="pending")
    summary: Mapped[str | None] = mapped_column(Text(), nullable=True)
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
```

- [ ] **Step 4: Export all models from the package**

```python
from app.models.candidate import Candidate
from app.models.job import Job
from app.models.match_run import MatchRun

__all__ = ["Job", "Candidate", "MatchRun"]
```

- [ ] **Step 5: Verify the ORM model files**

Run: `sed -n '1,240p' backend/app/models/job.py backend/app/models/candidate.py backend/app/models/match_run.py backend/app/models/__init__.py`
Expected: the three tables and their columns are defined exactly once with the expected defaults and timestamp fields

- [ ] **Step 6: Commit the ORM models**

```bash
git add backend/app/models
git commit -m "feat: define initial persistence models"
```

### Task 3: Configure Alembic and Create the Initial Migration

**Files:**
- Create: `backend/alembic.ini`
- Create: `backend/alembic/env.py`
- Create: `backend/alembic/versions/20260511_01_create_initial_tables.py`

- [ ] **Step 1: Create the Alembic configuration file**

```ini
[alembic]
script_location = alembic
prepend_sys_path = .

sqlalchemy.url = postgresql+psycopg://skillgraph_user:skillgraph_password@postgres:5432/skillgraph

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
```

- [ ] **Step 2: Create the Alembic environment loader**

```python
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.core.config import get_settings
from app.db.base import Base
from app.models import Candidate, Job, MatchRun

config = context.config
settings = get_settings()
config.set_main_option("sqlalchemy.url", settings.sqlalchemy_database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=settings.sqlalchemy_database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

- [ ] **Step 3: Create the first migration**

```python
from alembic import op
import sqlalchemy as sa


revision = "20260511_01"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "jobs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("required_skills_text", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="draft"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(op.f("ix_jobs_id"), "jobs", ["id"], unique=False)

    op.create_table(
        "candidates",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("resume_text", sa.Text(), nullable=True),
        sa.Column("skills_text", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="new"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(op.f("ix_candidates_id"), "candidates", ["id"], unique=False)

    op.create_table(
        "match_runs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("job_id", sa.Integer(), sa.ForeignKey("jobs.id"), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="pending"),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(op.f("ix_match_runs_id"), "match_runs", ["id"], unique=False)
    op.create_index(op.f("ix_match_runs_job_id"), "match_runs", ["job_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_match_runs_job_id"), table_name="match_runs")
    op.drop_index(op.f("ix_match_runs_id"), table_name="match_runs")
    op.drop_table("match_runs")
    op.drop_index(op.f("ix_candidates_id"), table_name="candidates")
    op.drop_table("candidates")
    op.drop_index(op.f("ix_jobs_id"), table_name="jobs")
    op.drop_table("jobs")
```

- [ ] **Step 4: Verify Alembic configuration files**

Run: `sed -n '1,260p' backend/alembic.ini backend/alembic/env.py backend/alembic/versions/20260511_01_create_initial_tables.py`
Expected: Alembic points at the backend project, loads metadata from models, and defines one migration that creates all three tables

- [ ] **Step 5: Commit the migration baseline**

```bash
git add backend/alembic.ini backend/alembic
git commit -m "feat: add initial Alembic migration"
```

### Task 4: Add Pydantic Schemas and Repository Functions for Jobs and Candidates

**Files:**
- Create: `backend/app/schemas/job.py`
- Create: `backend/app/schemas/candidate.py`
- Create: `backend/app/repositories/job_repository.py`
- Create: `backend/app/repositories/candidate_repository.py`

- [ ] **Step 1: Create job request and response schemas**

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

- [ ] **Step 2: Create candidate request and response schemas**

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

- [ ] **Step 3: Create the job repository**

```python
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.job import Job
from app.schemas.job import JobCreate


def list_jobs(session: Session) -> list[Job]:
    statement = select(Job).order_by(Job.created_at.desc())
    return list(session.scalars(statement).all())


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
```

- [ ] **Step 4: Create the candidate repository**

```python
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.candidate import Candidate
from app.schemas.candidate import CandidateCreate


def list_candidates(session: Session) -> list[Candidate]:
    statement = select(Candidate).order_by(Candidate.created_at.desc())
    return list(session.scalars(statement).all())


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
```

- [ ] **Step 5: Verify schemas and repositories**

Run: `sed -n '1,260p' backend/app/schemas/job.py backend/app/schemas/candidate.py backend/app/repositories/job_repository.py backend/app/repositories/candidate_repository.py`
Expected: request/response schemas match the approved API contract and repositories provide create/list operations

- [ ] **Step 6: Commit the schemas and repositories**

```bash
git add backend/app/schemas backend/app/repositories
git commit -m "feat: add persistence schemas and repositories"
```

### Task 5: Add FastAPI CRUD Routes and Wire Them Into the App

**Files:**
- Create: `backend/app/api/job_routes.py`
- Create: `backend/app/api/candidate_routes.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create job routes**

```python
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db.session import get_db_session
from app.repositories.job_repository import create_job, list_jobs
from app.schemas.job import JobCreate, JobRead

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.get("", response_model=list[JobRead])
def get_jobs(session: Session = Depends(get_db_session)) -> list[JobRead]:
    return list_jobs(session)


@router.post("", response_model=JobRead, status_code=status.HTTP_201_CREATED)
def post_job(payload: JobCreate, session: Session = Depends(get_db_session)) -> JobRead:
    return create_job(session, payload)
```

- [ ] **Step 2: Create candidate routes**

```python
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db.session import get_db_session
from app.repositories.candidate_repository import create_candidate, list_candidates
from app.schemas.candidate import CandidateCreate, CandidateRead

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
```

- [ ] **Step 3: Register the new route modules in the FastAPI app**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.candidate_routes import router as candidate_router
from app.api.job_routes import router as job_router
from app.api.routes import router as core_router
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(core_router)
app.include_router(job_router)
app.include_router(candidate_router)
```

- [ ] **Step 4: Verify API route files**

Run: `sed -n '1,240p' backend/app/api/job_routes.py backend/app/api/candidate_routes.py backend/app/main.py`
Expected: the app includes list/create routes for jobs and candidates and registers both routers

- [ ] **Step 5: Commit the CRUD API**

```bash
git add backend/app/api backend/app/main.py
git commit -m "feat: add jobs and candidates CRUD routes"
```

### Task 6: Update Docker and Makefile Workflow for Migrations

**Files:**
- Modify: `Makefile`
- Modify: `README.md`

- [ ] **Step 1: Add migration helpers to the Makefile**

```make
COMPOSE := docker compose
BACKUP_DIR ?= backups/postgres
TIMESTAMP ?= $(shell date +%Y%m%d-%H%M%S)
BACKUP_FILE ?= $(BACKUP_DIR)/$(POSTGRES_DB)-$(TIMESTAMP).dump

-include .env

.PHONY: up down build restart logs ps backup-db restore migrate

up:
	$(COMPOSE) up --build -d

down:
	$(COMPOSE) down

build:
	$(COMPOSE) build

restart: down up

logs:
	$(COMPOSE) logs -f

ps:
	$(COMPOSE) ps

backup-db:
	mkdir -p $(BACKUP_DIR)
	$(COMPOSE) exec -T postgres pg_dump -U $(POSTGRES_USER) -d $(POSTGRES_DB) -Fc > $(BACKUP_FILE)
	@echo "Backup created: $(BACKUP_FILE)"

restore:
	test -n "$(BACKUP_FILE)"
	test -f "$(BACKUP_FILE)"
	cat "$(BACKUP_FILE)" | $(COMPOSE) exec -T postgres pg_restore -U $(POSTGRES_USER) -d $(POSTGRES_DB) --clean --if-exists --no-owner --no-privileges
	@echo "Restore completed from: $(BACKUP_FILE)"

migrate:
	$(COMPOSE) exec -T backend alembic upgrade head
```

- [ ] **Step 2: Document the migration command in the README**

````md
## Database Migration

Run the latest schema migration:

```bash
make migrate
```

Apply this after the Docker stack is running and before testing CRUD endpoints for a fresh database.
````

- [ ] **Step 3: Verify Makefile and README updates**

Run: `sed -n '1,260p' Makefile README.md`
Expected: the Makefile includes `migrate`, and the README documents when to run it

- [ ] **Step 4: Commit the migration workflow docs**

```bash
git add Makefile README.md
git commit -m "docs: add migration workflow"
```

### Task 7: Update Frontend API Helpers and Dashboard Sections for Jobs and Candidates

**Files:**
- Modify: `frontend/lib/api.ts`
- Modify: `frontend/app/page.tsx`

- [ ] **Step 1: Extend the frontend API helper**

```ts
import { serverEnv } from "@/lib/env";

export type ConnectionResponse = {
  status: string;
  services: {
    postgres: { status: string; message: string };
    neo4j: { status: string; message: string };
  };
};

export type Job = {
  id: number;
  title: string;
  description: string | null;
  required_skills_text: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type Candidate = {
  id: number;
  full_name: string;
  email: string | null;
  resume_text: string | null;
  skills_text: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export async function getConnections(): Promise<ConnectionResponse | null> {
  try {
    const response = await fetch(`${serverEnv.apiBaseUrl}/api/connections`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as ConnectionResponse;
  } catch {
    return null;
  }
}

export async function getJobs(): Promise<Job[]> {
  try {
    const response = await fetch(`${serverEnv.apiBaseUrl}/api/jobs`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return [];
    }

    return (await response.json()) as Job[];
  } catch {
    return [];
  }
}

export async function getCandidates(): Promise<Candidate[]> {
  try {
    const response = await fetch(`${serverEnv.apiBaseUrl}/api/candidates`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return [];
    }

    return (await response.json()) as Candidate[];
  } catch {
    return [];
  }
}
```

- [ ] **Step 2: Update the dashboard page to render live data**

```tsx
import { Hero } from "@/components/hero";
import { SectionShell } from "@/components/section-shell";
import { StatusCard } from "@/components/status-card";
import { getCandidates, getConnections, getJobs } from "@/lib/api";

const fallbackServices = {
  postgres: {
    status: "unknown",
    message: "Backend status not available yet.",
  },
  neo4j: {
    status: "unknown",
    message: "Backend status not available yet.",
  },
};

export default async function Home() {
  const [connections, jobs, candidates] = await Promise.all([
    getConnections(),
    getJobs(),
    getCandidates(),
  ]);

  const services = connections?.services ?? fallbackServices;

  return (
    <main className="mx-auto max-w-7xl px-6 py-8 md:px-10 md:py-10">
      <Hero
        eyebrow="Explainable Matching"
        title="SkillGraph CV Matcher for transparent HR screening"
        description="A Docker-first scaffold for CV analysis, graph-aware skill matching, and explainable ranking. This milestone adds PostgreSQL-backed persistence and live dashboard data."
      />

      <SectionShell title="Runtime Status">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <StatusCard label="Frontend" status="ok" message="Next.js dashboard is rendering." />
          <StatusCard label="Backend" status={connections ? "ok" : "unknown"} message={connections ? "FastAPI connection endpoint responded." : "Waiting for backend connection response."} />
          <StatusCard label="PostgreSQL" status={services.postgres.status} message={services.postgres.message} />
          <StatusCard label="Neo4j" status={services.neo4j.status} message={services.neo4j.message} />
        </div>
      </SectionShell>

      <SectionShell title="Recent Jobs">
        <div className="grid gap-5 md:grid-cols-2">
          {jobs.length === 0 ? (
            <article className="rounded-[20px] border border-[var(--color-border)] bg-white p-6 shadow-micro">
              <h3 className="text-lg font-semibold">No jobs yet</h3>
              <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
                Create job records through Swagger at /docs to see real data here.
              </p>
            </article>
          ) : (
            jobs.map((job) => (
              <article key={job.id} className="rounded-[20px] border border-[var(--color-border)] bg-white p-6 shadow-micro">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-brand-dark)]">
                  {job.status}
                </p>
                <h3 className="mt-3 text-lg font-semibold">{job.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
                  {job.description ?? "No description provided."}
                </p>
              </article>
            ))
          )}
        </div>
      </SectionShell>

      <SectionShell title="Recent Candidates">
        <div className="grid gap-5 md:grid-cols-2">
          {candidates.length === 0 ? (
            <article className="rounded-[20px] border border-[var(--color-border)] bg-white p-6 shadow-micro">
              <h3 className="text-lg font-semibold">No candidates yet</h3>
              <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
                Create candidate records through Swagger at /docs to see real data here.
              </p>
            </article>
          ) : (
            candidates.map((candidate) => (
              <article key={candidate.id} className="rounded-[20px] border border-[var(--color-border)] bg-white p-6 shadow-micro">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-brand-dark)]">
                  {candidate.status}
                </p>
                <h3 className="mt-3 text-lg font-semibold">{candidate.full_name}</h3>
                <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
                  {candidate.email ?? "Email not provided"}
                </p>
              </article>
            ))
          )}
        </div>
      </SectionShell>
    </main>
  );
}
```

- [ ] **Step 3: Verify the frontend integration files**

Run: `sed -n '1,320p' frontend/lib/api.ts frontend/app/page.tsx`
Expected: the API helper exports job and candidate fetchers, and the dashboard renders real list data or empty states

- [ ] **Step 4: Commit the frontend persistence integration**

```bash
git add frontend/lib/api.ts frontend/app/page.tsx
git commit -m "feat: show persisted jobs and candidates on dashboard"
```

### Task 8: Run End-to-End Migration and CRUD Verification

**Files:**
- Verify: running Docker services
- Verify: PostgreSQL schema and API responses

- [ ] **Step 1: Build and start the stack**

Run: `make up`
Expected: frontend, backend, PostgreSQL, and Neo4j are running without immediate crash loops

- [ ] **Step 2: Apply the initial migration**

Run: `make migrate`
Expected: Alembic upgrades the database to revision `20260511_01` without errors

- [ ] **Step 3: Verify empty jobs list**

Run: `curl -s http://localhost:8000/api/jobs`
Expected:

```json
[]
```

- [ ] **Step 4: Create a job record**

Run: `curl -s -X POST http://localhost:8000/api/jobs -H 'Content-Type: application/json' -d '{"title":"Frontend Developer","description":"Build HR-facing dashboard screens","required_skills_text":"Next.js, TypeScript, PostgreSQL","status":"draft"}'`
Expected: JSON object containing a numeric `id`, the submitted fields, and timestamps

- [ ] **Step 5: Verify empty candidates list**

Run: `curl -s http://localhost:8000/api/candidates`
Expected:

```json
[]
```

- [ ] **Step 6: Create a candidate record**

Run: `curl -s -X POST http://localhost:8000/api/candidates -H 'Content-Type: application/json' -d '{"full_name":"Nguyen Van A","email":"nguyenvana@example.com","resume_text":"Built internal dashboards with React and REST APIs.","skills_text":"React, REST API, SQL","status":"new"}'`
Expected: JSON object containing a numeric `id`, the submitted fields, and timestamps

- [ ] **Step 7: Verify list endpoints return persisted data**

Run: `curl -s http://localhost:8000/api/jobs && curl -s http://localhost:8000/api/candidates`
Expected: each endpoint returns an array containing the newly created record

- [ ] **Step 8: Verify the frontend reflects persisted records**

Run: `curl -I http://localhost:3000`
Expected: an HTTP `200` or redirect response showing the frontend is serving successfully

Run: `curl -s http://localhost:3000 | rg 'Frontend Developer|Nguyen Van A'`
Expected: HTML output contains at least one of the newly created job or candidate labels

- [ ] **Step 9: Verify backup still works with real data**

Run: `make backup-db`
Expected: a timestamped dump file is created under `backups/postgres/`

- [ ] **Step 10: Commit final persistence adjustments**

```bash
git add .
git commit -m "feat: add PostgreSQL-backed persistence layer"
```
