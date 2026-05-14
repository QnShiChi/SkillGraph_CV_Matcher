# Neo4j Related Candidate Recommendation Design

## Goal

Use Neo4j relationship intelligence to recommend other relevant candidates inside the ranked candidate detail view.

The feature should help HR answer two follow-up questions when reviewing a candidate:

1. Which other candidates in this job look similar to this person?
2. Which other candidates are also close to this job, even if they are not identical to this person?

This turns the ranked detail view from a static evaluation card into a navigation point for talent discovery.

## Current State

The system already provides:

- deterministic ranking
- graph-aware partial credit
- graph explanation
- skill-gap analysis

However, each ranked candidate is still treated as an isolated record. The UI does not currently use Neo4j to show candidate-to-candidate or candidate-to-job neighborhood insight.

## Problem

Once HR opens a strong candidate, the next practical question is usually:

- who else should I compare this person with?

The current system forces HR to mentally scan the ranked list to answer that question. There is no relationship-aware recommendation layer inside the detail view.

That means:

- the graph helps score candidates
- but it does not yet help discover related candidates

## Recommended Approach

Add a `Related Candidates` block inside expanded ranked-candidate detail.

The block should contain two recommendation groups:

- `Similar Candidates`
- `Next-Best Candidates`

This feature should remain deterministic and graph-based. It should not rely on LLM ranking or language generation.

## Scope

Included in v1:

- recommendations only within the same job workspace
- `Similar Candidates` based on candidate-to-candidate graph overlap
- `Next-Best Candidates` based on closeness to the same job graph
- compact rendering inside ranked candidate detail

Excluded from v1:

- cross-job recommendations
- candidate-to-job recommendations outside the active job
- global talent discovery
- multi-hop graph similarity
- LLM-written recommendation reasons

## Recommendation Model

### Similar Candidates

Purpose:

- show candidates whose graph profile is closest to the currently opened candidate

Primary signal:

- shared graph-safe skills:
  - `technical_skills`
  - `platforms_cloud`
  - `tooling_devops`

Recommended v1 scoring:

- direct shared skills only
- similarity score = `shared_skill_count / union_skill_count`

Optional secondary signal:

- slight boost if both candidates have support around the same prerequisite-backed area

But for v1, direct overlap is enough.

### Next-Best Candidates

Purpose:

- show other candidates in the same job who are still strong alternatives for this role

Primary signal:

- graph proximity to the job’s required skills

Recommended v1 scoring:

- use Neo4j to count each other candidate’s exact and prerequisite-supported skill coverage relative to the job
- reuse the same exact-vs-prerequisite weighting idea:
  - exact = `1.0`
  - 1-hop prerequisite support = `0.5`
- rank by graph-only closeness, not by the full persisted application score

This keeps the recommendation meaning clear:

- `Similar Candidates` = like this person
- `Next-Best Candidates` = also near this job

## Data Design

Add a new payload under `final_report_json`:

```json
{
  "related_candidates": {
    "similar_candidates": [
      {
        "candidate_id": 33,
        "full_name": "LONG NGUYEN",
        "shared_skills": ["python", "docker"],
        "similarity_score": 0.67,
        "reason": "Shares backend and deployment strengths."
      }
    ],
    "next_best_candidates": [
      {
        "candidate_id": 35,
        "full_name": "HONG NGUYEN",
        "shared_skills": ["java", "spring_boot"],
        "proximity_score": 0.62,
        "reason": "Also aligns with the backend requirements for this job."
      }
    ]
  }
}
```

The `reason` should be deterministic and templated, not LLM-generated.

## Backend Design

### New Recommendation Service

Add a small graph recommendation service, for example:

- `backend/app/services/graph_recommendation_service.py`

Responsibilities:

- compute similar candidates for one candidate within one job
- compute next-best candidates for the same job excluding the current candidate
- return small deterministic payloads for UI rendering

### Similar Candidate Query

For the currently opened candidate:

- collect its graph-safe skills
- compare with every other candidate in the same job
- compute:
  - shared skills
  - union count
  - similarity score

Return top `3`.

### Next-Best Candidate Query

For the same job:

- measure each other candidate’s graph closeness to the job’s required skills
- exclude the current candidate
- return top `3`

This should not mutate ranking. It is an additional insight layer only.

### Persistence Strategy

Recommended v1:

- enrich `final_report_json` during screening/ranking so the UI can read recommendations without making a second graph-specific API call

This keeps the frontend simple and consistent with the existing ranking payload.

## UI Design

### Placement

Render `Related Candidates` inside expanded ranked-candidate detail, after `Skill Gap Analysis`.

This is the right placement because:

- it appears only when HR has already engaged deeply with a candidate
- it acts as a natural “what else should I open?” follow-up

### Content Structure

The block should have:

1. `Similar Candidates`
2. `Next-Best Candidates`

Each item should display:

- candidate name
- score
- short deterministic reason
- shared skill badges

### Similar Candidates Item Example

- `LONG NGUYEN`
- `Similarity 0.67`
- `Shares backend and deployment strengths.`
- badges: `python`, `docker`

### Next-Best Candidates Item Example

- `HONG NGUYEN`
- `Job proximity 0.62`
- `Also aligns with the backend requirements for this job.`
- badges: `java`, `spring_boot`

### Empty State

If no recommendations are available, hide the subsection instead of showing noise.

If both groups are empty, omit the entire block.

## Rendering Rules

### Same Job Only

Only recommend candidates belonging to the same `job_id`.

### No Self-Recommendation

Never include the currently opened candidate in either group.

### Limit

Return at most `3` candidates per group.

### Compactness

Do not expand recommendations into full nested cards. Each recommendation should remain summary-sized.

This preserves the compressed UX achieved in the job workspace.

## Success Criteria

The feature is successful when:

1. HR can discover related candidates without manually scanning the whole list
2. the recommendation meaning is clear:
   - similar to this candidate
   - also good for this job
3. recommendations are deterministic and easy to test
4. the UI stays compact
5. Neo4j becomes visibly useful for relationship-aware discovery, not just scoring

## Why This Feature Next

This is the right next Neo4j feature because it:

- builds naturally on graph scoring, explanation, and skill-gap analysis
- uses the graph for candidate discovery rather than only evaluation
- creates a stronger “knowledge graph” story for demo
- adds recruiter value without requiring a new standalone search experience
