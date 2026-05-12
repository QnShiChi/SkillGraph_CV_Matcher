# Hybrid LLM JD Parsing via OpenRouter Design

## Goal

Upgrade the current JD PDF import pipeline from pure rule-based normalization to a hybrid parsing architecture that uses:
- `PyMuPDF` for text extraction
- rule-based preprocessing and section hints
- `OpenRouter` with a configurable `OpenAI` model for structured JD parsing
- taxonomy-backed post-processing for graph-ready skill normalization

The resulting parsed job data must remain suitable for:
- PostgreSQL persistence
- future Neo4j graph sync
- future GAT-based matching
- future HR explainability reports

This phase also adds UI signals in the job workspace for parse provenance and confidence.

## Scope

### In scope
- Add `OpenRouter` configuration through `.env`
- Add a hybrid LLM parser path for JD import
- Keep the current rule-based parser as fallback
- Extend `jobs` persistence with parse provenance/confidence
- Show `parse_source` and `parse_confidence` in the job workspace
- Preserve the current import flow and manual job creation flow

### Out of scope
- CV import
- candidate ranking
- match scoring
- explanation report generation
- Neo4j graph writes during import

## External dependency choice

Use `OpenRouter` as the LLM gateway with an OpenAI model configured from environment variables.

Recommended default:
- `OPENROUTER_MODEL=openai/gpt-5.5`

Do not hardcode the model in code.

## Environment configuration

Add the following backend environment variables:
- `OPENROUTER_API_KEY`
- `OPENROUTER_BASE_URL=https://openrouter.ai/api/v1`
- `OPENROUTER_MODEL=openai/gpt-5.5`
- `JD_PARSER_MODE=hybrid`
- `JD_PARSER_TEMPERATURE=0.1`
- `JD_PARSER_MAX_OUTPUT_TOKENS=12000`
- `JD_PARSER_TIMEOUT_SECONDS=90`

Optional future-facing variable:
- `JD_PARSER_ENABLE_FALLBACK=true`

Behavior:
- `rule_based`: current parser only
- `hybrid`: LLM first, taxonomy post-process, fallback to rule-based on failure
- `llm_only`: not recommended for this project phase and should not be the default

## Data model changes

Extend `jobs` with:
- `parse_source`
- `parse_confidence`

### `parse_source`
String enum proposal:
- `manual`
- `rule_based`
- `llm_hybrid`
- `rule_based_fallback`

### `parse_confidence`
- float/decimal persisted at job level
- represents parser confidence for the overall structured output
- used only as a heuristic signal, not a guarantee

## Structured output requirements

The LLM output must not bypass the existing graph-ready design. It must feed the same target shape.

### Required normalized fields
- `title`
- `description`
- `required_skills_text`
- `responsibilities_text`
- `qualifications_text`
- `raw_jd_text`

### Required `structured_jd_json`
Top-level fields:
- `title`
- `summary`
- `required_skills`
- `responsibilities`
- `qualifications`
- `skill_groups`
- `soft_skills`
- `language_requirements`
- `experience_years`

Each `required_skill` item should include:
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

Important rule:
- the LLM may propose raw/normalized skill names
- taxonomy post-processing remains authoritative for canonicalization and graph relations

## Hybrid parser architecture

### Step 1: PDF extraction
- use `PyMuPDF`
- reject unreadable or empty text-based PDFs
- keep storing `raw_jd_text`

### Step 2: rule-based preprocessing
- normalize spacing
- clean repeated line breaks
- detect rough sections
- build a section-hinted text package for the LLM prompt

### Step 3: LLM structured parse
Send to OpenRouter:
- system prompt describing the JD parsing role
- user content containing:
  - raw text
  - rule-based section hints
  - target JSON schema requirements
  - strict instructions to avoid hallucinated sections

Expected response:
- JSON only
- no markdown
- no prose outside the JSON object

### Step 4: schema validation
- validate with Pydantic model(s)
- if invalid JSON or missing required structure:
  - retry once with a stricter repair prompt
- if still invalid and fallback enabled:
  - use rule-based parser and mark `parse_source=rule_based_fallback`

### Step 5: taxonomy post-processing
For every parsed skill:
- canonicalize via fixed taxonomy/dictionary
- enrich with:
  - `prerequisites`
  - `related_skills`
  - `skill_groups`
  - `specializations`
- harmonize `importance` and `requirement_type` with local rules where necessary

### Step 6: persistence
Persist:
- normalized text fields
- `structured_jd_json`
- `parse_source`
- `parse_confidence`
- `source_type=jd_pdf`
- `source_file_name`
- `parse_status=processed`

## Confidence strategy

### Job-level confidence
`parse_confidence` should be derived from a bounded heuristic over:
- LLM self-reported confidence if included
- schema completeness
- number of successfully canonicalized skills
- alignment between rule-based section hints and LLM output
- presence of title + summary + skills + at least one meaningful section

Recommended first version:
- computed locally by backend, not trusted blindly from LLM
- scale `0.0` to `1.0`

### Skill-level confidence
Keep per-skill `confidence` in `structured_jd_json.required_skills`.

## Parse provenance strategy

The job workspace should clearly show:
- `parse_source`
- `parse_confidence`
- `source_type`
- `source_file_name`

This is important because later HR explainability should distinguish:
- manually created jobs
- rule-based parse
- LLM-assisted parse
- fallback parse

## OpenRouter integration details

Use the OpenAI-compatible API format against OpenRouter.

Recommended request properties:
- base URL from env
- bearer auth from `OPENROUTER_API_KEY`
- model from `OPENROUTER_MODEL`
- low temperature
- generous output token budget
- timeout control

Prefer stable JSON-oriented prompting over provider-specific exotic features.

## UI changes

### Admin Jobs
No major IA change.

The current flow remains:
- `Import JD PDF` primary action
- `Create Job` secondary action
- imported job appears in list
- `Open Workspace` leads to `/jobs/[jobId]`

Optional enhancement in this phase:
- show compact parse provenance on the card:
  - `llm_hybrid`
  - `0.93 confidence`

### Job Workspace `/jobs/[jobId]`
Add visible provenance metadata:
- `parse_source`
- `parse_confidence`

The workspace should continue to show:
- normalized JD
- graph-ready structured data
- raw JD text
- source metadata

Recommended metadata panel contents:
- source type
- source file
- parse status
- parse source
- parse confidence
- skill groups
- experience years

## Error handling

### If OpenRouter key is missing
- in `hybrid` mode, fail startup or fail import clearly with a configuration error
- do not silently behave unpredictably

### If OpenRouter request fails
- if fallback enabled:
  - use rule-based parser
  - mark `parse_source=rule_based_fallback`
- otherwise:
  - fail import with a clear message

### If model output is invalid
- retry once with a repair prompt
- then fallback or fail based on config

## Test strategy

### Backend
Add tests for:
- config loading for OpenRouter env vars
- hybrid parser success path with mocked LLM client
- invalid LLM JSON -> repair/fallback path
- fallback parse source and confidence behavior
- import API returning `parse_source` and `parse_confidence`

### Frontend
Verify:
- `/admin/jobs` still renders imported jobs
- `/jobs/[jobId]` shows parse provenance
- workspace handles rule-based fallback metadata gracefully

## Verification targets

A successful implementation should demonstrate:
1. import a text-based JD PDF
2. backend calls OpenRouter successfully
3. job is stored with:
   - normalized sections
   - `structured_jd_json`
   - `parse_source=llm_hybrid`
   - non-null `parse_confidence`
4. `/jobs/[jobId]` shows provenance metadata
5. fallback path works when LLM call fails

## Why this keeps the system on track

This phase improves parsing quality without breaking the long-term architecture described in `skillgraph_cv_matcher_system.md`.

It preserves the key system direction:
- JD data is not just stored as text
- JD data is transformed into graph-ready skill structure
- prerequisites and related skills stay controlled by internal taxonomy
- future Neo4j graph construction remains deterministic
- future GAT input remains cleaner than raw text-only parsing
