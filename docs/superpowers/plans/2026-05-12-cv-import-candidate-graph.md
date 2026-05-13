# CV Import and Candidate Graph Projection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the candidate half of the graph by importing text-based CV PDFs, parsing them into structured evidence-backed candidate data, and projecting graph-safe candidate skills into Neo4j.

**Architecture:** The candidate import pipeline should mirror the job import architecture. CV PDFs are extracted with `PyMuPDF`, parsed into grouped structured data using local preprocessing plus optional hybrid OpenRouter parsing, canonicalized through the same taxonomy as JD parsing, persisted in PostgreSQL, and then projected into Neo4j as `Candidate` to `Skill` relationships. Candidate parsing must preserve evidence in PostgreSQL while keeping the graph projection lightweight and canonical.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, PostgreSQL, Neo4j, OpenRouter hybrid parser, Next.js 15 App Router, TypeScript, Tailwind CSS

---

## File Structure

### Backend candidate model and migration
- Modify: `backend/app/models/candidate.py`
- Modify: `backend/app/schemas/candidate.py`
- Modify: `backend/app/repositories/candidate_repository.py`
- Add: `backend/alembic/versions/<timestamp>_expand_candidates_for_cv_import.py`

### Backend CV parsing and import
- Add: `backend/app/services/cv_parser.py`
- Add: `backend/app/services/candidate_import_service.py`
- Add: `backend/app/services/candidate_graph_sync.py`
- Modify: `backend/app/api/candidate_routes.py`

### Backend tests
- Add: `backend/tests/services/test_cv_parser.py`
- Add: `backend/tests/services/test_candidate_import_service.py`
- Add: `backend/tests/services/test_candidate_graph_sync.py`
- Modify: `backend/tests/api/test_candidate_api.py` or add a focused import test file

### Frontend candidate import and detail view
- Modify: `frontend/lib/api.ts`
- Modify: `frontend/components/candidates/candidate-admin-client.tsx`
- Modify: `frontend/components/candidates/candidate-list.tsx`
- Add or Modify: candidate detail / structured data components

### Documentation
- Modify: `README.md`

---

## Task 1: Expand Candidate Persistence for Import and Graph Status

**Files:**
- Modify: `backend/app/models/candidate.py`
- Modify: `backend/app/schemas/candidate.py`
- Modify: `backend/app/repositories/candidate_repository.py`
- Add: `backend/alembic/versions/<timestamp>_expand_candidates_for_cv_import.py`

- [ ] **Step 1: Extend the candidate SQLAlchemy model**

Add:
- `source_type`
- `source_file_name`
- `parse_status`
- `parse_source`
- `parse_confidence`
- `structured_cv_json`
- `graph_sync_status`
- `graph_sync_error`
- `graph_synced_at`

- [ ] **Step 2: Create the Alembic migration**

Migration should add all candidate import and graph sync fields with safe defaults/nullability for existing manual rows.

- [ ] **Step 3: Extend candidate API schemas**

Expose the new fields in candidate read responses.

- [ ] **Step 4: Add repository helpers**

Add:
- candidate import creation helper
- candidate graph sync update helper

---

## Task 2: Build the Structured CV Parser

**Files:**
- Add: `backend/app/services/cv_parser.py`

- [ ] **Step 1: Define grouped structured CV output**

Parser output should include:
- `summary`
- `technical_skills`
- `platforms_cloud`
- `tooling_devops`
- `competencies`
- `soft_skills`
- `experience`
- `education`
- `language_requirements`

- [ ] **Step 2: Add evidence support per extracted skill**

Each graph-safe candidate skill should retain at least one evidence item:
- `text`
- `section_origin`
- `confidence`

- [ ] **Step 3: Reuse shared taxonomy**

Canonicalize CV skills through the same taxonomy already used for JDs.

- [ ] **Step 4: Support rule-based and hybrid modes**

Match the JD parser philosophy:
- rule-based mode
- hybrid LLM mode
- fallback if configured

---

## Task 3: Implement Candidate Import Flow

**Files:**
- Add: `backend/app/services/candidate_import_service.py`
- Modify: `backend/app/api/candidate_routes.py`

- [ ] **Step 1: Add `POST /api/candidates/import`**

Accept:
- `multipart/form-data`
- `file` as a text-based PDF

- [ ] **Step 2: Extract text from PDF**

Reject unreadable or empty PDFs with a clear error.

- [ ] **Step 3: Parse and persist candidate**

Import flow:
1. read PDF
2. extract raw text
3. parse structured candidate data
4. save candidate in PostgreSQL
5. project graph-safe skills to Neo4j
6. update graph sync fields

- [ ] **Step 4: Keep PostgreSQL as source of truth**

If candidate graph sync fails:
- keep the candidate row
- set `graph_sync_status=failed`
- set `graph_sync_error`

---

## Task 4: Implement Candidate Neo4j Projection

**Files:**
- Add: `backend/app/services/candidate_graph_sync.py`

- [ ] **Step 1: Build graph-safe payload**

Project only:
- `technical_skills`
- `platforms_cloud`
- `tooling_devops`

- [ ] **Step 2: Upsert `Candidate` nodes**

Create or merge:
- `(:Candidate {candidate_id})`

Set:
- `full_name`
- `source_type`
- `parse_source`
- `parse_confidence`
- `status`

- [ ] **Step 3: Upsert `HAS_SKILL` edges**

Create:
- `(:Candidate)-[:HAS_SKILL]->(:Skill)`

Properties:
- `confidence`
- `section_origin`
- `category`
- `evidence_count`

- [ ] **Step 4: Reuse existing `Skill` nodes**

Do not create separate candidate-only skill nodes. Shared canonicals must point to the same `Skill` nodes already used by jobs.

---

## Task 5: Add Evidence-Aware Candidate UI

**Files:**
- Modify: `frontend/lib/api.ts`
- Modify: `frontend/components/candidates/candidate-admin-client.tsx`
- Modify: `frontend/components/candidates/candidate-list.tsx`
- Add or Modify: candidate structured detail components

- [ ] **Step 1: Add candidate import action**

Add `Import CV PDF` to the admin candidates workspace.

- [ ] **Step 2: Show provenance and graph sync state**

Candidate cards should display:
- `source_type`
- `parse_source`
- `parse_confidence`
- `graph_sync_status`

- [ ] **Step 3: Add candidate detail or workspace rendering**

Show:
- summary
- grouped skills
- evidence snippets
- graph sync metadata

- [ ] **Step 4: Keep the UI aligned with the existing dashboard language**

Reuse current design patterns from jobs/workspace rather than inventing a disconnected UI.

---

## Task 6: Add Tests for Candidate Parsing, Import, and Graph Sync

**Files:**
- Add: `backend/tests/services/test_cv_parser.py`
- Add: `backend/tests/services/test_candidate_import_service.py`
- Add: `backend/tests/services/test_candidate_graph_sync.py`
- Add or Modify: candidate API import tests

- [ ] **Step 1: Add parser regression tests**

Assert that a CV with known skills produces:
- canonical graph-safe skills
- grouped structured output
- non-empty evidence for at least the main extracted skills

- [ ] **Step 2: Add candidate graph payload test**

Assert only graph-safe categories produce `HAS_SKILL` edges.

- [ ] **Step 3: Add import success test**

Assert:
- candidate is created
- `structured_cv_json` exists
- `graph_sync_status` is populated

- [ ] **Step 4: Add graph sync failure test**

Mock Neo4j failure and assert:
- candidate still exists in PostgreSQL
- `graph_sync_status=failed`
- `graph_sync_error` exists

---

## Task 7: Verify End-to-End Runtime

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Run verification commands**

Run:
- `python3 -m compileall backend/app backend/tests`
- `source .venv/bin/activate && python -m pytest backend/tests/services backend/tests/api -v`
- `docker compose up --build -d`
- `make migrate`
- `docker run --rm skillgraphcvmatcher-frontend npm run build`

- [ ] **Step 2: Import a fresh CV**

Verify in API response:
- candidate import succeeds
- grouped candidate skills exist
- evidence is stored
- graph sync fields are returned

- [ ] **Step 3: Query Neo4j**

Use checks such as:
- `MATCH (c:Candidate) RETURN c.candidate_id, c.full_name`
- `MATCH (c:Candidate {candidate_id: <id>})-[r:HAS_SKILL]->(s:Skill) RETURN c, r, s`

- [ ] **Step 4: Verify shared skill space**

Confirm candidate graph projection reuses `Skill` nodes already created from JDs rather than creating duplicates by alternate naming.

---

## Expected Outcome

After this phase:

- candidates can be imported as structured graph-aware entities
- evidence is preserved for later explainability
- Neo4j contains both `Job` and `Candidate` skill relationships
- the system is ready for job-candidate matching in the same canonical skill graph
