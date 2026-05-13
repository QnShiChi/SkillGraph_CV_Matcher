# Hybrid CV Parsing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade candidate import from rule-based parsing only to hybrid OpenRouter-assisted parsing with stronger grouped skill extraction and better evidence quality.

**Architecture:** The existing candidate import pipeline remains PostgreSQL-first and graph-aware. This phase extends it with an OpenRouter-backed CV parser path that mirrors the JD hybrid architecture. Local preprocessing still extracts raw text and basic section structure, the LLM normalizes structured CV output and candidate evidence, then taxonomy canonicalizes all graph semantics before the candidate is persisted and projected into Neo4j.

**Tech Stack:** FastAPI, OpenRouter, SQLAlchemy, PostgreSQL, Neo4j, Next.js 15 App Router, TypeScript

---

## File Structure

### Backend config and parsing
- Modify: `backend/app/core/config.py`
- Add: `backend/app/services/cv_llm_schema.py`
- Modify: `backend/app/services/cv_parser.py`
- Modify: `backend/app/services/candidate_import_service.py`

### Backend tests
- Modify: `backend/tests/conftest.py`
- Modify: `backend/tests/services/test_cv_parser.py`
- Modify: `backend/tests/services/test_candidate_import_service.py`
- Modify or Add: candidate API import tests

### Frontend / docs
- Modify: `README.md`

---

## Task 1: Add Candidate Parser Configuration

**Files:**
- Modify: `backend/app/core/config.py`

- [ ] **Step 1: Add candidate parser mode settings**

Add:
- `cv_parser_mode`
- `cv_parser_temperature`
- `cv_parser_max_output_tokens`
- `cv_parser_timeout_seconds`
- `cv_parser_enable_fallback`

- [ ] **Step 2: Set safe defaults**

Recommended defaults:
- `cv_parser_mode=rule_based`
- low temperature
- sufficient output token budget
- fallback enabled

- [ ] **Step 3: Keep JD config untouched**

Candidate config should mirror JD style without breaking existing JD import behavior.

---

## Task 2: Define Strict LLM Schema for CV Parsing

**Files:**
- Add: `backend/app/services/cv_llm_schema.py`

- [ ] **Step 1: Create grouped CV output schema**

Schema should cover:
- `summary`
- `technical_skills`
- `platforms_cloud`
- `tooling_devops`
- `competencies`
- `soft_skills`
- `experience`
- `education`
- `language_requirements`
- `parser_confidence`

- [ ] **Step 2: Require evidence-friendly skill items**

Graph-safe skill items should support:
- `name`
- `section_origin`
- `confidence`
- `aliases`
- optional evidence snippets or evidence text collection

- [ ] **Step 3: Keep schema strict and JSON-only**

The OpenRouter path should validate structured output exactly like the JD hybrid parser does.

---

## Task 3: Add Hybrid CV Parser Path

**Files:**
- Modify: `backend/app/services/cv_parser.py`

- [ ] **Step 1: Preserve the existing rule-based parser**

Do not remove or break the current `parse_cv_text(...)`.

- [ ] **Step 2: Add `parse_cv_text_hybrid(...)`**

This function should:
- preprocess raw CV text locally
- build OpenRouter prompts
- parse and validate JSON response
- canonicalize skills through taxonomy
- merge/group output
- preserve evidence

- [ ] **Step 3: Keep taxonomy as the canonical source**

Even when the LLM identifies skills, the backend must:
- map to canonical names
- attach `skill_groups`
- attach `prerequisites`
- attach `related_skills`

- [ ] **Step 4: Improve evidence handling**

Evidence should become more specific than the current rule-based baseline where possible.

---

## Task 4: Wire Hybrid Parsing Into Candidate Import

**Files:**
- Modify: `backend/app/services/candidate_import_service.py`

- [ ] **Step 1: Select parser mode from config**

Support:
- `rule_based`
- `hybrid`
- `llm_only`

- [ ] **Step 2: Reuse OpenRouter client pattern**

Use the same overall approach as JD import:
- build client from settings
- call hybrid parser
- surface `OpenRouterConfigurationError` and `OpenRouterError` cleanly

- [ ] **Step 3: Add fallback behavior**

If:
- mode is `hybrid`
- fallback is enabled
- LLM fails

Then:
- parse with local rule-based CV parser
- set `parse_source=rule_based_fallback`

- [ ] **Step 4: Preserve downstream graph projection**

Candidate graph sync should continue to work unchanged after the parser source changes.

---

## Task 5: Add Tests for Hybrid Success and Fallback

**Files:**
- Modify: `backend/tests/conftest.py`
- Modify: `backend/tests/services/test_cv_parser.py`
- Modify: `backend/tests/services/test_candidate_import_service.py`
- Modify or Add: candidate API tests

- [ ] **Step 1: Keep tests deterministic**

Ensure local `.env` does not accidentally force hybrid mode during normal tests unless explicitly requested by the test.

- [ ] **Step 2: Add hybrid success-path tests**

Assert:
- `parse_source=llm_hybrid`
- grouped candidate output exists
- evidence exists for extracted graph-safe skills

- [ ] **Step 3: Add fallback-path tests**

Mock OpenRouter failure and assert:
- import still succeeds
- `parse_source=rule_based_fallback`

- [ ] **Step 4: Keep API import tests green**

`POST /api/candidates/import` should still work in rule-based mode and surface graph sync metadata.

---

## Task 6: Verify End-to-End Runtime

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Run verification commands**

Run:
- `python3 -m compileall backend/app backend/tests`
- `source .venv/bin/activate && python -m pytest backend/tests/services backend/tests/api -v`
- `docker compose up --build -d`
- `make migrate`
- `docker run --rm skillgraphcvmatcher-frontend npm run build`

- [ ] **Step 2: Test live hybrid candidate import**

With OpenRouter config present:
- import a text-based CV PDF
- verify `parse_source=llm_hybrid`
- inspect evidence quality in API output

- [ ] **Step 3: Test live fallback behavior**

If practical:
- simulate or force OpenRouter failure
- verify candidate import still succeeds as `rule_based_fallback`

- [ ] **Step 4: Update README**

Document:
- candidate-side hybrid parser settings
- fallback behavior
- current candidate parser limitations

---

## Expected Outcome

After this phase:

- candidate parsing quality improves beyond pure rule-based extraction
- evidence snippets become more useful
- provenance remains explicit through `parse_source` and `parse_confidence`
- the graph remains consistent because taxonomy still governs canonical semantics
