# JD Parse Quality Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve future JD imports so the parser returns cleaner grouped skill data, better prerequisite attachment, and a more useful job workspace UI.

**Architecture:** The parser will evolve from a single overloaded `required_skills` representation to grouped structured output. The backend will expand taxonomy coverage, classify extracted items into graph-appropriate groups, constrain prerequisite attachment to approved groups, rebuild `required_skills_text` from grouped results, and expose the grouped structure to the frontend. The frontend workspace will shift from a flat skill view to grouped sections for better recruiter review and better graph/GAT readiness.

**Tech Stack:** FastAPI, SQLAlchemy, OpenRouter hybrid parser, PostgreSQL JSONB, Next.js 15 App Router, TypeScript, Tailwind CSS

---

## File Structure

### Backend parsing and taxonomy
- Modify: `backend/app/services/skill_taxonomy.py`
- Modify: `backend/app/services/jd_llm_schema.py`
- Modify: `backend/app/services/jd_parser.py`
- Modify: `backend/app/services/job_import_service.py`

### Backend tests
- Modify: `backend/tests/services/test_jd_parser.py`
- Modify: `backend/tests/services/test_job_import_service.py`
- Modify: `backend/tests/api/test_job_import_api.py`

### Frontend grouped workspace UI
- Modify: `frontend/lib/api.ts`
- Modify: `frontend/components/jobs/job-structured-data.tsx`
- Modify: `frontend/components/jobs/job-workspace.tsx`

### Documentation
- Modify: `README.md`

---

## Task 1: Expand Taxonomy Coverage and Add Classification Targets

**Files:**
- Modify: `backend/app/services/skill_taxonomy.py`

- [ ] **Step 1: Add missing canonical skills for common software roles**

Expand taxonomy with at least:
- `rust`
- `java`
- `node_js`
- `golang`
- `aws`
- `gcp`
- `azure`
- `android`
- `ios`
- `ci_cd`
- `version_control`
- `containerization`

- [ ] **Step 2: Add classification target metadata per taxonomy item**

Each taxonomy entry should explicitly declare a target group such as:
- `technical_skills`
- `platforms_cloud`
- `tooling_devops`
- `competencies`
- `role_descriptors`

This avoids making group assignment depend entirely on LLM wording.

- [ ] **Step 3: Tighten prerequisite coverage only where graph-safe**

Add prerequisite relationships for technical/core items where appropriate.

Examples:
- `node_js` -> `javascript`
- `golang` -> none
- `ci_cd` -> no hard prerequisite at MVP unless explicit
- `aws` -> no hard prerequisite edge at MVP unless taxonomy support is intentional

Do not invent prerequisites for generic competencies.

- [ ] **Step 4: Verify taxonomy integrity**

Check that alias lookup still works and new canonical values are reachable.

Run:
- `python3 -m compileall backend/app`

---

## Task 2: Tighten the Structured LLM Schema for Grouped Skill Output

**Files:**
- Modify: `backend/app/services/jd_llm_schema.py`
- Modify: `backend/app/services/jd_parser.py`

- [ ] **Step 1: Replace the single overloaded required skill schema**

Update the LLM schema to request grouped outputs:
- `technical_skills`
- `platforms_cloud`
- `tooling_devops`
- `competencies`
- `role_descriptors`
- `soft_skills`

Keep:
- `responsibilities`
- `qualifications`
- `language_requirements`
- `experience_years`
- optional parser confidence

- [ ] **Step 2: Update LLM prompt instructions**

Prompt should explicitly instruct the model to:
- separate core technical skills from generic competencies
- avoid putting soft skills into technical groups
- keep grouped output JSON-only
- avoid fabricating prerequisites

- [ ] **Step 3: Add parser-level normalization helpers for grouped collections**

Implement helpers that:
- normalize LLM grouped items
- canonicalize names through taxonomy
- assign fallback groups when taxonomy is missing
- deduplicate items across groups by precedence

- [ ] **Step 4: Rebuild structured output shape**

Ensure final `structured_jd_json` stores grouped lists instead of relying on only `required_skills`.

It should still include enough information for UI display and future graph sync.

---

## Task 3: Constrain Prerequisite Attachment by Group

**Files:**
- Modify: `backend/app/services/jd_parser.py`

- [ ] **Step 1: Add explicit group-aware prerequisite policy**

Allow prerequisite enrichment only for:
- `technical_skills`
- selected `tooling_devops`
- selected `platforms_cloud` when taxonomy defines it clearly

- [ ] **Step 2: Block prerequisite attachment for non-graph core groups**

Do not attach prerequisites to:
- `competencies`
- `role_descriptors`
- `soft_skills`

- [ ] **Step 3: Ensure related skills follow the same intent**

Where possible, keep `related_skills` richer for graph-ready groups and minimal or empty for generic groups.

- [ ] **Step 4: Verify a parsed job no longer treats generic capabilities as graph-first skills**

Expected outcome:
- `Python` retains graph enrichment
- `Software development` does not receive graph-style prerequisites

---

## Task 4: Rebuild `required_skills_text` from Grouped Data

**Files:**
- Modify: `backend/app/services/jd_parser.py`

- [ ] **Step 1: Build `required_skills_text` from grouped sources**

Compose the text field from:
1. `technical_skills`
2. `platforms_cloud`
3. `tooling_devops`
4. `competencies`
5. `role_descriptors`

Exclude:
- `soft_skills`

- [ ] **Step 2: Deduplicate and preserve priority ordering**

If an item appears in multiple groups, include it once using group precedence.

- [ ] **Step 3: Keep the field readable in UI and API**

The result should still be useful for the current cards and detail pages, even though the grouped structure becomes the source of truth.

---

## Task 5: Update Tests for Grouped Output and Cleaner Semantics

**Files:**
- Modify: `backend/tests/services/test_jd_parser.py`
- Modify: `backend/tests/services/test_job_import_service.py`
- Modify: `backend/tests/api/test_job_import_api.py`

- [ ] **Step 1: Update parser unit tests to assert grouped classification**

New expectations should include grouped fields such as:
- `technical_skills`
- `platforms_cloud`
- `tooling_devops`
- `competencies`

- [ ] **Step 2: Add a regression test for a mixed software developer JD**

Use a case similar to `job/10` and assert:
- `Python` lands in `technical_skills`
- `AWS` lands in `platforms_cloud`
- `CI/CD` lands in `tooling_devops`
- `Software development` lands in `competencies`
- no prerequisite is attached to `competencies`

- [ ] **Step 3: Extend hybrid import tests**

Assert that future imported jobs produce grouped structured output and keep provenance fields intact.

- [ ] **Step 4: Verify backend test suite**

Run:
- `source .venv/bin/activate && python -m pytest backend/tests/services backend/tests/api -v`

---

## Task 6: Update Workspace UI to Display Grouped Skill Sections

**Files:**
- Modify: `frontend/lib/api.ts`
- Modify: `frontend/components/jobs/job-structured-data.tsx`
- Modify: `frontend/components/jobs/job-workspace.tsx`

- [ ] **Step 1: Extend frontend type assumptions for grouped JSON**

Update the TypeScript shape so the job workspace can read:
- `technical_skills`
- `platforms_cloud`
- `tooling_devops`
- `competencies`
- `role_descriptors`
- `soft_skills`

- [ ] **Step 2: Replace flat graph-ready list with grouped sections**

Render separate sections/cards for:
- `Technical Skills`
- `Cloud & Platforms`
- `Tooling & DevOps`
- `Competencies`
- `Role Descriptors`
- `Soft Skills`

- [ ] **Step 3: Limit prerequisite/related detail to graph-oriented groups**

Only show prerequisite and related-skill metadata where it makes sense.

Avoid showing graph semantics for generic competencies and soft skills.

- [ ] **Step 4: Preserve current metadata/provenance panel**

Keep parse source, confidence, and source file visible as they are now.

---

## Task 7: Verify End-to-End Quality Improvement on a New Import

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document grouped skill output behavior**

Briefly describe that future imports will classify extracted signals into grouped categories instead of flattening everything into one skill list.

- [ ] **Step 2: Run end-to-end verification with a new JD import**

Verify with a fresh import after the parser changes:
- import a software-developer-style JD
- inspect API output for grouped structured data
- inspect `/jobs/[jobId]` UI for grouped rendering

- [ ] **Step 3: Verify build/runtime**

Run:
- `docker compose up --build -d`
- `make migrate`
- backend test suite
- `curl http://localhost:8000/api/jobs/<new_id>`
- `curl -I http://localhost:3000/jobs/<new_id>`
- `docker run --rm skillgraphcvmatcher-frontend npm run build`

Expected:
- future imports are grouped more cleanly
- technical/core graph-oriented items are easier to distinguish
- prerequisites appear only where appropriate
