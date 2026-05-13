# JD Cleanup and Neo4j Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean up future JD parsing output enough to keep graph-noise out of core skill data, then automatically project graph-safe JD categories into Neo4j after a successful import.

**Architecture:** The import pipeline remains PostgreSQL-first. JD parsing continues to produce grouped structured data, but parser cleanup will reduce noisy role/context leakage and downgrade weak competency claims. After the job is saved, a graph projection service will upsert `Job` and `Skill` nodes plus `REQUIRES` and taxonomy-derived `PREREQUISITE_OF` edges into Neo4j. Graph sync state will be stored on the job record and surfaced in both API and UI.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, PostgreSQL, Neo4j Python driver, OpenRouter hybrid parser, Next.js 15 App Router, TypeScript, Tailwind CSS

---

## File Structure

### Backend parser cleanup
- Modify: `backend/app/services/jd_parser.py`
- Modify: `backend/app/services/skill_taxonomy.py`
- Modify: `backend/app/services/job_import_service.py`

### Backend graph sync
- Add: `backend/app/services/job_graph_sync.py`
- Modify: `backend/app/db/neo4j.py` or equivalent Neo4j client module if needed
- Modify: `backend/app/models/job.py`
- Modify: `backend/app/schemas/job.py`
- Modify: `backend/app/repositories/job_repository.py`

### Database migration
- Add: `backend/alembic/versions/<timestamp>_add_graph_sync_fields_to_jobs.py`

### Backend tests
- Modify: `backend/tests/services/test_jd_parser.py`
- Add or Modify: `backend/tests/services/test_job_graph_sync.py`
- Modify: `backend/tests/services/test_job_import_service.py`
- Modify: `backend/tests/api/test_job_import_api.py`

### Frontend graph sync visibility
- Modify: `frontend/lib/api.ts`
- Modify: `frontend/components/jobs/job-list.tsx`
- Modify: `frontend/components/jobs/job-structured-data.tsx`
- Modify: `frontend/components/jobs/job-workspace.tsx`

### Documentation
- Modify: `README.md`

---

## Task 1: Tighten Parser Output Before Graph Projection

**Files:**
- Modify: `backend/app/services/jd_parser.py`
- Modify: `backend/app/services/skill_taxonomy.py`

- [ ] **Step 1: Remove `role_descriptors` from `required_skills_text`**

Rebuild `required_skills_text` from:
- `technical_skills`
- `platforms_cloud`
- `tooling_devops`
- `competencies`

Exclude:
- `role_descriptors`
- `soft_skills`

- [ ] **Step 2: Deduplicate noisy role/context descriptors**

Collapse overlapping remote/distributed/cross-functional variants so future imports retain fewer redundant `role_descriptors`.

Target examples:
- `remote_work`
- `distributed_collaboration`
- `cross_functional_collaboration`

- [ ] **Step 3: Downgrade selected weak competencies**

Adjust importance and `requirement_type` for noisy competency items such as:
- `code_reviews`
- `architectural_planning`
- `performance_optimization`
- `software_development_lifecycle`

These should lean `contextual` unless JD wording strongly indicates otherwise.

- [ ] **Step 4: Preserve graph-safe prerequisite policy**

Keep prerequisites attached only to graph-safe categories:
- `technical_skills`
- selected `platforms_cloud`
- selected `tooling_devops`

Never attach prerequisites to:
- `competencies`
- `role_descriptors`
- `soft_skills`

---

## Task 2: Add Graph Sync State to Jobs

**Files:**
- Modify: `backend/app/models/job.py`
- Modify: `backend/app/schemas/job.py`
- Modify: `backend/app/repositories/job_repository.py`
- Add: `backend/alembic/versions/<timestamp>_add_graph_sync_fields_to_jobs.py`

- [ ] **Step 1: Extend the SQLAlchemy job model**

Add:
- `graph_sync_status`
- `graph_sync_error`
- `graph_synced_at`

- [ ] **Step 2: Create Alembic migration**

Migration should:
- add the new columns
- set sensible defaults or nullable behavior for existing rows

- [ ] **Step 3: Expose graph sync fields in API schemas**

Job read responses should include:
- `graph_sync_status`
- `graph_sync_error`
- `graph_synced_at`

- [ ] **Step 4: Add repository helpers**

Add helpers to update graph sync state after import and after failed projection attempts.

---

## Task 3: Implement the Neo4j Graph Projection Service

**Files:**
- Add: `backend/app/services/job_graph_sync.py`
- Modify: Neo4j client/config modules as needed

- [ ] **Step 1: Create graph-safe payload builder**

Build a projection payload from only:
- `technical_skills`
- `platforms_cloud`
- `tooling_devops`

Ignore:
- `competencies`
- `role_descriptors`
- `soft_skills`

- [ ] **Step 2: Upsert `Job` nodes**

Create or merge:
- `(:Job {job_id})`

Set properties such as:
- `title`
- `source_type`
- `parse_source`
- `parse_confidence`
- `status`

- [ ] **Step 3: Upsert `Skill` nodes**

Create or merge:
- `(:Skill {canonical})`

Set:
- `display_name`
- `category`

- [ ] **Step 4: Upsert `REQUIRES` edges**

Create:
- `(:Job)-[:REQUIRES]->(:Skill)`

With properties:
- `importance`
- `requirement_type`
- `confidence`
- `section_origin`
- `category`

- [ ] **Step 5: Upsert taxonomy-derived edges**

Create:
- `(:Skill)-[:PREREQUISITE_OF]->(:Skill)`

Optionally add:
- `(:Skill)-[:RELATED_TO]->(:Skill)`

Only if the relation comes from taxonomy, never from LLM invention.

---

## Task 4: Wire Automatic Graph Sync Into the Import Flow

**Files:**
- Modify: `backend/app/services/job_import_service.py`

- [ ] **Step 1: Keep PostgreSQL as source of truth**

Import flow should:
1. parse JD
2. save job in PostgreSQL
3. attempt Neo4j sync
4. update graph sync fields

- [ ] **Step 2: Handle graph sync failure without deleting the job**

If sync fails:
- keep `parse_status=processed`
- set `graph_sync_status=failed`
- store short `graph_sync_error`

- [ ] **Step 3: Mark successful syncs**

If sync succeeds:
- set `graph_sync_status=synced`
- set `graph_synced_at`
- clear `graph_sync_error`

- [ ] **Step 4: Keep import response consistent**

API response after import should return the saved job with graph sync metadata included.

---

## Task 5: Surface Graph Sync Status in the Frontend

**Files:**
- Modify: `frontend/lib/api.ts`
- Modify: `frontend/components/jobs/job-list.tsx`
- Modify: `frontend/components/jobs/job-structured-data.tsx`
- Modify: `frontend/components/jobs/job-workspace.tsx`

- [ ] **Step 1: Extend frontend job types**

Include:
- `graph_sync_status`
- `graph_sync_error`
- `graph_synced_at`

- [ ] **Step 2: Show sync state on Admin Jobs cards**

Each job card should display a compact graph status:
- `Graph synced`
- `Graph failed`
- `Graph pending`

If failed, show a short error hint only.

- [ ] **Step 3: Show graph metadata in `/jobs/[jobId]`**

Workspace should display:
- graph sync status
- graph sync timestamp
- graph sync error if present

- [ ] **Step 4: Keep grouped skill UI readable**

Ensure parser cleanup makes the grouped UI less noisy, especially by removing role descriptors from `required_skills_text`.

---

## Task 6: Add Tests for Cleanup and Graph Sync

**Files:**
- Modify: `backend/tests/services/test_jd_parser.py`
- Add or Modify: `backend/tests/services/test_job_graph_sync.py`
- Modify: `backend/tests/services/test_job_import_service.py`
- Modify: `backend/tests/api/test_job_import_api.py`

- [ ] **Step 1: Add parser cleanup regression coverage**

Assert that for future imports:
- `required_skills_text` excludes `role_descriptors`
- selected competencies downgrade to `contextual`
- remote/distributed/cross-functional descriptors are less duplicated

- [ ] **Step 2: Test graph payload construction**

Assert only graph-safe groups are projected:
- `technical_skills`
- `platforms_cloud`
- `tooling_devops`

Assert excluded groups never generate graph nodes or `REQUIRES` edges.

- [ ] **Step 3: Test graph sync success path**

Validate:
- job sync status becomes `synced`
- graph timestamp is written
- import response includes graph metadata

- [ ] **Step 4: Test graph sync failure path**

Mock Neo4j failure and assert:
- job still exists in PostgreSQL
- `graph_sync_status=failed`
- `graph_sync_error` is populated

---

## Task 7: Verify End-to-End Runtime

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Run backend and frontend verification**

Run:
- `python3 -m compileall backend/app backend/tests`
- `source .venv/bin/activate && python -m pytest backend/tests/services backend/tests/api -v`
- `docker compose up --build -d`
- `make migrate`
- `docker run --rm skillgraphcvmatcher-frontend npm run build`

- [ ] **Step 2: Import a fresh JD**

Verify:
- grouped parser output is cleaner
- graph sync fields are returned
- imported job remains saved even if graph sync fails

- [ ] **Step 3: Inspect Neo4j directly**

Run Cypher checks such as:
- `MATCH (j:Job {job_id: <id>}) RETURN j`
- `MATCH (j:Job {job_id: <id>})-[r:REQUIRES]->(s:Skill) RETURN j, r, s`
- `MATCH (s1:Skill)-[:PREREQUISITE_OF]->(s2:Skill) RETURN s1, s2 LIMIT 25`

- [ ] **Step 4: Verify frontend visibility**

Confirm:
- `/admin/jobs` shows graph sync state
- `/jobs/[jobId]` shows graph sync metadata
- grouped skill sections still render cleanly

---

## Expected Outcome

After this phase:

- future JD imports produce cleaner recruiter-facing and graph-facing data
- noisy role/context items stop polluting `required_skills_text`
- Neo4j receives only graph-safe skill categories
- every imported job has explicit graph sync provenance
- the system becomes ready for graph-backed candidate ingestion and later matching work
