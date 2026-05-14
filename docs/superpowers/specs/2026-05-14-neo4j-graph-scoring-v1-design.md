# Neo4j Graph Scoring v1 Design

## Goal

Introduce graph-aware partial credit into candidate ranking without changing the current screening gate, verification rules, or overall ranking pipeline.

The first version should improve one specific weakness in the current score:

- direct skill overlap treats every missing exact skill as a complete miss
- prerequisite knowledge already exists in the skill taxonomy and Neo4j graph
- the ranker should award partial credit when a candidate has a direct 1-hop prerequisite for a required skill

This version is intentionally narrow:

- keep PostgreSQL as the source of truth
- keep the current verifier and reject/pass rules
- keep the current weighted score structure
- add Neo4j only as a graph-scoring signal

## Current State

The current ranking logic lives in [backend/app/services/candidate_screening_service.py](/home/phan-duong-quoc-nhat/workspace/SkillGraphCVMatcher/backend/app/services/candidate_screening_service.py) inside `_score_candidate(...)`.

Today it:

- reads structured job and candidate skills from PostgreSQL-backed JSON
- computes direct set overlap
- scores must-have coverage, project evidence, experience, and evidence density
- persists the final score and summary back to PostgreSQL

Neo4j is already populated, but only as a synced projection:

- `(:Job)-[:REQUIRES]->(:Skill)`
- `(:Candidate)-[:HAS_SKILL]->(:Skill)`
- `(:Skill)-[:PREREQUISITE_OF]->(:Skill)`

The graph currently supports visualization and future use, but it does not yet affect ranking.

## Problem

The current score is too rigid for graph-safe technical skills.

Example:

- job requires `spring_boot`
- candidate lists `java`
- current score gives zero skill credit for `spring_boot`

That behavior is too harsh when the taxonomy already encodes `java` as a prerequisite or foundation for a more specific target skill. It also weakens the argument for using Neo4j as a relationship-intelligence layer.

## Recommended Approach

Use Neo4j as a bonus overlay for the existing skill component of the match score.

For each required graph-safe skill:

- exact match on the candidate side gives full credit: `1.0`
- if exact match is absent, a direct 1-hop prerequisite match gives partial credit: `0.5`
- if neither exists, the skill gets `0.0`

Important guardrail:

- do not double count exact match and prerequisite support for the same required skill

Example:

- job requires `spring_boot`
- candidate has `spring_boot` and `java`
- score that requirement as `1.0`, not `1.5`

This keeps the ranking behavior intuitive while adding graph-aware nuance.

## Scope

Included in v1:

- graph-aware skill support for `technical_skills`, `platforms_cloud`, and `tooling_devops`
- direct 1-hop prerequisite support only
- fixed prerequisite weight of `0.5`
- persisted scoring breakdown for explainability and debugging

Excluded from v1:

- multi-hop traversal
- custom edge weights
- graph-driven changes to verifier or screening
- recommendation features
- UI changes beyond showing the new graph score breakdown if the current API already exposes it

## Scoring Model

The existing weighted formula remains the same at the top level:

- must-have coverage: `35%`
- project verification evidence: `25%`
- skill overlap: `20%`
- experience signal: `10%`
- evidence density: `10%`

Only the current skill-overlap component changes.

### Current Skill Overlap

Today:

- `overlap_score = matched_required / total_required`

where `matched_required` only includes direct canonical matches.

### New Skill Overlap

In v1:

- each required graph-safe skill contributes:
  - `1.0` for exact match
  - `0.5` for 1-hop prerequisite support when exact match is absent
  - `0.0` otherwise
- `graph_overlap_score = sum(per-skill credits) / total_required`

Example:

- required: `spring_boot`, `postgresql`, `docker`
- candidate has: `java`, `sql`, `docker`

Credits:

- `spring_boot` <- `java` = `0.5`
- `postgresql` <- `sql` = `0.5`
- `docker` exact = `1.0`

Graph overlap score:

- `(0.5 + 0.5 + 1.0) / 3 = 0.6667`

## Data Source Strategy

The prerequisite map does not come from runtime LLM reasoning.

It already exists in the curated taxonomy:

- [backend/app/services/skill_taxonomy.py](/home/phan-duong-quoc-nhat/workspace/SkillGraphCVMatcher/backend/app/services/skill_taxonomy.py)

The parsers explicitly avoid letting the LLM invent graph relations. The taxonomy is the authority, and the graph is the executable representation of that authority.

That means:

- no LLM is required to compute graph-based partial credit
- Neo4j and PostgreSQL both consume the same curated prerequisite knowledge
- graph scoring stays deterministic

## Architecture

### New Service

Add a focused service for graph queries, for example:

- `backend/app/services/graph_match_service.py`

Responsibilities:

- query Neo4j for exact and prerequisite support between one job and one candidate
- return a deterministic, compact scoring payload
- hide Cypher details from `candidate_screening_service.py`

### Candidate Screening Integration

Refactor `_score_candidate(...)` so that:

1. existing non-graph inputs remain unchanged
2. direct skill sets are still computed from structured JSON for fallback and debugging
3. graph-safe overlap comes from the graph service
4. the final score keeps the same weights

The screening service should still be able to fall back cleanly if Neo4j is unavailable:

- use direct overlap only
- mark the graph component as unavailable in the breakdown

### Neo4j Query Shape

For a single job and candidate, the graph service should answer:

- which required skills are exact matches
- which required skills are supported by 1-hop prerequisites
- which required skills are still missing

Conceptually:

- `Job -> REQUIRES -> Skill`
- `Candidate -> HAS_SKILL -> Skill`
- `Candidate Skill -> PREREQUISITE_OF -> Required Skill`

The service should return a per-skill breakdown such as:

- required skill canonical
- match type: `exact | prerequisite | missing`
- matched support skill canonical if prerequisite support was used
- credit value: `1.0 | 0.5 | 0.0`

## Rules

### Exact Match Priority

Exact match always wins over prerequisite support.

If a candidate has both:

- `spring_boot`
- `java`

and the job requires `spring_boot`, only the exact match counts for that requirement.

### One-Hop Only

Only direct prerequisite edges count in v1.

If the graph path is:

- `javascript -> react -> nextjs`

and the job requires `nextjs`:

- `react` can earn `0.5`
- `javascript` alone earns `0.0` in v1

### Graph-Safe Groups Only

Apply graph scoring only to:

- `technical_skills`
- `platforms_cloud`
- `tooling_devops`

Do not graph-score:

- competencies
- role descriptors
- soft skills

## Fallback Behavior

If Neo4j is unavailable, query fails, or the graph data is missing:

- do not fail screening
- fall back to the current direct-overlap logic
- persist a scoring breakdown that clearly marks the graph contribution as unavailable

This keeps ranking reliable in degraded conditions.

## Persistence and Explainability

The final score should still be stored on the candidate record in PostgreSQL.

Additionally, `final_report_json` should include a graph-scoring section, for example:

- `graph_scoring.enabled`
- `graph_scoring.used_fallback`
- `graph_scoring.exact_matches`
- `graph_scoring.prerequisite_matches`
- `graph_scoring.missing_skills`
- `graph_scoring.overlap_score`

This is valuable for:

- HR explanation
- debugging ranking changes
- later AgentScope explanation enrichment

## Testing

Add targeted tests for:

- exact match earns full credit
- prerequisite-only support earns half credit
- exact plus prerequisite does not double count
- non-graph skill groups are ignored
- graph failure falls back to current direct overlap
- final report includes graph breakdown

Primary test targets:

- `backend/tests/services/test_candidate_screening_service.py`
- new tests for the graph match service

## Why This Version

This version is the right first step because it:

- creates visible product value without rewriting ranking from scratch
- gives Neo4j a real decision-support role
- stays deterministic and testable
- avoids coupling graph scoring to verifier or LLM behavior
- creates a clean base for later versions with edge weights, 2-hop paths, or recommendations

## Success Criteria

The implementation is successful when:

1. ranking still works if Neo4j is down
2. candidates receive partial credit for 1-hop prerequisites when exact skills are missing
3. exact matches never double count with prerequisite skills
4. score changes are visible in persisted ranking output
5. the new logic is covered by automated tests
