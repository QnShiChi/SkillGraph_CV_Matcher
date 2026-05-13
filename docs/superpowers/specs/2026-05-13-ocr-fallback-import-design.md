# OCR Fallback Import Design

## Goal

Upgrade the import pipeline so the system supports both:

- text-based PDFs with an existing text layer
- scanned or image-only PDFs through OCR fallback

This should apply to both JD import and CV import without changing the downstream parsing philosophy.

## Core Strategy

The import pipeline should remain:

- text-layer first
- OCR only when needed

That means:

1. try text extraction through `PyMuPDF`
2. if extracted text is usable, continue normally
3. if extracted text is empty or too weak, run OCR
4. send the recovered text into the existing parser path

This is the correct architecture because OCR should only replace the raw text extraction step, not the parser, taxonomy, or graph logic.

## Scope

### In scope

- OCR fallback for JD PDF import
- OCR fallback for CV PDF import
- local OCR with `Tesseract`
- `extract_source` metadata
- UI visibility for `text_layer` vs `ocr_fallback`

### Out of scope

- multilingual OCR beyond English
- handwriting OCR
- complex layout reconstruction
- async OCR job queue

## Import Pipeline

### Step 1: Text-layer extraction

Use `PyMuPDF` to extract text from the uploaded PDF.

If the text is usable:

- continue with the current parser path
- set `extract_source = text_layer`

### Step 2: OCR fallback

If the text is not usable:

- render PDF pages to images using `PyMuPDF`
- OCR those images with `Tesseract`
- combine OCR text into one normalized text string
- continue with the current parser path
- set `extract_source = ocr_fallback`

## OCR Trigger Rules

The first version should use a simple threshold, not a complex quality score.

Trigger OCR if:

- extracted text is empty after normalization
- or total extracted character count is less than `80`

This is intentionally simple and practical.

The goal is not perfect text quality scoring in phase one.  
The goal is to correctly detect the obvious scan/image PDFs that currently fail import.

## Dependencies

### Backend container

Add:

- `tesseract-ocr`
- `pytesseract`
- `Pillow`

`PyMuPDF` remains the PDF reader and page renderer.

No external OCR API is required in this phase.

## Metadata Changes

Add `extract_source` to imported records.

Suggested values:

- `text_layer`
- `ocr_fallback`

This should be stored for:

- jobs
- candidates

It is separate from `parse_source`.

### Meaning

- `extract_source` = where raw text came from
- `parse_source` = which parser path interpreted that text

Example:

- `extract_source = ocr_fallback`
- `parse_source = llm_hybrid`

That distinction is important for debugging quality.

## Data Model

### Jobs

Add:

- `extract_source`

### Candidates

Add:

- `extract_source`

This should be nullable for old rows and populated for new imports.

## UI Changes

Show `extract_source` in:

- job cards
- candidate cards
- job workspace metadata
- candidate/job import result summaries where relevant

Examples:

- `Extract: text_layer`
- `Extract: ocr_fallback`

This lets users and developers immediately tell whether a file came through the clean path or the OCR recovery path.

## JD Import Behavior

New behavior:

- text-based JD PDFs continue to work as before
- image-only JD PDFs should now be OCRed
- the parsed job should still go through:
  - rule-based or hybrid parse
  - structured JD normalization
  - taxonomy enrichment
  - Neo4j sync

The only change is where raw text comes from.

## CV Import Behavior

New behavior:

- text-based CV PDFs continue to work as before
- image-only CV PDFs should now be OCRed
- the parsed candidate should still go through:
  - rule-based or hybrid parse
  - structured CV normalization
  - evidence extraction
  - Neo4j sync

Again, OCR only replaces text extraction.

## Error Handling

If text-layer extraction fails and OCR also fails:

- reject that file
- return a clear message like:
  - `Unable to extract readable text from PDF, including OCR fallback.`

For batch import:

- one file failing OCR must not fail the full batch

## Testing

### Backend tests

- text-layer PDF still uses `extract_source = text_layer`
- empty-text PDF triggers OCR and returns `extract_source = ocr_fallback`
- OCR fallback works for candidate import
- OCR fallback works for JD import
- OCR failure returns the new readable error

### Runtime verification

Use one real image-only CV or JD PDF that currently fails.

Expected after this phase:

- import succeeds
- `extract_source = ocr_fallback`
- parser still returns structured data

## Expected Outcome

After this phase:

- text PDFs remain fast and clean
- image-only PDFs are no longer blocked immediately
- the system supports the two most common real-world PDF conditions
- debugging quality becomes easier because UI shows both `extract_source` and `parse_source`
