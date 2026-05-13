# AI/ML Taxonomy Expansion Design

## Goal

Expand the internal skill taxonomy so AI and machine learning job descriptions produce meaningful prerequisite and related-skill metadata instead of empty graph semantics.

This phase targets JD quality similar to `job/15` where AI skills were extracted correctly by the parser but lacked taxonomy enrichment.

## Scope

### In scope

- expand taxonomy coverage for core AI/ML skills
- attach graph-safe prerequisites and related skills for those items
- improve grouped parser output for future AI/ML JD imports
- improve Neo4j projection quality for AI/ML imports
- add regression tests for an AI-focused JD

### Out of scope

- LLM-suggested prerequisites
- candidate CV parsing
- candidate-job matching
- broad LLM engineering or RAG taxonomy

## Target Skill Set

Initial AI/ML core taxonomy should include at least:

- `artificial_intelligence`
- `machine_learning`
- `deep_learning`
- `cnn`
- `rnn`
- `transformer`
- `bert`
- `t5`
- `natural_language_processing`
- `optical_character_recognition`
- `computer_vision`
- `data_preprocessing`
- `model_optimization`
- `onnx`
- `tflite`
- `tensorrt`
- `mlops`
- `mlflow`
- `clearml`

## Taxonomy Rules

### Classification

Most of the above should land in:

- `technical_skills`

Selected engineering workflow items should land in:

- `tooling_devops`

Expected examples:

- `machine_learning` -> `technical_skills`
- `transformer` -> `technical_skills`
- `onnx` -> `technical_skills`
- `mlops` -> `tooling_devops`
- `mlflow` -> `tooling_devops`
- `clearml` -> `tooling_devops`

### Prerequisite examples

Recommended initial edges:

- `machine_learning` -> `python`
- `deep_learning` -> `machine_learning`
- `cnn` -> `deep_learning`
- `rnn` -> `deep_learning`
- `transformer` -> `deep_learning`
- `bert` -> `transformer`
- `t5` -> `transformer`
- `natural_language_processing` -> `machine_learning`
- `optical_character_recognition` -> `computer_vision`
- `onnx` -> `model_optimization`
- `tflite` -> `model_optimization`
- `tensorrt` -> `model_optimization`
- `mlops` -> `machine_learning`

These are intended as conservative graph-safe edges, not an exhaustive ontology.

### Related-skill examples

- `transformer` related to `bert`, `t5`, `natural_language_processing`
- `computer_vision` related to `cnn`, `yolo`, `optical_character_recognition`
- `natural_language_processing` related to `bert`, `t5`, `transformer`
- `mlops` related to `docker`, `ci_cd`, `mlflow`, `clearml`

## Parser Impact

Future AI/ML imports should no longer produce AI skills with:

- empty `skill_groups`
- empty `prerequisites`
- empty `related_skills`

for canonical items that are now covered by the taxonomy.

Example desired outcome for an AI JD:

- `transformer.prerequisites = ["deep_learning"]`
- `bert.prerequisites = ["transformer"]`
- `mlops.related_skills` includes `mlflow`, `clearml`, `docker`, `ci_cd`

## Neo4j Impact

Because graph projection already consumes graph-safe groups automatically, expanding taxonomy should immediately improve:

- `Skill` node quality
- `REQUIRES` edge context
- `PREREQUISITE_OF` edges for future AI imports

No Neo4j schema change is required in this phase.

## Verification

### Backend

- import a fresh AI-focused JD
- confirm AI/ML canonical skills have populated:
  - `skill_groups`
  - `prerequisites`
  - `related_skills`

### Neo4j

After importing an AI JD:

- `MATCH (j:Job {job_id: <id>})-[r:REQUIRES]->(s:Skill) RETURN s.canonical, r.category`
- `MATCH (s1:Skill)-[:PREREQUISITE_OF]->(s2:Skill) WHERE s2.canonical IN ['transformer', 'bert', 't5', 'mlops'] RETURN s1.canonical, s2.canonical`

Expected:

- AI skills appear as enriched `Skill` nodes
- prerequisite edges are present for covered canonical items

### Regression

Use a JD similar to `Senior AI Engineer` and assert:

- `machine_learning` has non-empty prerequisite metadata
- `transformer` has non-empty prerequisite metadata
- `bert` has non-empty prerequisite metadata
- `mlops` has non-empty related skills

## Expected Outcome

After this phase:

- AI/ML JDs become much more graph-ready
- prerequisite gaps like those seen in `job/15` are reduced substantially
- the system remains taxonomy-driven and explainable, without giving LLM full control over graph edges
