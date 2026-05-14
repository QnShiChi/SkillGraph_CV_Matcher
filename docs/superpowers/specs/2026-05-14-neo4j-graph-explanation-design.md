# Neo4j Graph Explanation Design

## Goal

Expose Neo4j-backed graph reasoning directly in the ranking UI so HR can understand why a candidate matched, where prerequisite support helped, and which required skills are still missing.

This feature builds on `Graph Scoring v1`, which already persists graph-aware match data into `final_report_json.graph_scoring`. The new work should turn that internal breakdown into recruiter-facing explanation without changing verifier policy, ranking order, or page-level information density.

## Current State

The system now computes graph-aware partial credit for ranking:

- exact skill match = `1.0`
- direct 1-hop prerequisite support = `0.5`
- no double counting for the same required skill
- fallback to direct overlap if Neo4j is unavailable

That breakdown is stored in `final_report_json.graph_scoring`, but it is not yet visible in the UI. Recruiters still mainly see:

- match score
- verification status
- strengths
- gaps
- explanation text

This means Neo4j is helping the score, but not yet helping the user understand the score.

## Problem

Right now the system can rank with graph logic, but the interface does not show the graph reasoning.

That creates two issues:

1. HR cannot distinguish between:
   - direct exact match
   - prerequisite-supported match
   - full miss
2. Neo4j remains a hidden implementation detail instead of a visible product capability

For demo, explanation is where the graph becomes convincing.

## Recommended Approach

Add a `Graph Explanation` block inside the expanded detail view of ranked candidates.

The UI should present three recruiter-friendly sections:

- `Exact Matches`
- `Prerequisite-Supported Matches`
- `Missing Skills`

Above them, show a short summary sentence that explains the candidate’s graph-based fit at a glance.

This explanation should use the existing expandable-row pattern from the job workspace so the page remains compact by default.

## Scope

Included in v1:

- backend enrichment of `final_report_json.graph_scoring`
- recruiter-facing graph explanation in ranked candidate expanded detail
- compact presentation of exact, prerequisite-supported, and missing skill groups
- fallback note when graph scoring was unavailable

Excluded from v1:

- graph explanation for rejected candidates unless graph scoring already exists
- deep path rendering beyond 1-hop
- interactive graph visualization inside the workspace
- recommendation features
- graph explanation in exported reports or PDFs

## UX Design

### Placement

Render the new `Graph Explanation` block inside the expanded candidate detail on the ranking screen.

This is the correct location because:

- the page already uses expandable rows
- ranked candidates are the primary HR reading path
- explanation should sit next to the score it explains

Do not show the block in the collapsed row state.

### Content Structure

The block should have:

1. `Summary`
2. `Exact Matches`
3. `Prerequisite-Supported Matches`
4. `Missing Skills`

### Summary

Show one concise sentence, for example:

- `Strong direct match on Python and Docker, with prerequisite support for FastAPI through Python.`
- `Limited direct overlap, but the candidate is partially supported through Java for Spring Boot.`
- `Graph scoring unavailable. Showing direct skill overlap fallback.`

This sentence must stay short and scannable.

### Exact Matches

Render as compact pills or inline badges.

Examples:

- `python`
- `docker`
- `postgresql`

This section answers: what did the candidate match directly?

### Prerequisite-Supported Matches

Render as a short list or stacked chips using the pattern:

- `fastapi <- python`
- `spring_boot <- java`
- `postgresql <- sql`

Optionally append the partial-credit marker in a subtle style:

- `fastapi <- python (0.5)`

This section answers: where did the graph help?

### Missing Skills

Render as compact warning/neutral pills.

Examples:

- `aws`
- `ci_cd`
- `kubernetes`

This section answers: what still prevents a stronger fit?

### Fallback State

If `graph_scoring.used_fallback = true`, show:

- a small note above the sections, or
- a fallback summary sentence instead of graph-derived phrasing

Example:

- `Graph scoring was unavailable for this candidate, so the system used direct skill overlap only.`

In fallback mode:

- exact matches may still be shown if the payload contains them
- prerequisite-supported matches should usually be empty

## Data Design

The current `graph_scoring` payload should be extended slightly so the UI does not have to infer too much.

Recommended shape:

```json
{
  "enabled": true,
  "used_fallback": false,
  "overlap_score": 0.75,
  "summary": "Strong direct match on Docker, with prerequisite support for Spring Boot through Java.",
  "exact_matches": ["docker"],
  "prerequisite_matches": [
    {
      "required_skill": "spring_boot",
      "support_skill": "java",
      "credit": 0.5
    }
  ],
  "missing_skills": ["aws"]
}
```

`summary` should be generated deterministically in backend code from the breakdown data.

## Backend Changes

The backend should enrich `final_report_json.graph_scoring` during scoring.

Responsibilities:

- synthesize a short summary sentence
- preserve existing exact/prerequisite/missing lists
- keep the payload deterministic

No ranking logic change is required for this feature. This is explanation-only on top of the existing graph-scoring output.

## Frontend Changes

Primary target:

- `frontend/components/jobs/candidate-list-item.tsx`

Secondary target if needed:

- `frontend/components/jobs/job-candidate-panel.tsx`

Recommended frontend structure:

- add a focused render block for `Graph Explanation`
- only show it inside the expanded state
- keep styling aligned with current summary-first layout

The block should avoid long paragraphs. It should read like recruiter-facing evidence, not developer telemetry.

## Rendering Rules

### Ranked Candidates

Always eligible to show `Graph Explanation` when:

- candidate has `final_report_json.graph_scoring`

### Rejected Candidates

Do not prioritize graph explanation here.

Only show it if the candidate has graph-scoring payload for some future scenario where ranking happened before final reject. In normal verifier-first rejection flow, omit the block.

### Empty Sections

Do not show empty groups.

Examples:

- if there are no prerequisite-supported matches, omit that subsection
- if there are no missing skills, omit that subsection

This keeps the detail view compact.

## Success Criteria

The feature is successful when:

1. HR can tell which skills matched exactly and which were only supported through prerequisites
2. the UI stays compact in collapsed mode
3. expanded candidate detail clearly shows graph reasoning without looking technical or noisy
4. fallback mode is understandable when Neo4j was unavailable
5. Neo4j becomes visible as a product capability, not just a backend implementation detail

## Why This Feature Next

This is the best next Neo4j feature because it:

- turns hidden graph logic into visible recruiter value
- works directly on top of Graph Scoring v1
- improves trust in ranking
- strengthens demo quality without widening system scope too much
- creates a clean bridge toward later skill-gap and recommendation features
