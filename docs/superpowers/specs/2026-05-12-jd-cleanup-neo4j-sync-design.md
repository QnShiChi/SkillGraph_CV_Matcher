# JD Cleanup and Neo4j Sync Design

## Goal

Improve the JD parsing output so graph-safe data is cleaner, then automatically project imported jobs into Neo4j without polluting the graph with unstable competency and context signals.

This phase has two sequential objectives:

1. tighten parser output for `competencies`, `role_descriptors`, and `required_skills_text`
2. automatically sync graph-safe JD data to Neo4j after a successful import

## Scope

### In scope

- parser cleanup for future JD imports
- rebuild `required_skills_text` to exclude `role_descriptors`
- deduplicate and normalize noisy role/context descriptors
- downgrade selected noisy competency items from `must_have` to `contextual`
- add graph sync status fields to the `jobs` table
- auto-sync imported JDs to Neo4j
- create Neo4j nodes and edges for graph-safe categories only
- surface graph sync status in backend responses and frontend UI

### Out of scope

- re-parsing existing jobs
- syncing `competencies`, `role_descriptors`, or `soft_skills` into Neo4j
- candidate CV ingestion
- matching, ranking, scoring, or explanation generation
- GAT training or graph embedding generation

## Parser Cleanup

### `required_skills_text`

`required_skills_text` should only be built from:

- `technical_skills`
- `platforms_cloud`
- `tooling_devops`
- `competencies`

It must not include:

- `role_descriptors`
- `soft_skills`

The text remains recruiter-friendly, but no longer mixes role context such as remote work or contract mode into the primary skill summary.

### `competencies`

`competencies` remain in PostgreSQL for explainability and future reasoning, but should be less aggressive.

Cleanup rules:

- keep engineering capability items that materially help interpretation
- downgrade noisy delivery/process items from `must_have` to `contextual` where appropriate
- avoid duplicating the same concept across multiple near-identical labels

Examples to downgrade or treat cautiously:

- `code_reviews`
- `architectural_planning`
- `performance_optimization`
- `software_development_lifecycle`

### `role_descriptors`

`role_descriptors` should be normalized and deduplicated more aggressively.

Examples of clusters that should collapse:

- `remote_work`
- `distributed_collaboration`
- `remote_collaborative_environment`
- `independent_work_in_a_distributed_setting`

Target behavior:

- retain a smaller set of canonical context descriptors
- keep them in `structured_jd_json`
- exclude them from graph sync
- exclude them from `required_skills_text`

### Prerequisite policy

Prerequisites remain taxonomy-driven only.

Allowed graph prerequisite enrichment:

- `technical_skills`
- selected `tooling_devops`
- selected `platforms_cloud` when taxonomy is explicit

Not allowed:

- `competencies`
- `role_descriptors`
- `soft_skills`

## Database Changes

Extend `jobs` with:

- `graph_sync_status`
- `graph_sync_error`
- `graph_synced_at`

Suggested status values:

- `pending`
- `synced`
- `failed`

Behavior:

- import success writes the job into PostgreSQL first
- graph projection runs immediately after
- graph sync failure does not roll back the imported job

## Neo4j Projection Model

Only graph-safe categories are synced:

- `technical_skills`
- `platforms_cloud`
- `tooling_devops`

### Nodes

`Job`

- `job_id`
- `title`
- `source_type`
- `parse_source`
- `parse_confidence`
- `status`

`Skill`

- `canonical`
- `display_name`
- `category`

### Edges

`(:Job)-[:REQUIRES]->(:Skill)`

Properties:

- `importance`
- `requirement_type`
- `confidence`
- `section_origin`
- `category`

`(:Skill)-[:PREREQUISITE_OF]->(:Skill)`

Properties:

- optional lightweight metadata from taxonomy if useful

`(:Skill)-[:RELATED_TO]->(:Skill)`

Optional in this phase. If added, it must come only from taxonomy, not LLM inference.

## Graph Sync Timing

Graph sync happens automatically after a successful JD import.

Import lifecycle:

1. receive PDF
2. extract and parse JD
3. persist job in PostgreSQL
4. project graph-safe data into Neo4j
5. update `graph_sync_status`

If Neo4j sync fails:

- keep the job
- set `graph_sync_status=failed`
- store `graph_sync_error`

## Backend Changes

### Services

Add a dedicated graph projection service, for example:

- `backend/app/services/job_graph_sync.py`

Responsibilities:

- build Neo4j payload from graph-safe structured JD categories
- upsert `Job` node
- upsert `Skill` nodes
- upsert `REQUIRES` edges
- upsert taxonomy-based `PREREQUISITE_OF` edges
- return sync status and error details

### Import flow

`job_import_service` should:

- run parser cleanup rules
- create the job record
- call graph sync service
- update sync status fields on the job

### API responses

Job responses should include:

- `graph_sync_status`
- `graph_sync_error`
- `graph_synced_at`

## Frontend Changes

### Admin Jobs

Each imported job card should show graph sync state:

- `Graph synced`
- `Graph pending`
- `Graph failed`

If failed, show a short error hint without overwhelming the card.

### Job Workspace

`/jobs/[jobId]` should show:

- parser provenance as today
- graph sync status
- graph sync error if present
- graph synced timestamp if present

The grouped structured data UI remains, but role/context noise should now appear less prominently due to parser cleanup.

## Verification

### Backend

- import a new JD and confirm `required_skills_text` excludes `role_descriptors`
- confirm grouped categories still populate correctly
- confirm selected competency items are downgraded to `contextual`
- confirm job response includes graph sync fields
- confirm graph sync failure does not delete the imported job

### Neo4j

After importing a JD:

- `MATCH (j:Job {job_id: <id>}) RETURN j`
- `MATCH (j:Job {job_id: <id>})-[r:REQUIRES]->(s:Skill) RETURN j, r, s`
- `MATCH (s1:Skill)-[r:PREREQUISITE_OF]->(s2:Skill) RETURN s1, r, s2 LIMIT 25`

Expected:

- a `Job` node exists
- only graph-safe skill categories are present as `Skill` nodes from the import
- prerequisite edges exist only where taxonomy defines them

### Frontend

- `/admin/jobs` shows graph sync status on imported jobs
- `/jobs/[jobId]` shows graph sync metadata
- grouped skill sections still render correctly

## Expected Outcome

After this phase:

- future JD imports produce cleaner structured data
- graph-safe skills are projected automatically into Neo4j
- competency and role-context noise stays out of the core graph
- the system is ready to move from JD parsing into visible graph-backed functionality
