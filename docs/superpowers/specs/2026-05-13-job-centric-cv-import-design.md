# Job-Centric CV Import Design

## Goal

Move CV import and bulk CV import out of the global `Admin Candidates` flow and into the job workspace so candidates are created directly under a specific job from the start.

This phase makes candidate ingestion align with the real recruiter workflow:

1. choose a job
2. enter the job workspace
3. import one or many CVs for that job
4. inspect imported candidates in the same workspace

## Scope

### In scope

- add `job_id` to `candidates`
- move CV import and bulk CV import into `/jobs/[jobId]`
- add job-scoped candidate APIs
- create candidates directly under a job
- show imported candidates inside the job workspace
- add `(:Job)-[:HAS_CANDIDATE]->(:Candidate)` to Neo4j sync
- remove `Admin Candidates` as the primary import flow

### Out of scope

- candidate reuse across multiple jobs
- candidate deduplication between jobs
- ranking or explanation
- candidate transfer between jobs

## Product Direction

The current global candidate import flow is operational but product-wise wrong for the intended matching system.

The system is already job-centric on the JD side:

- import JD into a specific job
- inspect graph-ready job data in `/jobs/[jobId]`

Candidate import should follow the same shape.

## Data Model

### Candidates

Add:

- `job_id`

Behavior:

- candidates created from workspace import must always carry a `job_id`
- older rows may remain nullable for compatibility
- new workspace-driven CV import should treat `job_id` as required

This keeps the persistence model simple and avoids introducing a separate join table before candidate reuse is needed.

## API Design

### New endpoints

- `GET /api/jobs/{job_id}/candidates`
- `POST /api/jobs/{job_id}/candidates/import`
- `POST /api/jobs/{job_id}/candidates/import-bulk`

### Behavior

`GET /api/jobs/{job_id}/candidates`

- returns only candidates belonging to that job

`POST /api/jobs/{job_id}/candidates/import`

- imports one text-based CV PDF
- creates one candidate with `job_id`

`POST /api/jobs/{job_id}/candidates/import-bulk`

- imports multiple CV PDFs
- creates each successful candidate with `job_id`
- keeps partial success semantics

### Response model

Candidate read responses should include:

- `job_id`

The existing bulk response model can be reused, but each successful item should represent a candidate created under the target job.

## Frontend Route Design

### Job workspace

Keep `/jobs/[jobId]` as the main route.

Add two new sections:

1. `Candidate Import`
2. `Imported Candidates`

### Candidate Import section

This section should support:

- single-file CV import
- bulk CV import
- batch result summary

This becomes the primary ingestion surface for candidates.

### Imported Candidates section

This section should render only candidates linked to the current job.

Each candidate card should show:

- name
- parse source
- parse confidence
- graph sync status
- grouped skill preview
- evidence sample

## Admin Candidates Role

`Admin Candidates` should stop being the primary import workflow.

Recommended direction for this phase:

- remove import CTA from `Admin Candidates`
- keep the page as a supporting admin view

That avoids mixed UX where candidates can be imported both globally and job-scoped.

## Neo4j Projection

Current candidate sync already creates:

- `(:Candidate)-[:HAS_SKILL]->(:Skill)`

This phase should add:

- `(:Job)-[:HAS_CANDIDATE]->(:Candidate)`

Resulting job-centric graph shape:

- `(:Job)-[:REQUIRES]->(:Skill)`
- `(:Job)-[:HAS_CANDIDATE]->(:Candidate)`
- `(:Candidate)-[:HAS_SKILL]->(:Skill)`
- `(:Skill)-[:PREREQUISITE_OF]->(:Skill)`

This is the right graph base for future matching.

## Backend Flow

Single-file flow:

1. user is in `/jobs/[jobId]`
2. upload one CV
3. validate `job_id`
4. parse CV
5. create candidate with `job_id`
6. sync candidate graph
7. create `HAS_CANDIDATE` edge from job to candidate

Bulk flow:

1. user is in `/jobs/[jobId]`
2. upload multiple CVs
3. process each file independently
4. each successful file creates candidate with `job_id`
5. each successful candidate syncs into graph
6. batch result returns per-file outcomes

## Error Handling

If `job_id` does not exist:

- return `404`

If one file fails in a bulk import:

- mark only that file failed
- continue the rest

If candidate graph sync fails:

- keep candidate row
- set `graph_sync_status=failed`
- still associate candidate to job in PostgreSQL

## Testing

### Backend

- candidate import under valid job creates candidate with `job_id`
- `GET /api/jobs/{job_id}/candidates` filters correctly
- bulk import under job keeps partial success behavior
- invalid `job_id` returns `404`
- graph sync adds `HAS_CANDIDATE`

### Frontend

- `/jobs/[jobId]` shows candidate import controls
- importing CV refreshes job-scoped candidate list
- batch result summary appears in workspace
- `Admin Candidates` no longer exposes import as the primary action

## Recommended Implementation Shape

Backend:

- extend `Candidate` model and schema with `job_id`
- add repository helpers for job-scoped candidate listing
- add job-scoped candidate import routes
- adapt candidate graph sync payload to include `HAS_CANDIDATE`

Frontend:

- move `CvImportForm` usage into the job workspace
- add job-scoped candidate fetch
- add imported candidate panel to `/jobs/[jobId]`
- remove import CTA from `Admin Candidates`

## Expected Outcome

After this phase:

- recruiter enters a specific job workspace before importing candidates
- every imported candidate belongs to that job immediately
- graph structure reflects job-to-candidate ownership
- the system is better prepared for job-scoped matching
