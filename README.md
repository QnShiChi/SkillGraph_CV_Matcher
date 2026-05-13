# SkillGraph CV Matcher

Initial scaffold for a Docker-based CV matching platform with:

- Next.js frontend
- FastAPI backend
- PostgreSQL
- Neo4j
- AgentScope-ready screening/ranking workflow seam

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
- text-layer extraction for text-selectable PDFs only
- backend section preprocessing
- `OpenRouter` with a configurable OpenAI model
- local taxonomy post-processing for graph-ready skill normalization

Set the following in `.env` to enable it:

```env
OPENROUTER_API_KEY=your-key
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=openai/gpt-5.4-mini
JD_PARSER_MODE=hybrid
JD_PARSER_TEMPERATURE=0.1
JD_PARSER_MAX_OUTPUT_TOKENS=12000
JD_PARSER_TIMEOUT_SECONDS=90
JD_PARSER_ENABLE_FALLBACK=true
```

Notes:

- `JD_PARSER_MODE=rule_based` keeps the previous local parser only
- `JD_PARSER_MODE=hybrid` uses OpenRouter first, then falls back to rule-based parsing if enabled
- scanned or image-only PDFs are rejected early to keep imports fast and predictable
- imported jobs expose `extract_source` as `text_layer`
- imported jobs now include `parse_source` and `parse_confidence`
- imported jobs now also include `graph_sync_status`, `graph_sync_error`, and `graph_synced_at`
- the job workspace shows parser provenance so you can tell whether the output came from `llm_hybrid` or `rule_based_fallback`
- future imports classify extracted signals into grouped categories such as `technical_skills`, `platforms_cloud`, `tooling_devops`, `competencies`, and `soft_skills`
- after a successful import, graph-safe categories are projected automatically into Neo4j as `Job`, `Skill`, and `REQUIRES` relationships
- core AI/ML taxonomy is covered for future imports, including prerequisite enrichment for skills such as `machine_learning`, `deep_learning`, `transformer`, `bert`, `ocr`, and `mlops`

## OpenRouter Hybrid CV Parsing

The CV import pipeline now supports a hybrid parser that combines:

- `PyMuPDF` text extraction
- text-layer extraction for text-selectable PDFs only
- backend section preprocessing
- `OpenRouter` with a configurable OpenAI model
- local taxonomy post-processing for canonical skill mapping and graph projection

Set the following in `.env` to enable it:

```env
OPENROUTER_API_KEY=your-key
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=openai/gpt-5.4-mini
CV_PARSER_MODE=hybrid
CV_PARSER_TEMPERATURE=0.1
CV_PARSER_MAX_OUTPUT_TOKENS=12000
CV_PARSER_TIMEOUT_SECONDS=90
CV_PARSER_ENABLE_FALLBACK=true
```

Notes:

- `CV_PARSER_MODE=rule_based` keeps the previous local parser only
- `CV_PARSER_MODE=hybrid` uses OpenRouter first, then falls back to `rule_based_fallback` if enabled
- scanned or image-only CV PDFs are rejected early to keep batch imports fast and predictable
- imported candidates and batch results expose `extract_source` as `text_layer`
- imported candidates keep `parse_source`, `parse_confidence`, `graph_sync_status`, `graph_sync_error`, and `graph_synced_at`
- candidate parsing remains evidence-aware, so each extracted skill keeps supporting snippets when available
- candidate graph projection continues to reuse the same canonical skill taxonomy as JD imports

## Verification Checklist

- Frontend loads at `http://localhost:3000`
- Swagger loads at `http://localhost:8000/docs`
- `GET /api/connections` shows PostgreSQL and Neo4j status
- DBeaver connects to PostgreSQL successfully

## JD Import Workflow

1. Start the stack with `make up`
2. Run migrations with `make migrate`
3. Open `http://localhost:3000/admin/jobs`
4. Use `Import JD PDF` to upload a text-based JD PDF with selectable text
5. Open the generated job with `Open Workspace`
6. Check `Graph synced` status in the admin card or workspace metadata
7. Inspect Neo4j Browser at `http://localhost:7474` if you want to verify graph projection

## CV Import Workflow

1. Start the stack with `make up`
2. Run migrations with `make migrate`
3. Open `http://localhost:3000/admin/jobs`
4. Choose a job and open its workspace at `/jobs/[jobId]`
5. Use `Import CV PDF` to upload one or more CV PDFs in a batch
6. Review the batch result summary for:
   - total files
   - success count
   - failed count
   - per-file extract source / parse source / graph sync state / error text
7. Review the imported candidate cards for:
   - grouped skills
   - evidence sample
   - extract source / parse source / confidence
   - graph sync status
8. Inspect Neo4j Browser at `http://localhost:7474` if you want to verify both:
   - `(:Candidate)-[:HAS_SKILL]->(:Skill)`
   - `(:Job)-[:HAS_CANDIDATE]->(:Candidate)`

Current limitations:

- only text-selectable PDFs are supported for CV and JD import
- scanned or image-only PDFs are rejected instead of running OCR to keep import latency low
- production build verification should be run in an isolated container or image, not inside the mounted dev container sharing `.next`
- candidates are currently owned by one job workspace and are not reused across multiple jobs
- screening and ranking currently run through a deterministic-first workflow
- AgentScope is wired as an optional seam for future Verifier/Matcher/Explainer/Critic orchestration, but the live demo path still uses deterministic verification and scoring for speed

## Screening And Ranking Workflow

1. Open a job workspace at `/jobs/[jobId]`
2. Import one or more text-selectable CV PDFs
3. Click `Run Screening & Ranking`
4. The backend applies the demo policy:
   - missing project/GitHub/portfolio link => reject
   - unreachable project link => reject
   - reachable project evidence => pass to ranking
5. Verified candidates are ranked by:
   - must-have coverage
   - verified project evidence
   - technical overlap
   - experience signal
   - evidence density
6. The workspace shows:
   - ranked candidates
   - rejected candidates
   - verification summary
   - match summary

### Optional AgentScope Review Layer

Set the following in `.env` if you want verified candidates to pass through the
AgentScope `Matcher -> Explainer -> Critic` review layer after deterministic
verification and scoring:

```env
MATCHING_REVIEW_MODE=agentscope
MATCHING_REVIEW_TIMEOUT_SECONDS=60
OPENROUTER_API_KEY=your-key
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=openai/gpt-5.4-mini
```

Notes:

- deterministic verification and ranking remain the source of truth
- AgentScope currently enriches the HR-facing summary after a candidate passes verification
- if AgentScope is enabled but the package or model credentials are unavailable, `POST /api/jobs/{jobId}/screen-and-rank` returns a clear `503`

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
