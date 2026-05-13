# OCR Fallback Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add OCR fallback so JD and CV imports succeed for image-only PDFs while preserving the existing text-layer-first parser and graph sync behavior.

**Architecture:** Keep `PyMuPDF` as the first extractor for PDFs and add a shared OCR fallback service that renders pages to images and runs `Tesseract` only when extracted text is empty or too short. Thread `extract_source` through imported jobs and candidates, then expose it in API responses and UI metadata.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, PyMuPDF, Tesseract OCR, pytesseract, Pillow, OpenRouter hybrid parser, Next.js

---

## File Structure

### Backend dependencies and config

- Modify: `backend/Dockerfile`
- Modify: `backend/requirements.txt`

### Backend models and schemas

- Modify: `backend/app/models/job.py`
- Modify: `backend/app/models/candidate.py`
- Modify: `backend/app/schemas/job.py`
- Modify: `backend/app/schemas/candidate.py`
- Create: `backend/alembic/versions/20260513_02_add_extract_source_to_imports.py`

### Backend OCR and import services

- Create: `backend/app/services/pdf_text_extractor.py`
- Modify: `backend/app/services/job_import_service.py`
- Modify: `backend/app/services/candidate_import_service.py`

### Backend tests

- Create or modify: `backend/tests/services/test_pdf_text_extractor.py`
- Modify: `backend/tests/services/test_job_import_service.py`
- Modify: `backend/tests/services/test_candidate_import_service.py`
- Modify: `backend/tests/api/test_job_import_api.py`
- Modify: `backend/tests/api/test_candidate_import_api.py`

### Frontend

- Modify: `frontend/lib/api.ts`
- Modify: `frontend/components/jobs/job-list.tsx`
- Modify: `frontend/components/jobs/job-workspace.tsx`
- Modify: `frontend/components/candidates/candidate-list.tsx`
- Modify: `frontend/components/jobs/job-candidate-panel.tsx`

### Docs

- Modify: `README.md`

---

### Task 1: Add OCR Dependencies

**Files:**
- Modify: `backend/Dockerfile`
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Add the failing import check mentally before editing**

The current image-only CV batch already proves the failure mode:

- `PyMuPDF` returns zero text
- parser raises `Unable to extract readable text from CV. Please upload a text-based PDF.`

This is the failing baseline the OCR phase is supposed to fix.

- [ ] **Step 2: Add Tesseract and Python OCR libraries**

In `backend/Dockerfile`, extend the image setup with system packages such as:

```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    libtesseract-dev \
    && rm -rf /var/lib/apt/lists/*
```

In `backend/requirements.txt`, add:

```txt
pytesseract==0.3.13
Pillow==11.2.1
```

- [ ] **Step 3: Rebuild backend image to verify dependencies install**

Run:

```bash
docker compose build backend
```

Expected: PASS, backend image rebuilds successfully with OCR dependencies.

- [ ] **Step 4: Commit**

```bash
git add backend/Dockerfile backend/requirements.txt
git commit -m "build: add OCR dependencies for PDF fallback"
```

### Task 2: Add `extract_source` to Imported Records

**Files:**
- Modify: `backend/app/models/job.py`
- Modify: `backend/app/models/candidate.py`
- Modify: `backend/app/schemas/job.py`
- Modify: `backend/app/schemas/candidate.py`
- Create: `backend/alembic/versions/20260513_02_add_extract_source_to_imports.py`

- [ ] **Step 1: Write failing schema-level expectations**

Add to API tests assertions like:

```python
assert payload["extract_source"] in {"text_layer", "ocr_fallback"}
```

for both job and candidate import responses.

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
source .venv/bin/activate && python -m pytest backend/tests/api/test_job_import_api.py backend/tests/api/test_candidate_import_api.py -v
```

Expected: FAIL because `extract_source` is missing from models and responses.

- [ ] **Step 3: Add `extract_source` to models, schemas, and migration**

Model fields:

```python
extract_source: Mapped[str | None] = mapped_column(String(50), nullable=True)
```

Schema fields:

```python
extract_source: str | None
```

Migration:

```python
op.add_column("jobs", sa.Column("extract_source", sa.String(length=50), nullable=True))
op.add_column("candidates", sa.Column("extract_source", sa.String(length=50), nullable=True))
```

- [ ] **Step 4: Apply migration and run compile checks**

Run:

```bash
python3 -m compileall backend/app
make migrate
```

Expected: PASS, migration applies cleanly.

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/job.py backend/app/models/candidate.py backend/app/schemas/job.py backend/app/schemas/candidate.py backend/alembic/versions/20260513_02_add_extract_source_to_imports.py
git commit -m "feat: track extract source for imported files"
```

### Task 3: Build Shared PDF Extractor with OCR Fallback

**Files:**
- Create: `backend/app/services/pdf_text_extractor.py`
- Test: `backend/tests/services/test_pdf_text_extractor.py`

- [ ] **Step 1: Write the failing extractor tests**

```python
def test_extract_pdf_text_prefers_text_layer() -> None:
    pdf_bytes = make_text_pdf_bytes("Hello from text PDF")
    result = extract_pdf_text(pdf_bytes)

    assert result["extract_source"] == "text_layer"
    assert "Hello from text PDF" in result["raw_text"]


def test_extract_pdf_text_falls_back_to_ocr_when_text_layer_empty(monkeypatch) -> None:
    pdf_bytes = make_image_only_pdf_bytes("scan placeholder")

    monkeypatch.setattr(
        "app.services.pdf_text_extractor._ocr_pdf_pages",
        lambda document: "Recovered OCR text",
    )

    result = extract_pdf_text(pdf_bytes)

    assert result["extract_source"] == "ocr_fallback"
    assert result["raw_text"] == "Recovered OCR text"
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
source .venv/bin/activate && python -m pytest backend/tests/services/test_pdf_text_extractor.py -v
```

Expected: FAIL because the shared extractor does not exist yet.

- [ ] **Step 3: Implement the extractor**

Skeleton:

```python
MIN_TEXT_LENGTH = 80


def extract_pdf_text(pdf_bytes: bytes) -> dict[str, str]:
    if not pdf_bytes:
        raise ValueError("Unable to extract readable text from PDF, including OCR fallback.")

    try:
        document = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as error:
        raise ValueError("Unable to extract readable text from PDF, including OCR fallback.") from error

    try:
        raw_text = "\n".join(page.get_text("text") for page in document).strip()
        if _is_text_usable(raw_text):
          return {"raw_text": raw_text, "extract_source": "text_layer"}

        ocr_text = _ocr_pdf_pages(document).strip()
        if _is_text_usable(ocr_text):
          return {"raw_text": ocr_text, "extract_source": "ocr_fallback"}
    finally:
        document.close()

    raise ValueError("Unable to extract readable text from PDF, including OCR fallback.")
```

OCR helper:

```python
def _ocr_pdf_pages(document: fitz.Document) -> str:
    chunks: list[str] = []
    for page in document:
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
        image = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        text = pytesseract.image_to_string(image, lang="eng")
        if text.strip():
            chunks.append(text.strip())
    return "\n".join(chunks)
```

- [ ] **Step 4: Run extractor tests**

Run:

```bash
source .venv/bin/activate && python -m pytest backend/tests/services/test_pdf_text_extractor.py -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/pdf_text_extractor.py backend/tests/services/test_pdf_text_extractor.py
git commit -m "feat: add OCR fallback PDF text extractor"
```

### Task 4: Switch JD Import to Shared Extractor

**Files:**
- Modify: `backend/app/services/job_import_service.py`
- Modify: `backend/tests/services/test_job_import_service.py`
- Modify: `backend/tests/api/test_job_import_api.py`

- [ ] **Step 1: Add failing JD tests for `extract_source`**

Example:

```python
assert job.extract_source == "text_layer"
```

and mocked OCR path:

```python
monkeypatch.setattr(
    "app.services.job_import_service.extract_pdf_text",
    lambda pdf_bytes: {"raw_text": "Recovered OCR job text", "extract_source": "ocr_fallback"},
)
```

- [ ] **Step 2: Run JD tests to verify they fail**

Run:

```bash
source .venv/bin/activate && python -m pytest backend/tests/services/test_job_import_service.py backend/tests/api/test_job_import_api.py -v
```

Expected: FAIL because `job_import_service` still uses raw `PyMuPDF` extraction and does not persist `extract_source`.

- [ ] **Step 3: Replace direct extraction with the shared helper**

Inside `import_job_pdf(...)`:

```python
from app.services.pdf_text_extractor import extract_pdf_text

extracted = extract_pdf_text(pdf_bytes)
raw_text = extracted["raw_text"]
extract_source = extracted["extract_source"]
```

Before persistence:

```python
parsed["extract_source"] = extract_source
```

Ensure repository/model persistence path stores the new key.

- [ ] **Step 4: Run JD verification**

Run:

```bash
source .venv/bin/activate && python -m pytest backend/tests/services/test_job_import_service.py backend/tests/api/test_job_import_api.py -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/job_import_service.py backend/tests/services/test_job_import_service.py backend/tests/api/test_job_import_api.py
git commit -m "feat: add OCR fallback to JD import"
```

### Task 5: Switch CV Import to Shared Extractor

**Files:**
- Modify: `backend/app/services/candidate_import_service.py`
- Modify: `backend/tests/services/test_candidate_import_service.py`
- Modify: `backend/tests/api/test_candidate_import_api.py`

- [ ] **Step 1: Add failing CV tests for `extract_source` and OCR fallback**

Examples:

```python
assert candidate.extract_source == "text_layer"
```

and mocked OCR path:

```python
monkeypatch.setattr(
    "app.services.candidate_import_service.extract_pdf_text",
    lambda pdf_bytes: {"raw_text": "Recovered OCR CV text", "extract_source": "ocr_fallback"},
)
```

- [ ] **Step 2: Run CV tests to verify they fail**

Run:

```bash
source .venv/bin/activate && python -m pytest backend/tests/services/test_candidate_import_service.py backend/tests/api/test_candidate_import_api.py -v
```

Expected: FAIL because candidate import still does local `PyMuPDF` extraction.

- [ ] **Step 3: Replace direct extraction with the shared helper**

Inside `import_candidate_pdf(...)`:

```python
from app.services.pdf_text_extractor import extract_pdf_text

extracted = extract_pdf_text(pdf_bytes)
raw_text = extracted["raw_text"]
extract_source = extracted["extract_source"]
parsed["extract_source"] = extract_source
```

Persist `extract_source` through `create_imported_candidate(...)`.

- [ ] **Step 4: Run CV verification**

Run:

```bash
source .venv/bin/activate && python -m pytest backend/tests/services/test_candidate_import_service.py backend/tests/api/test_candidate_import_api.py -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/candidate_import_service.py backend/tests/services/test_candidate_import_service.py backend/tests/api/test_candidate_import_api.py
git commit -m "feat: add OCR fallback to CV import"
```

### Task 6: Expose `extract_source` in UI

**Files:**
- Modify: `frontend/lib/api.ts`
- Modify: `frontend/components/jobs/job-list.tsx`
- Modify: `frontend/components/jobs/job-workspace.tsx`
- Modify: `frontend/components/candidates/candidate-list.tsx`
- Modify: `frontend/components/jobs/job-candidate-panel.tsx`

- [ ] **Step 1: Add `extract_source` to frontend types**

```ts
extract_source: "text_layer" | "ocr_fallback" | null;
```

for both `Job` and `Candidate`.

- [ ] **Step 2: Render `extract_source` in job and candidate metadata**

Examples:

```tsx
<span>Extract {job.extract_source ?? "N/A"}</span>
```

```tsx
<span>Extract {candidate.extract_source ?? "N/A"}</span>
```

and in job workspace batch summaries where relevant.

- [ ] **Step 3: Run frontend production build**

Run:

```bash
docker run --rm skillgraphcvmatcher-frontend npm run build
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/api.ts frontend/components/jobs/job-list.tsx frontend/components/jobs/job-workspace.tsx frontend/components/candidates/candidate-list.tsx frontend/components/jobs/job-candidate-panel.tsx
git commit -m "feat: show extract source in import UI"
```

### Task 7: Update Docs and Run Runtime OCR Verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update workflow documentation**

Add notes that:

- imports now try `text_layer` first
- OCR fallback is automatic for image-only PDFs
- `extract_source` is visible in the UI

Add a short section:

```md
If a scanned PDF is uploaded, the system will automatically fall back to OCR and mark the record with `extract_source=ocr_fallback`.
```

- [ ] **Step 2: Run full backend test suite**

Run:

```bash
source .venv/bin/activate && python -m pytest backend/tests/services backend/tests/api -v
```

Expected: PASS.

- [ ] **Step 3: Run compile/config verification**

Run:

```bash
python3 -m compileall backend/app backend/tests frontend/components/jobs frontend/components/candidates frontend/lib
docker compose config
```

Expected: PASS.

- [ ] **Step 4: Rebuild and smoke test with a real image-only CV**

Run:

```bash
docker compose up --build -d backend frontend
make migrate
curl -s -X POST http://localhost:8000/api/jobs/18/candidates/import-bulk \
  -F 'files=@/home/phan-duong-quoc-nhat/Downloads/CV_IT/Intern.pdf;type=application/pdf'
```

Expected:

- batch succeeds with `success_count=1`
- returned candidate has:
  - `extract_source = ocr_fallback`
  - `parse_source = llm_hybrid` or `rule_based_fallback`

Then verify Neo4j:

```bash
docker compose exec -T neo4j cypher-shell -u neo4j -p skillgraph_neo4j_password \
"MATCH (j:Job {job_id: 18})-[:HAS_CANDIDATE]->(c:Candidate) RETURN j.job_id, c.candidate_id, c.full_name ORDER BY c.candidate_id DESC LIMIT 5;"
```

Expected: imported OCR-backed candidate appears in the job graph.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: add OCR fallback import workflow"
```
