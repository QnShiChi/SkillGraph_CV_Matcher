# JD Import and Job Workspace Design

## Goal

Move the product from CRUD-oriented job management to a job-centric workflow where a recruiter can import a text-based JD PDF, generate a graph-ready job representation, and enter a dedicated workspace for that job.

This phase must stay aligned with the system direction defined in `skillgraph_cv_matcher_system.md`:

- the system should not only read JD text
- it should normalize skill structure
- it should preserve prerequisite and related-skill hints
- it should produce job data that is usable later by Neo4j and GAT

This phase does **not** yet implement candidate CV upload, ranking, scoring, or explanation output. It focuses on creating high-quality JD data as the foundation for those later steps.

## Scope

This design includes:

- JD PDF import in `Admin Jobs`
- support for text-based PDF only
- backend PDF text extraction for JD
- JD normalization into structured fields
- graph-ready `structured_jd_json`
- a fixed in-code skill taxonomy for canonicalization and relation hints
- a dedicated job workspace route
- an `Open Workspace` action from job cards
- continued support for manual `Create Job`

This design does not include:

- CV upload
- candidate-to-job linking
- matching execution
- ranking
- score explanation
- PDF report generation
- Neo4j write integration
- GAT execution
- OCR for scanned PDFs

## Product Direction

The workflow should become:

1. Recruiter enters `Admin Jobs`
2. Recruiter either:
   - creates a job manually
   - imports a JD PDF
3. If a JD PDF is imported successfully:
   - backend extracts text
   - backend normalizes the JD
   - backend creates a `job`
   - the job appears in the list
4. Recruiter clicks `Open Workspace`
5. Recruiter lands on `/jobs/[jobId]`
6. The workspace shows:
   - normalized JD sections
   - structured graph-ready metadata
   - raw JD text
   - placeholder for future CV upload

This turns a `job` into the core working unit of the product instead of a simple CRUD record.

## Route Structure

The route model should become:

- `/overview`
- `/admin/jobs`
- `/admin/candidates`
- `/jobs/[jobId]`

### `/admin/jobs`

Responsibilities:

- list jobs
- create jobs manually
- import JD PDFs
- navigate into the workspace for each job

### `/jobs/[jobId]`

Responsibilities:

- show normalized JD output
- show graph-ready structured data
- show source metadata and raw text
- reserve space for future candidate import and matching flow

## Admin Jobs UX

`Admin Jobs` should support both manual creation and import.

### Action hierarchy

- primary action: `Import JD PDF`
- secondary action: `Create Job`

Reasoning:

- import is the main workflow that supports later graph-aware matching
- manual creation remains useful for demo flexibility and fallback

### Job card actions

Each job card should expose:

- `Open Workspace`
- `Edit`
- `Delete`

`Open Workspace` is the primary action for the business workflow. `Edit` and `Delete` are secondary admin actions.

### Import interaction

The import action should open a drawer or panel with:

- file input
- note that only text-based PDFs are supported
- loading state during parse
- clear error state if extraction fails

## Import Contract

### Endpoint

`POST /api/jobs/import`

### Input

- `multipart/form-data`
- field: `file`

### Validation

- must be `.pdf`
- must be `application/pdf`
- must contain extractable text
- if extraction is empty or not readable enough, return `400`

### Failure behavior

If the PDF cannot be extracted as readable text:

- do not create a `job`
- return an explicit error message such as:
  - `Unable to extract readable text from PDF. Please upload a text-based PDF.`

This phase prioritizes data quality over preserving failed import history.

## PDF Parsing Strategy

The import pipeline should use text-based extraction only.

Recommended parser:

- `PyMuPDF` first

No OCR is included in this phase.

### Parsing stages

1. Extract raw text from PDF
2. Clean and normalize layout artifacts
3. Detect sections
4. Extract structured job information
5. Canonicalize skills through taxonomy
6. Build graph-ready `structured_jd_json`
7. Persist the `job`

## JD Normalization Strategy

The pipeline must not stop at `raw_jd_text`.

It should generate at least:

- `title`
- `description`
- `required_skills_text`
- `responsibilities_text`
- `qualifications_text`
- `structured_jd_json`

### Text cleanup

The parser should:

- trim excessive whitespace
- normalize broken line wrapping
- preserve bullet semantics where possible
- reduce repeated headers or footers when detectable

### Section detection

The parser should detect common section aliases such as:

- `Responsibilities`
- `Key Responsibilities`
- `What You Will Do`
- `Requirements`
- `Qualifications`
- `Required Skills`
- `Preferred Skills`
- `Nice to Have`
- `Overview`
- `Summary`

### Title extraction

The parser should infer a clean job title from the top of the document while removing obvious noise such as:

- company lines
- location lines
- decorative page labels

### Normalized text blocks

The parser should prioritize building clean text blocks for:

- summary or description
- responsibilities
- qualifications
- required skills

These blocks serve both UI display and later matching.

## Graph-ready JD Representation

`raw_jd_text` alone is not enough for Neo4j or GAT.

This phase must create a `structured_jd_json` field that stores graph-oriented structured data.

### Top-level shape

`structured_jd_json` should contain:

- `title`
- `summary`
- `required_skills`
- `responsibilities`
- `qualifications`
- `skill_groups`
- `soft_skills`
- `language_requirements`
- `experience_years`

### `required_skills`

Each required-skill item should include:

- `name`
- `canonical`
- `source`
- `section_origin`
- `aliases`
- `confidence`
- `importance`
- `requirement_type`
- `skill_groups`
- `prerequisites`
- `related_skills`
- `specializations`

Example:

```json
{
  "name": "Next.js",
  "canonical": "nextjs",
  "source": "exact_match",
  "section_origin": "required_skills",
  "aliases": ["NextJS"],
  "confidence": 0.96,
  "importance": 5,
  "requirement_type": "must_have",
  "skill_groups": ["frontend"],
  "prerequisites": ["react", "javascript"],
  "related_skills": ["ssr", "typescript"],
  "specializations": ["frontend_framework"]
}
```

### `responsibilities`

Each responsibility item should include:

- `text`
- `section_origin`
- `confidence`

### `qualifications`

Each qualification item should include:

- `text`
- `section_origin`
- `confidence`

### Why this structure matters

This structure is intentionally richer than a simple parsed JD because later phases need:

- canonical skill nodes for Neo4j
- prerequisite and related-skill edges
- feature-rich input for GAT
- weighted signals for matching explainability

## Fixed Skill Taxonomy

Relation hints in this phase should be driven by an in-code taxonomy, not by dynamic inference from free text.

Recommended module:

- `backend/app/services/skill_taxonomy.py`

Each taxonomy entry should define:

- `canonical`
- `display_name`
- `aliases`
- `skill_groups`
- `prerequisites`
- `related_skills`
- `specializations`

### Initial MVP taxonomy

The initial set should include:

- `python`
- `fastapi`
- `react`
- `nextjs`
- `typescript`
- `javascript`
- `postgresql`
- `mysql`
- `sql`
- `docker`
- `rest_api`
- `airflow`
- `dbt`
- `ssr`
- `git`
- `neo4j`

This list is intentionally small but sufficient for a coherent MVP demo.

## Skill Groups

Initial canonical skill groups should include:

- `backend`
- `frontend`
- `database`
- `devops`
- `cloud`
- `data`
- `ai_ml`
- `mobile`
- `testing`
- `security`
- `product`

These are useful both for future graph construction and for later UI explanations.

## Extraction Rules for Skill Metadata

### `source`

Allowed values:

- `exact_match`
- `alias_match`
- `inferred_from_context`

### `section_origin`

Allowed values:

- `title`
- `summary`
- `required_skills`
- `responsibilities`
- `qualifications`
- `global_scan`

### `confidence`

Recommended rule-based confidence mapping:

- `0.95`
  - exact skill found in `required_skills`
  - or explicit required bullet

- `0.85`
  - exact skill found in `qualifications` or `requirements`

- `0.75`
  - found in `responsibilities`

- `0.60`
  - found only in global scan

- `0.40`
  - weak contextual inference

### `importance`

Recommended mapping:

- `5`
  - explicit required skill
  - signals like `must have`, `required`, `mandatory`

- `4`
  - strong requirement in qualifications or requirements

- `3`
  - important operational skill mentioned in responsibilities

- `2`
  - weakly relevant supporting skill

- `1`
  - low-signal inferred skill

### `requirement_type`

Allowed values:

- `must_have`
- `nice_to_have`
- `contextual`

Recommended mapping:

- `must_have`
  - phrases like `must have`, `required`, `mandatory`, `strong experience in`

- `nice_to_have`
  - phrases like `preferred`, `plus`, `bonus`, `nice to have`

- `contextual`
  - skill appears as contextual signal but not explicit requirement

## Jobs Schema Expansion

The `jobs` table should retain the existing core fields and add import- and graph-ready fields.

### Existing fields kept

- `id`
- `title`
- `description`
- `required_skills_text`
- `status`
- `created_at`
- `updated_at`

### New fields

- `source_type`
- `source_file_name`
- `raw_jd_text`
- `responsibilities_text`
- `qualifications_text`
- `parse_status`
- `structured_jd_json`

### Allowed values

`source_type`:

- `manual`
- `jd_pdf`

`parse_status`:

- `processed`
- `failed`

In this phase, successful import should produce `processed`. Failed imports should not create a record.

### `structured_jd_json` column type

Recommended:

- PostgreSQL JSONB

This keeps the normalized graph-ready representation queryable and versionable without moving too early into separate relational tables.

## Job Workspace Screen

Route:

- `/jobs/[jobId]`

This screen should be the first true workflow-oriented page in the product.

### Sections

1. Header
- job title
- source type
- source file name
- parse status
- back action to `Admin Jobs`

2. Normalized JD
- summary or description
- required skills
- responsibilities
- qualifications

3. Structured Graph-ready Data
- rendered view of required skills
- skill groups
- relation hints such as prerequisites and related skills

4. Raw JD Text
- full extracted text
- scrollable area if long

5. Next Step Placeholder
- explicit note that candidate import and matching will be added in the next phase

### UX priority

Normalized and structured data should be shown before raw text. Raw text is secondary and mainly serves parse quality inspection.

## Manual Create Job Compatibility

Manual `Create Job` should remain available.

However:

- imported JD should be the primary workflow
- manually created jobs should still be able to open the same workspace route

For manually created jobs:

- `source_type` should be `manual`
- `parse_status` may be `processed` or a suitable equivalent
- `structured_jd_json` can be minimal or derived from entered text where feasible

## Verification

This phase should be considered complete when all of the following are true:

- a text-based JD PDF can be uploaded successfully
- the backend creates a `job` with normalized fields populated
- `structured_jd_json` is stored with graph-ready content
- non-readable PDFs fail cleanly without creating a record
- `Admin Jobs` shows both `Import JD PDF` and `Create Job`
- imported jobs appear as cards
- imported job cards expose `Open Workspace`
- `/jobs/[jobId]` renders normalized JD data
- `/jobs/[jobId]` renders structured graph-ready data
- `/jobs/[jobId]` renders raw JD text
- manual jobs still work and remain editable/deletable

## Alignment With System Design

This phase is intentionally designed to align with `skillgraph_cv_matcher_system.md`.

It contributes directly to the future system claim that:

- the system understands structured skills, not only text
- the system preserves prerequisite and related-skill semantics
- the system is preparing data for Neo4j and GAT

It does **not** yet complete the full promise of:

- CV evidence extraction
- candidate ranking
- explainable HR report generation

Those will require the next phases:

- CV import and evidence extraction
- graph construction in Neo4j
- matching execution
- ranking and explanation surfaces
