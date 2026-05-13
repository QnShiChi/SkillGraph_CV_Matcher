# Bulk CV Import Design

## Goal

Add batch CV ingestion so recruiters can upload multiple text-based CV PDFs in one action, get per-file import results, and avoid re-running the current one-file flow manually for each candidate.

This phase should improve operational throughput without changing the core parsing philosophy:

- each CV is still parsed independently
- each candidate is still stored independently
- each candidate is still synced independently to Neo4j

## Scope

### In scope

- upload multiple CV PDFs in one request
- import each file independently
- keep partial success if some files fail
- return per-file result status and error details
- update admin candidates UI to show batch result feedback
- reuse the current CV parser modes:
  - `rule_based`
  - `llm_hybrid`
  - `rule_based_fallback`
- keep current candidate graph projection behavior

### Out of scope

- job-scoped candidate assignment
- candidate ranking or matching
- OCR for scanned PDFs
- async background queue
- resume deduplication
- retry queue or batch history table

## Why This Phase

The current CV import is operationally correct but recruiter-hostile for real usage because:

- it accepts only one file per request
- importing a stack of CVs requires repetitive manual work
- one bad file should not block all the good files

The correct next step is batch ingestion, not matching yet.

## Batch Import Behavior

The system should accept multiple files in one import action and process them one by one.

Rules:

- every file is validated independently
- every file is parsed independently
- every candidate record is created independently
- every graph sync is run independently
- one failed file must not fail the whole batch

### Success model

A batch request can end in one of three overall states:

- full success
- partial success
- full failure

But the API contract should remain per-file, not per-batch summary only.

## API Design

### New endpoint

- `POST /api/candidates/import-bulk`

### Request

- `multipart/form-data`
- field:
  - `files`

The client sends multiple PDF files under the same field name.

### File validation

Each file must be validated separately:

- content type must be `application/pdf`
- filename should end with `.pdf`
- readable text must be extractable

If one file fails validation:

- mark only that file as failed
- continue processing the remaining files

### Response shape

The response should be a structured batch result, not just a list of candidates.

Top-level fields:

- `total_files`
- `success_count`
- `failed_count`
- `results`

Each result item:

- `filename`
- `status`
- `candidate_id`
- `parse_source`
- `parse_confidence`
- `graph_sync_status`
- `error`

Suggested `status` values:

- `imported`
- `failed`

Example:

```json
{
  "total_files": 3,
  "success_count": 2,
  "failed_count": 1,
  "results": [
    {
      "filename": "alice.pdf",
      "status": "imported",
      "candidate_id": 14,
      "parse_source": "llm_hybrid",
      "parse_confidence": 0.94,
      "graph_sync_status": "synced",
      "error": null
    },
    {
      "filename": "bob.pdf",
      "status": "failed",
      "candidate_id": null,
      "parse_source": null,
      "parse_confidence": null,
      "graph_sync_status": null,
      "error": "Unable to extract readable text from CV. Please upload a text-based PDF."
    }
  ]
}
```

## Backend Flow

The current single-file import flow should remain the source of truth for one file.

The bulk endpoint should be a thin orchestration layer around the existing single-file import service.

Flow:

1. receive multiple uploaded files
2. iterate over files
3. validate file type
4. call the existing candidate import service for each file
5. collect success/failure result for that file
6. return aggregate batch response

This keeps behavior consistent between:

- `POST /api/candidates/import`
- `POST /api/candidates/import-bulk`

## Parser and OpenRouter Behavior

Bulk import should not introduce a separate parser path.

Each file uses the same runtime parser mode as single-file import:

- `CV_PARSER_MODE=rule_based`
- `CV_PARSER_MODE=hybrid`
- `CV_PARSER_MODE=llm_only`

Fallback rules remain identical:

- if `hybrid` fails and fallback is enabled, use `rule_based_fallback`
- if one file fails at LLM level and fallback is disabled, mark only that file as failed

This is important because a batch request must not collapse into a single global parser failure.

## Database Behavior

No new batch table is required in this phase.

Each successfully imported file creates one `candidates` row exactly as the single-file flow already does.

Failed files:

- do not create a candidate row

This keeps the persistence model simple and avoids speculative schema expansion before we need batch history.

## Neo4j Behavior

Each successfully imported candidate continues to sync independently to Neo4j.

Behavior:

- candidate import succeeds in PostgreSQL first
- candidate graph sync runs after that
- if graph sync fails for one candidate:
  - keep the candidate row
  - set `graph_sync_status=failed`
  - include that status in the batch result item

This means a batch can contain mixed outcomes such as:

- imported + graph synced
- imported + graph sync failed
- file import failed entirely

That distinction must remain visible in the response and UI.

## Frontend Design

### Admin Candidates

The existing `Import CV PDF` interaction should evolve into multi-file selection instead of a separate parallel feature.

Behavior:

- allow selecting multiple PDF files in one action
- submit them together
- show batch result summary after import

### Result feedback

After submission, the UI should display:

- total uploaded files
- success count
- failed count
- a flat result list per file

Each item should show:

- filename
- imported or failed state
- candidate name if available
- parse source if imported
- graph sync state if imported
- error text if failed

### Refresh behavior

After batch import finishes:

- refresh the candidate list
- newly imported candidates should appear in the existing admin cards

This is enough for the first phase. No progress bar or live per-file streaming is required yet.

## Error Handling

The backend must never abort the full batch because one file is invalid.

Per-file failure cases:

- non-PDF file
- unreadable PDF
- parser failure without fallback
- unexpected import exception

For unexpected exceptions:

- record failure for that file
- continue processing the rest
- return a safe error string

The API should still return `200` for a partial-success batch because the request itself completed successfully.

Suggested response semantics:

- `200 OK` when at least one file was processed and results are returned
- result items carry the actual per-file status

This is more practical than forcing `207 Multi-Status`, and easier for frontend handling.

## Testing

### Backend tests

- batch endpoint imports multiple valid PDFs successfully
- batch endpoint returns mixed success/failure when one file is unreadable
- batch endpoint continues when one file is non-PDF
- hybrid parser path still works inside batch import
- graph sync failure for one candidate is surfaced only for that item

### Frontend verification

- multi-file picker works
- submitting 2-3 files returns visible summary
- failed files show error text
- successful files appear in candidate list after refresh

## Recommended Implementation Shape

Backend:

- keep `import_candidate_pdf(...)` as the single-file core
- add `import_candidates_bulk(...)` service that loops over files
- add response schema for batch result
- add `POST /api/candidates/import-bulk`

Frontend:

- replace single-file CV import form with multi-file upload
- submit files to new bulk endpoint
- render batch result summary panel

This is the cleanest path because it extends the current flow instead of duplicating it.

## Future Follow-up

This phase is sufficient before moving on to candidate-job association and matching.

Natural next steps after this:

- bind imported candidates to a specific job workspace
- add bulk import directly inside `/jobs/[jobId]`
- add candidate deduplication
- add asynchronous background processing for very large batches
