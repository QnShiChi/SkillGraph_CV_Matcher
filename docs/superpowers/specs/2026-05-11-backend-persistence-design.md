# Backend Persistence Design

## Goal

Add real PostgreSQL-backed persistence to the existing FastAPI backend so the project moves beyond connectivity-only scaffolding.

This phase introduces:

- SQLAlchemy as the ORM layer
- Alembic as the schema migration tool
- initial PostgreSQL tables for `jobs`, `candidates`, and `match_runs`
- minimal CRUD API for `jobs` and `candidates`
- frontend dashboard updates so it reads real database-backed lists instead of only showing runtime status

The outcome should be a backend that can create, store, and retrieve real records from PostgreSQL while preserving the current Docker-based local workflow.

## Scope

This design includes:

- SQLAlchemy integration
- Alembic setup
- initial schema migration
- model definitions for `jobs`, `candidates`, and `match_runs`
- repository and session management for PostgreSQL
- `GET` and `POST` endpoints for `jobs`
- `GET` and `POST` endpoints for `candidates`
- minimal frontend data display for jobs and candidates
- verification that migrations, CRUD, and backup/restore still work

This design does not include:

- file upload for CV or JD
- parsing or extraction logic
- Neo4j persistence changes
- matching execution logic
- candidate ranking tables
- frontend create forms
- pagination, filtering, or search
- authentication or authorization

## Architecture

The backend will gain a conventional persistence stack:

- SQLAlchemy models define the relational schema
- Alembic manages versioned schema changes
- a central SQLAlchemy session factory manages database access
- repositories isolate direct ORM queries from route handlers
- Pydantic request/response schemas define external API contracts

The route layer stays thin. Routes validate input, open a session through dependency injection, and delegate DB actions to repository functions.

The existing PostgreSQL connectivity check remains in place for operational visibility, but application data access moves to SQLAlchemy.

## Backend File Structure

The persistence work adds these files under `backend/`:

```text
backend/
├── alembic.ini
├── alembic/
│   ├── env.py
│   └── versions/
│       └── <timestamp>_create_initial_tables.py
└── app/
    ├── db/
    │   ├── base.py
    │   └── session.py
    ├── models/
    │   ├── __init__.py
    │   ├── job.py
    │   ├── candidate.py
    │   └── match_run.py
    ├── schemas/
    │   ├── job.py
    │   └── candidate.py
    ├── repositories/
    │   ├── job_repository.py
    │   └── candidate_repository.py
    └── api/
        ├── job_routes.py
        └── candidate_routes.py
```

Responsibilities:

- `db/base.py`: shared SQLAlchemy declarative base
- `db/session.py`: engine and session factory
- `models/`: ORM table mappings
- `schemas/`: request and response models
- `repositories/`: persistence operations
- `api/`: route modules
- `alembic/`: migration runtime and version history

This structure keeps the code ready for a future service layer when matching logic becomes real.

## Data Model

### `jobs`

Purpose: store job descriptions or job posting records at MVP level.

Fields:

- `id`
- `title`
- `description`
- `required_skills_text`
- `status`
- `created_at`
- `updated_at`

Notes:

- `required_skills_text` remains plain text in this phase
- `status` is constrained to a small allowed set such as `draft`, `analyzed`, `archived`
- `title` is required

### `candidates`

Purpose: store candidate/CV records at metadata level.

Fields:

- `id`
- `full_name`
- `email`
- `resume_text`
- `skills_text`
- `status`
- `created_at`
- `updated_at`

Notes:

- `email` is optional in this phase so raw CV ingestion is not blocked
- `resume_text` stores raw or lightly normalized extracted text
- `skills_text` stores temporary normalized skill text
- `status` is constrained to a small allowed set such as `new`, `reviewed`, `matched`
- `full_name` is required

### `match_runs`

Purpose: reserve relational structure for future matching executions.

Fields:

- `id`
- `job_id`
- `status`
- `summary`
- `created_at`
- `updated_at`

Notes:

- `job_id` is a foreign key to `jobs.id`
- `summary` remains simple text in this phase
- no API is required yet for `match_runs`
- this table exists now to avoid a later schema jump when matching begins

## Migration Strategy

Alembic will be the single source of truth for schema versioning.

The first migration should:

- create `jobs`
- create `candidates`
- create `match_runs`
- define primary keys
- define the foreign key from `match_runs.job_id` to `jobs.id`
- define timestamps and defaults where appropriate

The migration should be runnable from a clean database and should become the baseline for later schema evolution.

The project should not rely on manual DBeaver table creation. Schema changes must flow through Alembic migration files.

## Session and Repository Design

The backend should create one SQLAlchemy engine for PostgreSQL and expose session instances through a dependency pattern suitable for FastAPI routes.

Repositories should:

- accept a SQLAlchemy session
- perform one bounded set of DB operations
- return ORM objects or simple values

Initial repository capabilities:

- create job
- list jobs ordered by `created_at desc`
- create candidate
- list candidates ordered by `created_at desc`

This keeps route handlers thin and prepares the codebase for future service orchestration.

## API Contract

### `GET /api/jobs`

Behavior:

- returns jobs ordered newest first
- returns `[]` when the table is empty

Response fields per item:

- `id`
- `title`
- `description`
- `required_skills_text`
- `status`
- `created_at`
- `updated_at`

### `POST /api/jobs`

Request body:

- `title`
- `description`
- `required_skills_text`
- `status` optional

Validation:

- `title` is required
- `status`, if provided, must be in the allowed set

Response:

- the created job record

### `GET /api/candidates`

Behavior:

- returns candidates ordered newest first
- returns `[]` when the table is empty

Response fields per item:

- `id`
- `full_name`
- `email`
- `resume_text`
- `skills_text`
- `status`
- `created_at`
- `updated_at`

### `POST /api/candidates`

Request body:

- `full_name`
- `email`
- `resume_text`
- `skills_text`
- `status` optional

Validation:

- `full_name` is required
- `email` may be omitted or null
- `status`, if provided, must be in the allowed set

Response:

- the created candidate record

## Frontend Changes

The frontend should remain visually aligned with `DESIGN.md` and avoid a redesign.

This phase adds two data-driven sections to the existing dashboard:

- a list of recent jobs
- a list of recent candidates

The frontend will fetch:

- `GET /api/jobs`
- `GET /api/candidates`

The frontend does not need create forms in this phase because record creation can be verified through Swagger or direct API calls.

The UI objective is to prove that real database-backed data now flows from backend to frontend.

## Error Handling

### Backend

- invalid request payloads should return FastAPI validation errors
- database session lifecycle must close cleanly
- empty tables should return empty arrays, not error states
- route behavior should remain predictable if the database is reachable but contains no records

### Frontend

- if jobs or candidates cannot be fetched, the page should show controlled fallback text
- if the lists are empty, the dashboard should render empty-state messaging rather than blank sections

## Verification Requirements

The persistence milestone is complete only if all of the following are true:

1. Alembic migration runs successfully against PostgreSQL
2. `GET /api/jobs` returns `[]` on an empty database
3. `POST /api/jobs` creates a persisted record
4. `GET /api/candidates` returns `[]` on an empty database
5. `POST /api/candidates` creates a persisted record
6. frontend renders jobs and candidates retrieved from PostgreSQL
7. PostgreSQL backup and restore remain usable after real data exists

## Testing and Verification Strategy

The core verification for this phase is operational and API-level:

- run Alembic migration
- hit CRUD endpoints through Swagger or `curl`
- inspect records through API responses and optionally DBeaver
- verify frontend reflects the stored data
- run backup/restore against a database containing records

This phase does not require a full automated test suite yet, but the implementation should remain structured so tests can be added cleanly in the next cycle.

## Design Decisions

### Decision: keep text-heavy schema first

The schema intentionally uses text fields for skills, resume text, and summaries rather than deeper JSON structures. This keeps the first persistence milestone small, understandable, and easy to migrate later when parsing and matching become more concrete.

### Decision: expose CRUD only for jobs and candidates

`match_runs` is included in the schema but not exposed as a public CRUD API yet. This preserves forward structure without forcing placeholder matching behavior into the API surface.

### Decision: no frontend create forms yet

The frontend only needs to prove read-path integration in this phase. Write-path verification can happen through Swagger, which avoids prematurely building UI flows that may change once upload and parsing requirements are introduced.

## Risks

### Risk: schema evolution after real parsing starts

`required_skills_text`, `skills_text`, and `summary` may need redesign once structured extraction becomes real. This is acceptable because the current design optimizes for fast stabilization of persistence rather than final domain shape.

### Risk: migration and container startup coordination

The stack currently relies on Docker-managed PostgreSQL startup. The implementation must ensure migrations run in a deliberate workflow rather than assuming the schema already exists when the backend boots.
