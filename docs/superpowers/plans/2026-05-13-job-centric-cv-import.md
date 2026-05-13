# Job-Centric CV Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move candidate import into the job workspace so CVs are imported directly under a specific job, persisted with `job_id`, and projected into Neo4j with `HAS_CANDIDATE`.

**Architecture:** Extend the candidate data model with `job_id`, add job-scoped candidate query and import endpoints, then move the import UI from global admin candidates into `/jobs/[jobId]`. Reuse the existing single-file and bulk candidate import core while threading `job_id` through persistence and graph sync.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, Pydantic, Neo4j, Next.js App Router, TypeScript

---

## File Structure

### Backend data/model files

- Modify: `backend/app/models/candidate.py`
- Modify: `backend/app/schemas/candidate.py`
- Modify: `backend/app/repositories/candidate_repository.py`
- Create: `backend/alembic/versions/20260513_01_add_job_id_to_candidates.py`

### Backend service and API files

- Modify: `backend/app/services/candidate_import_service.py`
- Modify: `backend/app/services/candidate_graph_sync.py`
- Modify: `backend/app/api/candidate_routes.py`
- Modify: `backend/app/api/job_routes.py`

### Backend tests

- Modify: `backend/tests/services/test_candidate_import_service.py`
- Modify: `backend/tests/services/test_candidate_graph_sync.py`
- Modify: `backend/tests/api/test_candidate_import_api.py`
- Modify: `backend/tests/api/test_job_import_api.py`

### Frontend files

- Modify: `frontend/lib/api.ts`
- Modify: `frontend/app/(dashboard)/jobs/[jobId]/page.tsx` or current route file for the workspace loader
- Modify: `frontend/components/jobs/job-workspace.tsx`
- Create or modify: `frontend/components/jobs/job-candidate-import-panel.tsx`
- Create or modify: `frontend/components/jobs/job-candidate-list.tsx`
- Modify: `frontend/components/candidates/candidate-admin-client.tsx`

### Docs

- Modify: `README.md`

---

### Task 1: Add `job_id` to Candidate Persistence

**Files:**
- Modify: `backend/app/models/candidate.py`
- Modify: `backend/app/schemas/candidate.py`
- Modify: `backend/app/repositories/candidate_repository.py`
- Create: `backend/alembic/versions/20260513_01_add_job_id_to_candidates.py`
- Test: `backend/tests/api/test_candidate_import_api.py`

- [ ] **Step 1: Write the failing test for candidate payloads carrying `job_id`**

```python
def test_import_candidate_pdf_returns_job_id(client, session, monkeypatch) -> None:
    job = create_job_fixture(session, title="Backend Engineer")
    pdf_bytes = _make_text_pdf_bytes("Nguyen Van A\nSummary\nPython engineer")

    response = client.post(
        f"/api/jobs/{job.id}/candidates/import",
        files={"file": ("candidate.pdf", BytesIO(pdf_bytes), "application/pdf")},
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["job_id"] == job.id
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
source .venv/bin/activate && python -m pytest backend/tests/api/test_candidate_import_api.py::test_import_candidate_pdf_returns_job_id -v
```

Expected: FAIL because candidate model and job-scoped route do not include `job_id` yet.

- [ ] **Step 3: Add `job_id` to model, schema, repository, and migration**

```python
# backend/app/models/candidate.py
from sqlalchemy import ForeignKey

job_id: Mapped[int | None] = mapped_column(ForeignKey("jobs.id"), nullable=True, index=True)
```

```python
# backend/app/schemas/candidate.py
class CandidateRead(BaseModel):
    ...
    job_id: int | None
```

```python
# backend/app/repositories/candidate_repository.py
def list_candidates_for_job(session: Session, job_id: int) -> list[Candidate]:
    statement = (
        select(Candidate)
        .where(Candidate.job_id == job_id)
        .order_by(Candidate.created_at.desc())
    )
    return list(session.scalars(statement).all())
```

```python
# migration
def upgrade() -> None:
    op.add_column("candidates", sa.Column("job_id", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_candidates_job_id"), "candidates", ["job_id"], unique=False)
    op.create_foreign_key(
        "fk_candidates_job_id_jobs",
        "candidates",
        "jobs",
        ["job_id"],
        ["id"],
    )
```

- [ ] **Step 4: Run compile and migration checks**

Run:

```bash
python3 -m compileall backend/app
docker compose up -d postgres backend
make migrate
```

Expected: PASS, migration applies cleanly.

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/candidate.py backend/app/schemas/candidate.py backend/app/repositories/candidate_repository.py backend/alembic/versions/20260513_01_add_job_id_to_candidates.py
git commit -m "feat: add job ownership to candidates"
```

### Task 2: Thread `job_id` Through Candidate Import Services

**Files:**
- Modify: `backend/app/services/candidate_import_service.py`
- Modify: `backend/app/repositories/candidate_repository.py`
- Test: `backend/tests/services/test_candidate_import_service.py`

- [ ] **Step 1: Write the failing service tests for job-scoped candidate creation**

```python
def test_import_candidate_pdf_assigns_job_id(session, monkeypatch) -> None:
    job = create_job_fixture(session, title="Backend Engineer")
    upload = _make_upload_file("Nguyen Van A\nSummary\nPython engineer")

    def _fake_sync(candidate, *, settings):
        del settings
        return {"status": "synced", "error": None, "synced_at": candidate.created_at}

    monkeypatch.setattr("app.services.candidate_import_service.sync_candidate_to_graph", _fake_sync)

    candidate = import_candidate_pdf(
        session,
        upload,
        job_id=job.id,
        settings=_make_settings(cv_parser_mode="rule_based"),
    )

    assert candidate.job_id == job.id
```

```python
def test_import_candidates_bulk_assigns_job_id(session, monkeypatch) -> None:
    job = create_job_fixture(session, title="Backend Engineer")
    files = [_make_upload_file("Nguyen Van A\nSummary\nPython engineer")]

    def _fake_sync(candidate, *, settings):
        del settings
        return {"status": "synced", "error": None, "synced_at": candidate.created_at}

    monkeypatch.setattr("app.services.candidate_import_service.sync_candidate_to_graph", _fake_sync)

    result = import_candidates_bulk(
        session,
        files,
        job_id=job.id,
        settings=_make_settings(cv_parser_mode="rule_based"),
    )

    assert result["results"][0]["candidate_id"] is not None
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
source .venv/bin/activate && python -m pytest backend/tests/services/test_candidate_import_service.py -v
```

Expected: FAIL because import functions do not accept `job_id`.

- [ ] **Step 3: Add `job_id` parameters and persist ownership**

```python
def import_candidate_pdf(
    session: Session,
    file: UploadFile,
    *,
    job_id: int,
    settings: Settings | None = None,
    client: OpenRouterClient | None = None,
):
    ...
    candidate = create_imported_candidate(
        session,
        parsed=parsed,
        source_file_name=file.filename or "uploaded.pdf",
        job_id=job_id,
    )
```

```python
def create_imported_candidate(
    session: Session,
    *,
    parsed: dict,
    source_file_name: str,
    job_id: int,
) -> Candidate:
    candidate = Candidate(
        ...,
        job_id=job_id,
    )
```

Apply the same `job_id` threading to `import_candidates_bulk(...)`.

- [ ] **Step 4: Run tests to verify candidate import still passes**

Run:

```bash
source .venv/bin/activate && python -m pytest backend/tests/services/test_candidate_import_service.py backend/tests/api/test_candidate_import_api.py -v
```

Expected: PASS after updating tests and imports.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/candidate_import_service.py backend/app/repositories/candidate_repository.py backend/tests/services/test_candidate_import_service.py backend/tests/api/test_candidate_import_api.py
git commit -m "feat: scope candidate imports to jobs"
```

### Task 3: Add Job-Scoped Candidate APIs

**Files:**
- Modify: `backend/app/api/job_routes.py`
- Modify: `backend/app/api/candidate_routes.py`
- Modify: `backend/tests/api/test_candidate_import_api.py`
- Modify: `backend/tests/api/test_job_import_api.py`

- [ ] **Step 1: Write failing tests for job-scoped list and import routes**

```python
def test_get_job_candidates_returns_only_job_scoped_candidates(client, session) -> None:
    job = create_job_fixture(session, title="Backend Engineer")
    other_job = create_job_fixture(session, title="Frontend Engineer")
    create_candidate_fixture(session, job_id=job.id, full_name="Alice")
    create_candidate_fixture(session, job_id=other_job.id, full_name="Bob")

    response = client.get(f"/api/jobs/{job.id}/candidates")

    assert response.status_code == 200
    payload = response.json()
    assert [item["full_name"] for item in payload] == ["Alice"]
```

```python
def test_import_candidate_pdf_returns_404_for_missing_job(client) -> None:
    pdf_bytes = _make_text_pdf_bytes("Nguyen Van A\nSummary\nPython engineer")
    response = client.post(
        "/api/jobs/99999/candidates/import",
        files={"file": ("candidate.pdf", BytesIO(pdf_bytes), "application/pdf")},
    )

    assert response.status_code == 404
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
source .venv/bin/activate && python -m pytest backend/tests/api/test_candidate_import_api.py backend/tests/api/test_job_import_api.py -v
```

Expected: FAIL because job-scoped candidate routes do not exist.

- [ ] **Step 3: Add job-scoped routes**

```python
@router.get("/{job_id}/candidates", response_model=list[CandidateRead])
def get_job_candidates(job_id: int, session: Session = Depends(get_db_session)) -> list[CandidateRead]:
    job = get_job_by_id(session, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found.")
    return list_candidates_for_job(session, job_id)


@router.post("/{job_id}/candidates/import", response_model=CandidateRead, status_code=status.HTTP_201_CREATED)
def import_job_candidate(job_id: int, file: UploadFile = File(...), session: Session = Depends(get_db_session)) -> CandidateRead:
    job = get_job_by_id(session, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found.")
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only PDF uploads are supported.")
    return import_candidate_pdf(session, file, job_id=job_id)
```

Add the bulk variant:

```python
@router.post("/{job_id}/candidates/import-bulk", response_model=CandidateBulkImportResponse)
def import_job_candidates_bulk(...):
    ...
```

In `candidate_routes.py`, remove import CTA support only after frontend stops calling those routes. Do not break read/update/delete there yet.

- [ ] **Step 4: Run API tests to verify they pass**

Run:

```bash
source .venv/bin/activate && python -m pytest backend/tests/api/test_candidate_import_api.py backend/tests/api/test_job_import_api.py -v
```

Expected: PASS for job-scoped list and import routes.

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/job_routes.py backend/app/api/candidate_routes.py backend/tests/api/test_candidate_import_api.py backend/tests/api/test_job_import_api.py
git commit -m "feat: add job-scoped candidate routes"
```

### Task 4: Add `HAS_CANDIDATE` to Candidate Graph Sync

**Files:**
- Modify: `backend/app/services/candidate_graph_sync.py`
- Modify: `backend/tests/services/test_candidate_graph_sync.py`

- [ ] **Step 1: Write the failing graph sync test**

```python
def test_build_candidate_graph_payload_includes_job_candidate_edge() -> None:
    candidate = candidate_fixture(
        id=7,
        job_id=3,
        full_name="Nguyen Van A",
        structured_cv_json={
            "technical_skills": [
                {
                    "canonical": "python",
                    "name": "Python",
                    "confidence": 0.95,
                    "section_origin": "experience",
                    "classification_target": "technical_skills",
                    "evidence": [{"text": "Built Python APIs.", "section_origin": "experience", "confidence": 0.95}],
                }
            ],
            "platforms_cloud": [],
            "tooling_devops": [],
        },
    )

    payload = build_candidate_graph_payload(candidate)

    assert payload["job_candidate_edge"]["job_id"] == 3
    assert payload["job_candidate_edge"]["candidate_id"] == 7
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
source .venv/bin/activate && python -m pytest backend/tests/services/test_candidate_graph_sync.py -v
```

Expected: FAIL because graph payload does not include the job-candidate relation yet.

- [ ] **Step 3: Add the job-candidate projection**

```python
def build_candidate_graph_payload(candidate: Candidate) -> dict[str, Any]:
    ...
    return {
        "candidate": candidate_payload,
        "skills": skills,
        "has_skill_edges": has_skill_edges,
        "job_candidate_edge": {
            "job_id": candidate.job_id,
            "candidate_id": candidate.id,
        } if candidate.job_id is not None else None,
    }
```

In the Neo4j sync query, merge:

```cypher
MATCH (j:Job {job_id: $job_id})
MATCH (c:Candidate {candidate_id: $candidate_id})
MERGE (j)-[:HAS_CANDIDATE]->(c)
```

- [ ] **Step 4: Run graph sync tests**

Run:

```bash
source .venv/bin/activate && python -m pytest backend/tests/services/test_candidate_graph_sync.py -v
```

Expected: PASS and existing `HAS_SKILL` assertions remain green.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/candidate_graph_sync.py backend/tests/services/test_candidate_graph_sync.py
git commit -m "feat: add job candidate graph edge"
```

### Task 5: Move Import UI into Job Workspace

**Files:**
- Modify: `frontend/lib/api.ts`
- Modify: `frontend/components/jobs/job-workspace.tsx`
- Create or modify: `frontend/components/jobs/job-candidate-import-panel.tsx`
- Create or modify: `frontend/components/jobs/job-candidate-list.tsx`

- [ ] **Step 1: Add frontend API helpers for job-scoped candidates**

```ts
export async function getJobCandidates(jobId: number): Promise<Candidate[]> {
  const response = await fetch(`${getApiBaseUrl()}/api/jobs/${jobId}/candidates`, {
    cache: "no-store",
  });
  if (!response.ok) {
    return [];
  }
  return (await response.json()) as Candidate[];
}

export async function importJobCandidatesBulk(
  jobId: number,
  files: File[],
): Promise<CandidateBulkImportResponse> {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  const response = await fetch(`${getApiBaseUrl()}/api/jobs/${jobId}/candidates/import-bulk`, {
    method: "POST",
    body: formData,
  });
  ...
}
```

- [ ] **Step 2: Create workspace candidate import panel**

```tsx
export function JobCandidateImportPanel({
  jobId,
  onImported,
}: {
  jobId: number;
  onImported: (result: CandidateBulkImportResponse) => Promise<void> | void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleImport(files: File[]) {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const result = await importJobCandidatesBulk(jobId, files);
      await onImported(result);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to import candidate batch.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return <CvImportForm isSubmitting={isSubmitting} errorMessage={errorMessage} onCancel={() => setErrorMessage(null)} onSubmit={handleImport} />;
}
```

- [ ] **Step 3: Render job-scoped candidate list in the workspace**

```tsx
export function JobCandidateList({ candidates }: { candidates: Candidate[] }) {
  return (
    <section className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--color-brand)]">
        Imported Candidates
      </p>
      {candidates.map((candidate) => (
        <article key={candidate.id} className="rounded-[24px] border border-[var(--color-border)] bg-white/90 p-5">
          <h3 className="text-xl font-semibold text-[var(--color-text)]">{candidate.full_name}</h3>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            {candidate.parse_source} · {candidate.graph_sync_status}
          </p>
        </article>
      ))}
    </section>
  );
}
```

Thread these into `job-workspace.tsx` so the page shows:

- Candidate Import
- Batch result summary
- Imported Candidates

- [ ] **Step 4: Run frontend production build**

Run:

```bash
docker run --rm skillgraphcvmatcher-frontend npm run build
```

Expected: PASS with `/jobs/[jobId]` still building.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/api.ts frontend/components/jobs/job-workspace.tsx frontend/components/jobs/job-candidate-import-panel.tsx frontend/components/jobs/job-candidate-list.tsx
git commit -m "feat: move candidate import into job workspace"
```

### Task 6: Demote Global Admin Candidates Import Flow

**Files:**
- Modify: `frontend/components/candidates/candidate-admin-client.tsx`

- [ ] **Step 1: Remove import CTA and import drawer from admin candidates**

```tsx
<PageHeader
  eyebrow="Admin"
  title="Candidates"
  description="Review candidate records that were imported through job workspaces."
  action={
    <button
      type="button"
      onClick={openCreateDrawer}
      className="rounded-[14px] border border-[var(--color-border)] px-5 py-3 text-sm font-semibold text-[var(--color-text)]"
    >
      Create Candidate
    </button>
  }
/>
```

Remove:

- `Import CV PDF` button
- import drawer state
- batch import summary from this page

- [ ] **Step 2: Update supporting copy**

```tsx
<StateCard
  title="Workflow"
  description="Candidates are now imported from job workspaces, then reviewed here as a supporting admin view."
/>
```

- [ ] **Step 3: Run frontend production build**

Run:

```bash
docker run --rm skillgraphcvmatcher-frontend npm run build
```

Expected: PASS with `/admin/candidates` still rendering cleanly.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/candidates/candidate-admin-client.tsx
git commit -m "refactor: demote global candidate import flow"
```

### Task 7: Update Docs and Run End-to-End Verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the documented workflow**

```md
## Job-Centric CV Import Workflow

1. Open `http://localhost:3000/admin/jobs`
2. Choose a job and open its workspace
3. Import one or more CV PDFs from `/jobs/[jobId]`
4. Review batch result summary in the workspace
5. Review imported candidates under the same job
6. Inspect Neo4j for `HAS_CANDIDATE` and `HAS_SKILL`
```

Also update limitations to note that candidates are currently job-owned and not reused across multiple jobs.

- [ ] **Step 2: Run full backend verification**

Run:

```bash
source .venv/bin/activate && python -m pytest backend/tests/services backend/tests/api -v
```

Expected: PASS.

- [ ] **Step 3: Run compile and config checks**

Run:

```bash
python3 -m compileall backend/app backend/tests frontend/components/jobs frontend/components/candidates frontend/lib
docker compose config
```

Expected: PASS.

- [ ] **Step 4: Run runtime smoke test**

Run:

```bash
curl -s -X POST http://localhost:8000/api/jobs/18/candidates/import-bulk \
  -F files=@/tmp/candidate-hybrid-test.pdf \
  -F files=@/tmp/bad-bulk-cv.txt
```

Expected: JSON showing one imported candidate and one failed item, both scoped to `job_id=18`.

Then verify Neo4j:

```bash
docker compose exec -T neo4j cypher-shell -u neo4j -p skillgraph_neo4j_password \
"MATCH (j:Job {job_id: 18})-[:HAS_CANDIDATE]->(c:Candidate) RETURN j.job_id, c.candidate_id, c.full_name;"
```

Expected: at least one candidate connected to the job through `HAS_CANDIDATE`.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: add job-centric candidate import workflow"
```
