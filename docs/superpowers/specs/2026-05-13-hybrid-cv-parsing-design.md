# Hybrid CV Parsing Design

## Goal

Upgrade candidate import from rule-based parsing only to a hybrid OpenRouter-assisted parser so CV skills, section structure, and evidence extraction become more accurate while preserving taxonomy control and graph consistency.

## Scope

### In scope

- add hybrid parsing support for CV imports
- add CV parser mode configuration
- use OpenRouter to normalize structured CV output
- preserve evidence-aware candidate extraction
- keep taxonomy as the canonical source of graph semantics
- support fallback back to rule-based parsing on LLM failure
- expose parser provenance in candidate responses and UI

### Out of scope

- OCR support for scanned CVs
- job-candidate matching
- ranking or explanation generation
- letting the LLM invent graph ontology or prerequisite edges

## Parser Modes

Add candidate-side parser configuration similar to JD parsing:

- `CV_PARSER_MODE=rule_based | hybrid | llm_only`
- `CV_PARSER_ENABLE_FALLBACK=true | false`

Recommended default:

- `CV_PARSER_MODE=hybrid`
- `CV_PARSER_ENABLE_FALLBACK=true`

Behavior:

- `rule_based`
  - use only local parser

- `hybrid`
  - use local preprocessing + OpenRouter structured parsing
  - fallback to `rule_based_fallback` on failure if enabled

- `llm_only`
  - use OpenRouter path only
  - no fallback unless explicitly implemented for hard failure handling

## Structured CV Shape

The final `structured_cv_json` contract remains the same, but the hybrid parser should populate it more accurately.

Top-level fields:

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

Each graph-safe skill item must preserve:

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

## LLM Responsibility

The LLM should help with:

- extracting cleaner candidate summary
- separating experience, education, and skills
- identifying candidate skills more accurately
- selecting stronger evidence snippets per skill
- classifying candidate skills into the grouped output contract

The LLM must not be trusted to define graph ontology.

## Taxonomy Responsibility

Taxonomy remains the source of truth for:

- canonical names
- `skill_groups`
- `prerequisites`
- `related_skills`
- `specializations`

The candidate hybrid parser should:

1. ask the LLM for structured CV output
2. normalize and canonicalize through taxonomy
3. attach graph metadata from taxonomy
4. keep evidence from the LLM/local parser

## Evidence Rules

Evidence quality is the most important improvement for candidate parsing.

Each graph-safe skill should retain at least one evidence snippet from:

- `experience`
- `summary`
- `skills`
- `education` if relevant

Evidence item shape:

- `text`
- `section_origin`
- `confidence`

Hybrid parsing should improve:

- evidence specificity
- section attribution
- candidate skill confidence

## OpenRouter Usage

Reuse existing OpenRouter configuration style:

- `OPENROUTER_API_KEY`
- `OPENROUTER_BASE_URL`
- `OPENROUTER_MODEL`

Add candidate-specific controls:

- `CV_PARSER_MODE`
- `CV_PARSER_TEMPERATURE`
- `CV_PARSER_MAX_OUTPUT_TOKENS`
- `CV_PARSER_TIMEOUT_SECONDS`
- `CV_PARSER_ENABLE_FALLBACK`

Recommended values:

- low temperature
- large enough token budget for long CVs
- strict JSON schema

## API and Provenance

Candidate import responses should continue to expose:

- `parse_source`
- `parse_confidence`
- `graph_sync_status`
- `graph_sync_error`
- `graph_synced_at`

Expected parser provenance values:

- `rule_based`
- `llm_hybrid`
- `rule_based_fallback`

## Frontend Impact

No major route redesign is needed.

The current admin candidates page should show:

- parse engine
- parse confidence
- grouped structured candidate skills
- evidence snippets

The main user-visible change is better output quality, not a new navigation model.

## Verification

### Backend

- import a text-based CV PDF in `hybrid` mode
- confirm candidate response shows `parse_source=llm_hybrid`
- confirm `structured_cv_json` has grouped skills
- confirm evidence is more specific than the rule-based baseline

### Fallback

- simulate OpenRouter failure
- confirm candidate import still succeeds when fallback is enabled
- confirm `parse_source=rule_based_fallback`

### Neo4j

After a hybrid candidate import:

- `MATCH (c:Candidate {candidate_id: <id>})-[r:HAS_SKILL]->(s:Skill) RETURN c, r, s`

Expected:

- the same `Candidate` to `Skill` projection still works
- the graph reuses existing canonical `Skill` nodes

## Expected Outcome

After this phase:

- candidate parsing quality improves substantially
- evidence extraction becomes more useful for later explainability
- provenance remains explicit
- graph consistency is preserved because taxonomy still governs canonical skill semantics
