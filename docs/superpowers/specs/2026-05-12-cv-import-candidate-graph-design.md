# CV Import and Candidate Graph Projection Design

## Goal

Add the candidate side of the system so imported CVs can be parsed into structured, evidence-backed skill data and projected into Neo4j using the same canonical skill language as imported job descriptions.

This phase is the bridge from a `JD-only graph` to a `Job + Candidate graph` that can support matching later.

## Scope

### In scope

- import candidate CVs from text-based PDF
- extract raw CV text
- parse CV into structured candidate data
- canonicalize candidate skills using the same taxonomy as JD parsing
- capture evidence for extracted candidate skills
- store parsed candidate data in PostgreSQL
- sync candidate graph-safe skill data to Neo4j
- expose candidate graph status in API and UI

### Out of scope

- candidate-job ranking
- score calculation
- explanation generation for HR
- interview question generation
- OCR support for scanned CV PDFs

## Candidate Data Model

The current `candidates` table is too thin for graph-aware ingestion, so it should be expanded.

### Existing fields

- `id`
- `full_name`
- `email`
- `resume_text`
- `skills_text`
- `status`
- `created_at`
- `updated_at`

### New fields

- `source_type`
- `source_file_name`
- `parse_status`
- `parse_source`
- `parse_confidence`
- `structured_cv_json`
- `graph_sync_status`
- `graph_sync_error`
- `graph_synced_at`

Suggested values:

- `source_type`
  - `manual`
  - `cv_pdf`

- `parse_status`
  - `processed`
  - `failed`

- `parse_source`
  - `manual`
  - `rule_based`
  - `llm_hybrid`
  - `rule_based_fallback`

- `graph_sync_status`
  - `pending`
  - `synced`
  - `failed`

## Structured CV Shape

`structured_cv_json` should preserve both graph-ready skills and evidence.

Top-level shape:

- `summary`
- `technical_skills`
- `platforms_cloud`
- `tooling_devops`
- `competencies`
- `soft_skills`
- `experience`
- `education`
- `language_requirements`

### Skill item shape

Each skill item should include:

- `name`
- `canonical`
- `source`
- `section_origin`
- `aliases`
- `confidence`
- `skill_groups`
- `prerequisites`
- `related_skills`
- `specializations`
- `evidence`

### Evidence shape

Each extracted skill should carry evidence such as:

- `text`
- `section_origin`
- `confidence`

Example:

```json
{
  "name": "Python",
  "canonical": "python",
  "confidence": 0.95,
  "section_origin": "experience",
  "evidence": [
    {
      "text": "Built Python APIs for candidate matching services.",
      "section_origin": "experience",
      "confidence": 0.92
    }
  ]
}
```

## Parser Strategy

The CV parser should follow the same philosophy as the JD parser:

- extract text with `PyMuPDF`
- preprocess sections locally
- optionally use `OpenRouter` hybrid parsing
- canonicalize through taxonomy
- attach prerequisites and related skills only through taxonomy

### Text-based PDF only

This phase should support only text-based CV PDFs.

If readable text cannot be extracted:

- reject the import
- do not create the candidate

## Candidate Skill Taxonomy

The candidate parser must use the same taxonomy as the JD parser.

This is critical because later matching depends on both sides sharing:

- the same canonical names
- the same prerequisite graph
- the same related-skill semantics

## Neo4j Projection Model

Only graph-safe candidate groups are projected:

- `technical_skills`
- `platforms_cloud`
- `tooling_devops`

### Nodes

`Candidate`

- `candidate_id`
- `full_name`
- `source_type`
- `parse_source`
- `parse_confidence`
- `status`

`Skill`

- reuse existing `Skill` nodes by `canonical`

### Edges

`(:Candidate)-[:HAS_SKILL]->(:Skill)`

Properties:

- `confidence`
- `section_origin`
- `category`
- `evidence_count`

Optional evidence text should remain primarily in PostgreSQL, not bloated into the graph projection.

## Sync Timing

Sync to Neo4j happens automatically after a successful CV import.

Flow:

1. upload CV PDF
2. extract and parse candidate data
3. save candidate in PostgreSQL
4. sync graph-safe skill data to Neo4j
5. update `graph_sync_status`

If graph sync fails:

- keep the candidate in PostgreSQL
- set `graph_sync_status=failed`
- store `graph_sync_error`

## API Changes

New endpoint:

- `POST /api/candidates/import`

Candidate read responses should include:

- `source_type`
- `source_file_name`
- `parse_status`
- `parse_source`
- `parse_confidence`
- `structured_cv_json`
- `graph_sync_status`
- `graph_sync_error`
- `graph_synced_at`

## Frontend Changes

### Admin Candidates

Add:

- `Import CV PDF` action
- graph sync status on candidate cards
- provenance metadata similar to jobs

### Candidate Workspace or Detail View

At minimum, expose:

- normalized CV summary
- grouped candidate skills
- evidence snippets
- graph sync status

If a dedicated candidate workspace route is deferred, use admin detail cards first.

## Verification

### Backend

- import a text-based CV PDF
- confirm `structured_cv_json` is populated
- confirm candidate skills are canonicalized
- confirm evidence exists for extracted skills
- confirm graph sync metadata is returned

### Neo4j

After importing a candidate:

- `MATCH (c:Candidate) RETURN c.candidate_id, c.full_name`
- `MATCH (c:Candidate {candidate_id: <id>})-[r:HAS_SKILL]->(s:Skill) RETURN c, r, s`

Expected:

- a `Candidate` node exists
- `HAS_SKILL` edges exist to graph-safe skills
- the graph reuses shared `Skill` nodes where canonicals overlap with jobs

### Frontend

- admin candidates page shows imported candidate and graph sync status
- candidate detail view shows grouped parsed skills and evidence

## Expected Outcome

After this phase:

- the system no longer has only the JD half of the graph
- candidates are imported into the same canonical skill space
- evidence is preserved for explainability
- the graph becomes ready for later job-candidate matching
