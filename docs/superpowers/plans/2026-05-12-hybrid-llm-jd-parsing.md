# Hybrid LLM JD Parsing and Provenance UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade JD PDF import from rule-based parsing to hybrid OpenRouter-backed LLM parsing with taxonomy post-processing, fallback behavior, and visible parse provenance in the job workspace.

**Architecture:** The backend will add OpenRouter configuration and a hybrid parsing service that keeps `PyMuPDF` extraction and rule-based preprocessing, then calls an OpenAI model through OpenRouter for structured extraction. The model output will be validated, canonicalized through the local taxonomy, and persisted along with `parse_source` and `parse_confidence`. The frontend will expose the new provenance metadata in the jobs admin cards and the job workspace.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, PyMuPDF, OpenRouter OpenAI-compatible API, PostgreSQL JSONB, Next.js 15 App Router, TypeScript, Tailwind CSS

---

## File Structure

### Backend configuration and dependencies
- Modify: `backend/requirements.txt`
- Modify: `backend/app/core/config.py`
- Modify: `.env.example`
- Modify: `README.md`

### Backend schema and persistence
- Modify: `backend/app/models/job.py`
- Modify: `backend/app/models/__init__.py`
- Modify: `backend/app/schemas/job.py`
- Modify: `backend/app/repositories/job_repository.py`
- Create: `backend/alembic/versions/20260512_02_add_parse_provenance_to_jobs.py`

### Backend LLM parsing services
- Create: `backend/app/services/openrouter_client.py`
- Create: `backend/app/services/jd_llm_schema.py`
- Modify: `backend/app/services/jd_parser.py`
- Modify: `backend/app/services/job_import_service.py`

### Backend tests
- Modify: `backend/requirements-dev.txt`
- Create: `backend/tests/services/test_job_import_service.py`
- Create: `backend/tests/services/test_openrouter_client.py`
- Modify: `backend/tests/api/test_job_import_api.py`

### Frontend provenance UI
- Modify: `frontend/lib/api.ts`
- Modify: `frontend/components/jobs/job-list.tsx`
- Modify: `frontend/components/jobs/job-structured-data.tsx`
- Modify: `frontend/components/jobs/job-workspace.tsx`

---

## Task 1: Add Config and Persistence for Parse Provenance

**Files:**
- Modify: `backend/app/core/config.py`
- Modify: `.env.example`
- Modify: `backend/app/models/job.py`
- Modify: `backend/app/schemas/job.py`
- Modify: `backend/app/repositories/job_repository.py`
- Create: `backend/alembic/versions/20260512_02_add_parse_provenance_to_jobs.py`

- [ ] **Step 1: Add OpenRouter and parser settings to backend config**

Add typed settings for:
- `openrouter_api_key`
- `openrouter_base_url`
- `openrouter_model`
- `jd_parser_mode`
- `jd_parser_temperature`
- `jd_parser_max_output_tokens`
- `jd_parser_timeout_seconds`
- `jd_parser_enable_fallback`

Use safe defaults for all non-secret values.

- [ ] **Step 2: Extend `.env.example`**

Document new variables:
```env
OPENROUTER_API_KEY=
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=openai/gpt-5.5
JD_PARSER_MODE=hybrid
JD_PARSER_TEMPERATURE=0.1
JD_PARSER_MAX_OUTPUT_TOKENS=12000
JD_PARSER_TIMEOUT_SECONDS=90
JD_PARSER_ENABLE_FALLBACK=true
```

- [ ] **Step 3: Extend the `jobs` model and API schema**

Add to `Job`:
- `parse_source`
- `parse_confidence`

Add to `JobRead`:
- `parse_source`
- `parse_confidence`

Use pragmatic types:
- `parse_source: str`
- `parse_confidence: float | None`

- [ ] **Step 4: Update repository create paths**

Ensure manual jobs set:
- `parse_source="manual"`
- `parse_confidence=None`

Update imported job creation to accept provenance fields.

- [ ] **Step 5: Write and apply migration**

Migration should add:
- `parse_source` as non-null string with default for existing rows
- `parse_confidence` as nullable float

Recommended backfill:
- existing manual jobs -> `parse_source='manual'`
- existing imported jobs -> `parse_source='rule_based'` if needed

- [ ] **Step 6: Verify migration**

Run:
- `python3 -m compileall backend/app`
- `make migrate`

Expected:
- migration applies cleanly
- existing `jobs` rows remain readable

---

## Task 2: Add OpenRouter Client and Hybrid Parser Core

**Files:**
- Create: `backend/app/services/openrouter_client.py`
- Create: `backend/app/services/jd_llm_schema.py`
- Modify: `backend/app/services/jd_parser.py`

- [ ] **Step 1: Add minimal OpenRouter HTTP client**

Implement a small service wrapper using `httpx` or `requests`-style async/sync logic already compatible with backend style.

Responsibilities:
- build OpenAI-compatible request payload
- send bearer-authenticated request to OpenRouter
- return parsed response text
- raise clear exceptions on timeout / non-200 / malformed payload

- [ ] **Step 2: Define strict Pydantic schema for LLM output**

Create schema models for the expected structured parse before taxonomy enrichment.

At minimum include:
- `title`
- `summary`
- `required_skills`
- `responsibilities`
- `qualifications`
- `soft_skills`
- `language_requirements`
- `experience_years`
- optional `parser_confidence`

- [ ] **Step 3: Add prompt-building function**

Inside `jd_parser.py`, add helper(s) to build a strict JSON-only prompt using:
- raw JD text
- rule-based section hints
- explicit schema instructions
- anti-hallucination constraints

- [ ] **Step 4: Add LLM parse path with validation and one retry**

Implement flow:
1. preprocess raw text
2. call OpenRouter
3. parse JSON
4. validate via Pydantic
5. if invalid, retry once with repair prompt
6. if still invalid, raise controlled parser exception

- [ ] **Step 5: Taxonomy post-process the validated LLM output**

Use the existing taxonomy as the authoritative enrichment layer.

Produce final graph-ready structure with:
- canonical skill names
- prerequisites
- related skills
- skill groups
- specializations
- normalized `importance`
- normalized `requirement_type`

- [ ] **Step 6: Compute job-level parse confidence locally**

Add a deterministic helper that derives `parse_confidence` from:
- schema completeness
- number of canonicalized skills
- section coverage
- optional LLM self-confidence signal

Bound result to `0.0..1.0`.

---

## Task 3: Wire Hybrid Parser into JD Import with Fallback

**Files:**
- Modify: `backend/app/services/job_import_service.py`
- Modify: `backend/app/services/jd_parser.py`
- Modify: `backend/app/api/job_routes.py`

- [ ] **Step 1: Route parsing mode through import service**

In `job_import_service.py`, select parser behavior based on config:
- `rule_based`
- `hybrid`
- optionally `llm_only` as a guarded path

For this phase, `hybrid` should be the default target path.

- [ ] **Step 2: Implement fallback behavior**

In `hybrid` mode:
- on OpenRouter timeout/error/invalid schema:
  - if fallback enabled, use current rule-based parser
  - mark `parse_source='rule_based_fallback'`
  - compute fallback confidence heuristically
- otherwise raise a user-facing import error

- [ ] **Step 3: Preserve the current API contract**

Keep `POST /api/jobs/import` unchanged for frontend callers.

Return payload now includes:
- `parse_source`
- `parse_confidence`

- [ ] **Step 4: Verify API behavior manually**

Run:
- import a text-based PDF with parser mode `hybrid`
- import again with intentionally broken/mocked LLM path if possible

Expected:
- success path returns `parse_source=llm_hybrid`
- fallback path returns `parse_source=rule_based_fallback`

---

## Task 4: Add Tests for LLM Path, Fallback, and API Responses

**Files:**
- Modify: `backend/requirements-dev.txt`
- Create: `backend/tests/services/test_openrouter_client.py`
- Create: `backend/tests/services/test_job_import_service.py`
- Modify: `backend/tests/api/test_job_import_api.py`

- [ ] **Step 1: Add or confirm test dependency for HTTP mocking**

If needed, add `respx` or use direct monkeypatching with `pytest`.

Prefer minimal dependency surface if monkeypatching is enough.

- [ ] **Step 2: Test OpenRouter client request/response handling**

Cover:
- successful text response
- non-200 error
- timeout
- malformed response

- [ ] **Step 3: Test hybrid import success path**

Mock OpenRouter to return valid JSON.

Assert persisted imported job contains:
- `parse_source == 'llm_hybrid'`
- `parse_confidence` not null
- graph-ready `structured_jd_json`

- [ ] **Step 4: Test fallback path**

Mock OpenRouter failure.

Assert:
- import still succeeds when fallback is enabled
- `parse_source == 'rule_based_fallback'`
- `parse_confidence` still present

- [ ] **Step 5: Extend API tests**

Update API import tests to assert provenance fields are returned.

- [ ] **Step 6: Verify backend tests**

Run:
- `source .venv/bin/activate && python -m pytest backend/tests/services backend/tests/api -v`

Expected:
- all JD import tests pass

---

## Task 5: Expose Parse Provenance in Frontend UI

**Files:**
- Modify: `frontend/lib/api.ts`
- Modify: `frontend/components/jobs/job-list.tsx`
- Modify: `frontend/components/jobs/job-structured-data.tsx`
- Modify: `frontend/components/jobs/job-workspace.tsx`

- [ ] **Step 1: Extend frontend job type**

Add to `Job` type:
- `parse_source: string`
- `parse_confidence: number | null`

- [ ] **Step 2: Show compact provenance in Admin Jobs cards**

In `job-list.tsx`, add compact metadata such as:
- `Parse source llm_hybrid`
- `Confidence 0.93`

Keep this secondary to the primary job summary.

- [ ] **Step 3: Extend workspace metadata panel**

In `job-structured-data.tsx` or `job-workspace.tsx`, show:
- parse source
- parse confidence
- source file
- parse status

Format confidence clearly, e.g. percentage or two decimals.

- [ ] **Step 4: Verify route rendering**

Check:
- `/admin/jobs`
- `/jobs/[jobId]`

Expected:
- provenance values are visible without breaking the current layout

---

## Task 6: Update Documentation and Verify End-to-End

**Files:**
- Modify: `README.md`
- Modify: `.env.example`

- [ ] **Step 1: Document OpenRouter setup**

Add instructions for:
- creating/filling `OPENROUTER_API_KEY`
- selecting `OPENROUTER_MODEL`
- parser mode behavior
- fallback behavior

- [ ] **Step 2: Document safe frontend build verification**

Note that production build verification should run in an isolated container/image, not inside the mounted dev container sharing `.next`.

- [ ] **Step 3: End-to-end verification**

Run and record results for:
- `docker compose up --build -d`
- `make migrate`
- backend tests
- import one JD PDF through API or UI
- `curl http://localhost:8000/api/jobs/<id>`
- `curl -I http://localhost:3000/admin/jobs`
- `curl -I http://localhost:3000/jobs/<id>`
- `docker run --rm skillgraphcvmatcher-frontend npm run build`

Expected:
- imported job has `parse_source` and `parse_confidence`
- workspace renders provenance data
- production build still passes
