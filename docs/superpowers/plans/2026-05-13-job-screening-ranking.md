# Job Screening And Ranking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add job-scoped candidate screening and ranking with mandatory project-link verification, deterministic match scoring, and workspace UI summaries.

**Architecture:** Keep JD/CV import deterministic and fast. Add a backend screening workflow that verifies candidate evidence links first, rejects unverifiable candidates, scores only verified candidates against the job, and returns ranking/report data to the job workspace. Leave an AgentScope runner seam behind the workflow so matcher/explainer/critic orchestration can be upgraded without rewriting the API surface.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, httpx, Next.js App Router, TypeScript

---

### Task 1: Add Screening And Ranking Persistence

**Files:**
- Modify: `backend/app/models/candidate.py`
- Modify: `backend/app/schemas/candidate.py`
- Create: `backend/alembic/versions/20260513_03_add_candidate_screening_fields.py`
- Test: `backend/tests/api/test_candidate_import_api.py`

- [ ] Add candidate persistence fields for verification and ranking state.
- [ ] Add schema fields so API responses expose those values.
- [ ] Add Alembic migration for PostgreSQL.

### Task 2: Add Screening Workflow Service

**Files:**
- Create: `backend/app/services/candidate_screening_service.py`
- Test: `backend/tests/services/test_candidate_screening_service.py`

- [ ] Write failing service tests for missing-link rejection, invalid-link rejection, verified candidate scoring, and rank ordering.
- [ ] Implement minimal verification helpers, deterministic scoring, and workflow orchestration to make tests pass.

### Task 3: Expose Job Screening And Ranking API

**Files:**
- Modify: `backend/app/api/job_routes.py`
- Modify: `backend/app/repositories/candidate_repository.py`
- Create: `backend/tests/api/test_job_ranking_api.py`

- [ ] Write failing API tests for `POST /api/jobs/{job_id}/screen-and-rank` and `GET /api/jobs/{job_id}/ranking`.
- [ ] Implement the routes and repository updates.

### Task 4: Add Workspace Ranking UI

**Files:**
- Modify: `frontend/lib/api.ts`
- Modify: `frontend/components/jobs/job-candidate-panel.tsx`

- [ ] Add frontend API types and fetch helpers for screening/ranking.
- [ ] Render rejected candidates and ranked candidates in the job workspace.
- [ ] Add a `Run Screening & Ranking` action and refresh behavior after completion.

### Task 5: Add AgentScope Runner Seam And Docs

**Files:**
- Create: `backend/app/services/agentscope_runner.py`
- Modify: `backend/requirements.txt`
- Modify: `README.md`

- [ ] Add a lazy AgentScope integration seam that can be enabled later without changing the workflow API.
- [ ] Document the current verification policy and ranking behavior.
