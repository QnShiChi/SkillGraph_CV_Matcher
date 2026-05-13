# Bulk CV Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multi-file CV import so recruiters can upload multiple CV PDFs in one action, receive per-file success or failure results, and keep candidate parsing and Neo4j projection independent per file.

**Architecture:** Reuse the existing single-file candidate import service as the source of truth and add a thin bulk orchestration layer on top of it. The backend returns a batch result envelope with per-file outcomes, while the frontend upgrades the current single-file CV import form into a multi-file batch workflow that refreshes the candidate list after completion.

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic, PyMuPDF, OpenRouter hybrid parser, Next.js App Router, TypeScript

---

## File Structure

### Backend files

- Modify: `backend/app/schemas/candidate.py`
  - add batch import response models and typed per-file result objects
- Modify: `backend/app/services/candidate_import_service.py`
  - add bulk orchestration that loops over uploaded files and reuses the single-file import core
- Modify: `backend/app/api/candidate_routes.py`
  - add `POST /api/candidates/import-bulk`
- Modify: `backend/tests/services/test_candidate_import_service.py`
  - add batch success and mixed-result tests
- Modify: `backend/tests/api/test_candidate_import_api.py`
  - add endpoint tests for multi-file import and partial failure behavior

### Frontend files

- Modify: `frontend/lib/api.ts`
  - add batch import API client types and request helper
- Modify: `frontend/components/candidates/cv-import-form.tsx`
  - switch to multi-file selection and batch submit
- Modify: `frontend/components/candidates/candidate-admin-client.tsx`
  - store and render batch result summary

### Docs

- Modify: `README.md`
  - update CV workflow to describe bulk import and partial success behavior

---

### Task 1: Define Batch Import Contract

**Files:**
- Modify: `backend/app/schemas/candidate.py`
- Test: `backend/tests/api/test_candidate_import_api.py`

- [ ] **Step 1: Write the failing API test for batch response shape**

```python
def test_import_candidate_bulk_returns_batch_result(client) -> None:
    response = client.post(
        "/api/candidates/import-bulk",
        files=[
            ("files", ("one.pdf", BytesIO(_make_text_pdf_bytes("Nguyen Van A\nSummary\nPython engineer")), "application/pdf")),
            ("files", ("two.pdf", BytesIO(_make_text_pdf_bytes("Tran Thi B\nSummary\nFastAPI engineer")), "application/pdf")),
        ],
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["total_files"] == 2
    assert payload["success_count"] == 2
    assert payload["failed_count"] == 0
    assert len(payload["results"]) == 2
    assert payload["results"][0]["status"] == "imported"
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
source .venv/bin/activate && python -m pytest backend/tests/api/test_candidate_import_api.py::test_import_candidate_bulk_returns_batch_result -v
```

Expected: FAIL with `404` or missing schema fields because `/api/candidates/import-bulk` does not exist yet.

- [ ] **Step 3: Add batch response models**

```python
from typing import Any, Literal


CandidateImportItemStatus = Literal["imported", "failed"]


class CandidateBulkImportItem(BaseModel):
    filename: str
    status: CandidateImportItemStatus
    candidate_id: int | None
    candidate_name: str | None
    parse_source: CandidateParseSource | None
    parse_confidence: float | None
    graph_sync_status: CandidateGraphSyncStatus | None
    error: str | None


class CandidateBulkImportResponse(BaseModel):
    total_files: int
    success_count: int
    failed_count: int
    results: list[CandidateBulkImportItem]
```

- [ ] **Step 4: Run test to verify the new types import cleanly**

Run:

```bash
python3 -m compileall backend/app/schemas/candidate.py
```

Expected: PASS with no syntax errors.

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas/candidate.py backend/tests/api/test_candidate_import_api.py
git commit -m "feat: add candidate bulk import response schema"
```

### Task 2: Add Bulk Candidate Import Service

**Files:**
- Modify: `backend/app/services/candidate_import_service.py`
- Test: `backend/tests/services/test_candidate_import_service.py`

- [ ] **Step 1: Write the failing service tests for batch success and mixed failure**

```python
def test_import_candidates_bulk_returns_per_file_results(session, monkeypatch) -> None:
    files = [
        _make_upload_file("Nguyen Van A\nSummary\nPython engineer"),
        _make_upload_file("Tran Thi B\nSummary\nFastAPI engineer"),
    ]

    def _fake_sync(candidate, *, settings):
        del settings
        return {"status": "synced", "error": None, "synced_at": candidate.created_at}

    monkeypatch.setattr("app.services.candidate_import_service.sync_candidate_to_graph", _fake_sync)

    result = import_candidates_bulk(session, files, settings=_make_settings(cv_parser_mode="rule_based"))

    assert result["total_files"] == 2
    assert result["success_count"] == 2
    assert result["failed_count"] == 0
    assert {item["status"] for item in result["results"]} == {"imported"}


def test_import_candidates_bulk_continues_when_one_file_fails(session, monkeypatch) -> None:
    files = [
        _make_upload_file("Nguyen Van A\nSummary\nPython engineer"),
        UploadFile(file=BytesIO(b"not a pdf"), filename="broken.pdf", headers=Headers({"content-type": "application/pdf"})),
    ]

    def _fake_sync(candidate, *, settings):
        del settings
        return {"status": "synced", "error": None, "synced_at": candidate.created_at}

    monkeypatch.setattr("app.services.candidate_import_service.sync_candidate_to_graph", _fake_sync)

    result = import_candidates_bulk(session, files, settings=_make_settings(cv_parser_mode="rule_based"))

    assert result["total_files"] == 2
    assert result["success_count"] == 1
    assert result["failed_count"] == 1
    assert any(item["filename"] == "broken.pdf" and item["status"] == "failed" for item in result["results"])
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
source .venv/bin/activate && python -m pytest backend/tests/services/test_candidate_import_service.py::test_import_candidates_bulk_returns_per_file_results backend/tests/services/test_candidate_import_service.py::test_import_candidates_bulk_continues_when_one_file_fails -v
```

Expected: FAIL because `import_candidates_bulk` does not exist yet.

- [ ] **Step 3: Implement bulk orchestration around the existing single-file importer**

```python
def import_candidates_bulk(
    session: Session,
    files: list[UploadFile],
    *,
    settings: Settings | None = None,
    client: OpenRouterClient | None = None,
) -> dict:
    resolved_settings = settings or get_settings()
    results: list[dict] = []
    success_count = 0
    failed_count = 0

    for file in files:
        filename = file.filename or "uploaded.pdf"
        try:
            candidate = import_candidate_pdf(
                session,
                file,
                settings=resolved_settings,
                client=client,
            )
            results.append(
                {
                    "filename": filename,
                    "status": "imported",
                    "candidate_id": candidate.id,
                    "candidate_name": candidate.full_name,
                    "parse_source": candidate.parse_source,
                    "parse_confidence": candidate.parse_confidence,
                    "graph_sync_status": candidate.graph_sync_status,
                    "error": None,
                }
            )
            success_count += 1
        except ValueError as error:
            results.append(
                {
                    "filename": filename,
                    "status": "failed",
                    "candidate_id": None,
                    "candidate_name": None,
                    "parse_source": None,
                    "parse_confidence": None,
                    "graph_sync_status": None,
                    "error": str(error),
                }
            )
            failed_count += 1

    return {
        "total_files": len(files),
        "success_count": success_count,
        "failed_count": failed_count,
        "results": results,
    }
```

- [ ] **Step 4: Run the service tests to verify they pass**

Run:

```bash
source .venv/bin/activate && python -m pytest backend/tests/services/test_candidate_import_service.py -v
```

Expected: PASS, including the new batch tests and existing single-file tests.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/candidate_import_service.py backend/tests/services/test_candidate_import_service.py
git commit -m "feat: add bulk candidate import service"
```

### Task 3: Expose Bulk Import Endpoint

**Files:**
- Modify: `backend/app/api/candidate_routes.py`
- Test: `backend/tests/api/test_candidate_import_api.py`

- [ ] **Step 1: Extend API tests for mixed success and invalid content types**

```python
def test_import_candidate_bulk_returns_partial_success(client) -> None:
    good_pdf = _make_text_pdf_bytes("Nguyen Van A\nSummary\nPython engineer")
    response = client.post(
        "/api/candidates/import-bulk",
        files=[
            ("files", ("good.pdf", BytesIO(good_pdf), "application/pdf")),
            ("files", ("bad.txt", BytesIO(b"oops"), "text/plain")),
        ],
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["total_files"] == 2
    assert payload["success_count"] == 1
    assert payload["failed_count"] == 1
    assert any(item["filename"] == "bad.txt" and item["status"] == "failed" for item in payload["results"])
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
source .venv/bin/activate && python -m pytest backend/tests/api/test_candidate_import_api.py -v
```

Expected: FAIL because `/api/candidates/import-bulk` is not registered yet.

- [ ] **Step 3: Add the FastAPI route**

```python
@router.post("/import-bulk", response_model=CandidateBulkImportResponse, status_code=status.HTTP_200_OK)
def import_candidates_bulk_endpoint(
    files: list[UploadFile] = File(...),
    session: Session = Depends(get_db_session),
) -> CandidateBulkImportResponse:
    if not files:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one PDF file is required.")

    for file in files:
        if file.content_type != "application/pdf":
            continue

    result = import_candidates_bulk(session, files)
    return CandidateBulkImportResponse(**result)
```

Add the same per-file PDF validation behavior as the single-file endpoint by letting bad files fail inside the service rather than rejecting the whole batch request.

- [ ] **Step 4: Run API tests to verify they pass**

Run:

```bash
source .venv/bin/activate && python -m pytest backend/tests/api/test_candidate_import_api.py -v
```

Expected: PASS for single-file and bulk import scenarios.

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/candidate_routes.py backend/tests/api/test_candidate_import_api.py
git commit -m "feat: add candidate bulk import endpoint"
```

### Task 4: Add Frontend Batch Import Client and UI

**Files:**
- Modify: `frontend/lib/api.ts`
- Modify: `frontend/components/candidates/cv-import-form.tsx`
- Modify: `frontend/components/candidates/candidate-admin-client.tsx`

- [ ] **Step 1: Add the API helper and TypeScript response types**

```ts
export type CandidateBulkImportItem = {
  filename: string;
  status: "imported" | "failed";
  candidate_id: number | null;
  candidate_name: string | null;
  parse_source: Candidate["parse_source"] | null;
  parse_confidence: number | null;
  graph_sync_status: Candidate["graph_sync_status"] | null;
  error: string | null;
};

export type CandidateBulkImportResponse = {
  total_files: number;
  success_count: number;
  failed_count: number;
  results: CandidateBulkImportItem[];
};

export async function importCandidatesBulk(files: File[]): Promise<CandidateBulkImportResponse> {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  return fetchJson<CandidateBulkImportResponse>("/api/candidates/import-bulk", {
    method: "POST",
    body: formData,
  });
}
```

- [ ] **Step 2: Upgrade the import form to accept multiple files**

```tsx
type CvImportFormProps = {
  onImported: (result: CandidateBulkImportResponse) => Promise<void> | void;
};

<input
  type="file"
  accept="application/pdf,.pdf"
  multiple
  onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
/>
```

On submit:

```tsx
const result = await importCandidatesBulk(files);
await onImported(result);
setFiles([]);
```

- [ ] **Step 3: Render batch summary in the admin client**

```tsx
const [lastImportResult, setLastImportResult] = useState<CandidateBulkImportResponse | null>(null);

async function handleImported(result: CandidateBulkImportResponse) {
  setLastImportResult(result);
  await refreshCandidates();
}
```

Render:

```tsx
{lastImportResult ? (
  <section className="rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-[0_18px_60px_rgba(76,29,149,0.08)]">
    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-600">Batch Import Result</p>
    <h3 className="mt-3 text-2xl font-semibold text-slate-950">
      {lastImportResult.success_count} imported / {lastImportResult.failed_count} failed
    </h3>
    <div className="mt-4 space-y-3">
      {lastImportResult.results.map((item) => (
        <div key={`${item.filename}-${item.candidate_id ?? "failed"}`} className="rounded-2xl border border-slate-200 px-4 py-3">
          <p className="font-medium text-slate-950">{item.filename}</p>
          <p className="text-sm text-slate-600">
            {item.status === "imported"
              ? `${item.candidate_name ?? "Candidate"} · ${item.parse_source ?? "unknown"} · graph ${item.graph_sync_status ?? "pending"}`
              : item.error ?? "Import failed."}
          </p>
        </div>
      ))}
    </div>
  </section>
) : null}
```

- [ ] **Step 4: Run production build to verify the UI passes**

Run:

```bash
docker run --rm skillgraphcvmatcher-frontend npm run build
```

Expected: PASS with the candidate admin route still building successfully.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/api.ts frontend/components/candidates/cv-import-form.tsx frontend/components/candidates/candidate-admin-client.tsx
git commit -m "feat: add bulk CV import UI"
```

### Task 5: Update Docs and Run End-to-End Verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the CV workflow docs**

```md
## Bulk CV Import Workflow

1. Open `http://localhost:3000/admin/candidates`
2. Use `Import CV PDF` to select multiple text-based PDF files
3. Submit the batch
4. Review:
   - total files
   - success count
   - failed count
   - per-file parse source and graph sync state
5. Confirm imported candidates appear in the admin list
```

Also update the limitations section to say batch import exists, but job-scoped candidate assignment and matching do not.

- [ ] **Step 2: Run full backend tests**

Run:

```bash
source .venv/bin/activate && python -m pytest backend/tests/services backend/tests/api -v
```

Expected: PASS for all candidate and JD tests.

- [ ] **Step 3: Run config and compile verification**

Run:

```bash
docker compose config
python3 -m compileall backend/app backend/tests frontend/components/candidates frontend/lib
```

Expected: PASS with no syntax or compose errors.

- [ ] **Step 4: Run runtime smoke test with a mixed batch**

Run:

```bash
curl -s -X POST http://localhost:8000/api/candidates/import-bulk \
  -F file=@/tmp/one.pdf \
  -F file=@/tmp/two.pdf
```

Replace the payload to use the actual `files` field once the route is implemented:

```bash
curl -s -X POST http://localhost:8000/api/candidates/import-bulk \
  -F files=@/tmp/one.pdf \
  -F files=@/tmp/two.pdf
```

Expected: JSON batch response with `total_files=2` and per-file result entries.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: add bulk CV import workflow"
```
