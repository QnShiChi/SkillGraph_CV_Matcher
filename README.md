# SkillGraph CV Matcher

Initial scaffold for a Docker-based CV matching platform with:

- Next.js frontend
- FastAPI backend
- PostgreSQL
- Neo4j

## Prerequisites

- Docker
- Docker Compose
- DBeaver (optional, for PostgreSQL inspection)

## Setup

1. Copy the environment file:

```bash
cp .env.example .env
```

2. Start the stack:

```bash
make up
```

3. Stop the stack:

```bash
make down
```

## Database Migration

Run the latest schema migration:

```bash
make migrate
```

Apply this after the Docker stack is running and before testing CRUD endpoints for a fresh database.

## PostgreSQL Backup and Restore

Create a versioned backup:

```bash
make backup-db
```

This writes a dump file to `backups/postgres/` using a timestamped filename.

Restore a specific backup version:

```bash
make restore BACKUP_FILE=backups/postgres/skillgraph-20260511-153000.dump
```

Notes:

- `make backup-db` and `make restore` expect the PostgreSQL container to be running
- `make restore` restores into the current `POSTGRES_DB` configured in `.env`
- choose the backup version by passing `BACKUP_FILE=...`

## Local URLs

- Frontend: `http://localhost:3000`
- Backend Swagger: `http://localhost:8000/docs`
- Backend health: `http://localhost:8000/health`
- Backend connections: `http://localhost:8000/api/connections`
- Neo4j Browser: `http://localhost:7474`

## DBeaver PostgreSQL Connection

Use these values:

- Host: `localhost`
- Port: `5432`
- Database: value of `POSTGRES_DB` in `.env`
- Username: value of `POSTGRES_USER` in `.env`
- Password: value of `POSTGRES_PASSWORD` in `.env`

DBeaver connects directly to the PostgreSQL container through the mapped host port.

## Environment Notes

- `NEXT_PUBLIC_API_BASE_URL` is the browser-facing backend URL
- `INTERNAL_API_BASE_URL` is the Docker-internal backend URL used by the Next.js server runtime

## OpenRouter Hybrid JD Parsing

The JD import pipeline supports a hybrid parser that combines:

- `PyMuPDF` text extraction
- backend section preprocessing
- `OpenRouter` with a configurable OpenAI model
- local taxonomy post-processing for graph-ready skill normalization

Set the following in `.env` to enable it:

```env
OPENROUTER_API_KEY=your-key
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=openai/gpt-5.5
JD_PARSER_MODE=hybrid
JD_PARSER_TEMPERATURE=0.1
JD_PARSER_MAX_OUTPUT_TOKENS=12000
JD_PARSER_TIMEOUT_SECONDS=90
JD_PARSER_ENABLE_FALLBACK=true
```

Notes:

- `JD_PARSER_MODE=rule_based` keeps the previous local parser only
- `JD_PARSER_MODE=hybrid` uses OpenRouter first, then falls back to rule-based parsing if enabled
- imported jobs now include `parse_source` and `parse_confidence`
- the job workspace shows parser provenance so you can tell whether the output came from `llm_hybrid` or `rule_based_fallback`
- future imports classify extracted signals into grouped categories such as `technical_skills`, `platforms_cloud`, `tooling_devops`, `competencies`, and `soft_skills`

## Verification Checklist

- Frontend loads at `http://localhost:3000`
- Swagger loads at `http://localhost:8000/docs`
- `GET /api/connections` shows PostgreSQL and Neo4j status
- DBeaver connects to PostgreSQL successfully

## JD Import Workflow

1. Start the stack with `make up`
2. Run migrations with `make migrate`
3. Open `http://localhost:3000/admin/jobs`
4. Use `Import JD PDF` to upload a text-based JD PDF
5. Open the generated job with `Open Workspace`

Current limitations:

- only text-based PDFs are supported
- scanned PDFs are rejected
- production build verification should be run in an isolated container or image, not inside the mounted dev container sharing `.next`
- CV upload and matching are not implemented yet

## Make Targets

- `make up`: build and start frontend, backend, PostgreSQL, and Neo4j
- `make down`: stop and remove all running services in the project
- `make build`: build service images
- `make restart`: restart the full stack
- `make logs`: tail Docker Compose logs
- `make ps`: show service status
- `make backup-db`: create a timestamped PostgreSQL dump in `backups/postgres/`
- `make restore BACKUP_FILE=...`: restore PostgreSQL from a chosen dump file
- `make migrate`: apply the latest Alembic migration to PostgreSQL
