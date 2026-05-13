# AI/ML Taxonomy Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the internal taxonomy so AI/ML job descriptions produce graph-meaningful prerequisite and related-skill metadata instead of empty graph semantics.

**Architecture:** The parser and Neo4j projection pipeline already work. This phase improves ontology coverage, not pipeline shape. We will extend `skill_taxonomy.py` with AI/ML canonical skills, attach conservative prerequisite and related-skill relationships, validate that future imports enrich structured JD data correctly, and verify that the existing graph projection automatically benefits from the richer taxonomy.

**Tech Stack:** FastAPI, OpenRouter hybrid parser, PostgreSQL JSONB, Neo4j, Next.js 15 App Router

---

## File Structure

### Backend taxonomy and parser behavior
- Modify: `backend/app/services/skill_taxonomy.py`
- Modify: `backend/app/services/jd_parser.py` only if canonicalization or fallback grouping needs light support

### Backend tests
- Modify: `backend/tests/services/test_jd_parser.py`
- Modify or Add: `backend/tests/services/test_job_graph_sync.py`

### Documentation
- Modify: `README.md`

---

## Task 1: Add Core AI/ML Canonical Skills to Taxonomy

**Files:**
- Modify: `backend/app/services/skill_taxonomy.py`

- [ ] **Step 1: Add foundational AI/ML skills**

Add canonical entries for:
- `artificial_intelligence`
- `machine_learning`
- `deep_learning`
- `computer_vision`
- `natural_language_processing`
- `data_preprocessing`
- `model_optimization`

- [ ] **Step 2: Add model and architecture skills**

Add canonical entries for:
- `cnn`
- `rnn`
- `transformer`
- `bert`
- `t5`

- [ ] **Step 3: Add optimization and deployment skills**

Add canonical entries for:
- `onnx`
- `tflite`
- `tensorrt`
- `mlops`
- `mlflow`
- `clearml`

- [ ] **Step 4: Classify each item into the correct graph-safe group**

Expected examples:
- `machine_learning` -> `technical_skills`
- `transformer` -> `technical_skills`
- `onnx` -> `technical_skills`
- `mlops` -> `tooling_devops`
- `mlflow` -> `tooling_devops`
- `clearml` -> `tooling_devops`

---

## Task 2: Attach Conservative Prerequisite and Related-Skill Metadata

**Files:**
- Modify: `backend/app/services/skill_taxonomy.py`

- [ ] **Step 1: Add prerequisite chains for AI foundations**

Examples:
- `machine_learning` -> `python`
- `deep_learning` -> `machine_learning`
- `natural_language_processing` -> `machine_learning`
- `computer_vision` -> `machine_learning`

- [ ] **Step 2: Add prerequisite chains for model families**

Examples:
- `cnn` -> `deep_learning`
- `rnn` -> `deep_learning`
- `transformer` -> `deep_learning`
- `bert` -> `transformer`
- `t5` -> `transformer`

- [ ] **Step 3: Add prerequisite chains for optimization and MLOps tools**

Examples:
- `onnx` -> `model_optimization`
- `tflite` -> `model_optimization`
- `tensorrt` -> `model_optimization`
- `mlops` -> `machine_learning`

- [ ] **Step 4: Add related-skill relationships**

Examples:
- `transformer` related to `bert`, `t5`, `natural_language_processing`
- `computer_vision` related to `cnn`, `yolo`, `optical_character_recognition`
- `natural_language_processing` related to `bert`, `t5`, `transformer`
- `mlops` related to `docker`, `ci_cd`, `mlflow`, `clearml`

---

## Task 3: Ensure Parser Uses New Taxonomy Cleanly

**Files:**
- Modify: `backend/app/services/jd_parser.py` only if needed

- [ ] **Step 1: Verify new aliases canonicalize correctly**

Ensure parser maps typical JD strings like:
- `AI`
- `ML`
- `NLP`
- `OCR`
- `TensorFlow Lite`

to the intended canonical values.

- [ ] **Step 2: Keep group assignment stable**

Ensure new AI skills stay in graph-safe groups and do not accidentally fall into:
- `competencies`
- `role_descriptors`

- [ ] **Step 3: Preserve prerequisite policy**

Prerequisites should still be attached only through taxonomy and only for graph-safe groups.

---

## Task 4: Add Regression Tests for AI JD Enrichment

**Files:**
- Modify: `backend/tests/services/test_jd_parser.py`
- Modify or Add: `backend/tests/services/test_job_graph_sync.py`

- [ ] **Step 1: Add parser regression for AI-focused JD**

Use a JD similar to `Senior AI Engineer` and assert:
- `machine_learning` exists in `technical_skills`
- `transformer` exists in `technical_skills`
- `bert` exists in `technical_skills`
- `mlops` exists in `tooling_devops`

- [ ] **Step 2: Assert AI prerequisites are populated**

Examples:
- `machine_learning.prerequisites` is non-empty
- `transformer.prerequisites` contains `deep_learning`
- `bert.prerequisites` contains `transformer`

- [ ] **Step 3: Assert AI related skills are populated**

Examples:
- `mlops.related_skills` contains `mlflow` or `clearml`
- `transformer.related_skills` contains `bert` or `t5`

- [ ] **Step 4: Assert graph payload benefits automatically**

Verify that graph projection payload for an AI JD includes enriched prerequisite edges from the new taxonomy.

---

## Task 5: Verify End-to-End With Neo4j

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Run verification commands**

Run:
- `python3 -m compileall backend/app backend/tests`
- `source .venv/bin/activate && python -m pytest backend/tests/services backend/tests/api -v`
- `docker compose up --build -d`
- `make migrate`

- [ ] **Step 2: Import a fresh AI JD**

Verify in API output:
- AI skills have non-empty `prerequisites`
- AI skills have non-empty `related_skills`

- [ ] **Step 3: Query Neo4j**

Use Cypher checks such as:
- `MATCH (j:Job {job_id: <id>})-[r:REQUIRES]->(s:Skill) RETURN s.canonical, r.category`
- `MATCH (s1:Skill)-[:PREREQUISITE_OF]->(s2:Skill) WHERE s2.canonical IN ['machine_learning','transformer','bert','t5','mlops'] RETURN s1.canonical, s2.canonical`

- [ ] **Step 4: Update README minimally**

Mention that AI/ML taxonomy is now covered for core import cases and that Neo4j projection for future AI jobs benefits automatically.

---

## Expected Outcome

After this phase:

- AI/ML JD imports stop producing empty graph semantics for core AI skills
- prerequisite quality for AI jobs improves significantly
- Neo4j graph projection becomes useful for AI-focused jobs, not only software/platform jobs
- the system remains taxonomy-driven and explainable
