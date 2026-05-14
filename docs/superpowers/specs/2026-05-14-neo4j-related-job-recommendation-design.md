# Neo4j Related Job Recommendation Design

## Goal

Use Neo4j to recommend jobs that are adjacent to the current job in the skill graph, and surface those recommendations inside ranked candidate detail.

The feature should help HR understand the demand neighborhood around the current role:

- which other jobs require a very similar skill mix
- which hiring demand clusters sit near this role

This turns the ranked candidate detail view into a broader talent-and-demand context point.

## Current State

The system already supports:

- graph-aware ranking
- graph explanation
- skill-gap analysis
- related candidate recommendations

However, graph intelligence is still candidate-centered. The UI does not yet expose job-to-job adjacency, even though the graph already stores `Job -> REQUIRES -> Skill`.

## Problem

When HR is reviewing a candidate for one job, a natural follow-up question is:

- what other roles are structurally similar to this one?

The system can currently explain candidate fit, but it cannot yet show the broader hiring context around the active job.

That means:

- Neo4j helps evaluate candidates
- but it does not yet help expose job clusters

## Recommended Approach

Add a `Related Jobs` block inside expanded ranked-candidate detail, after `Related Candidates`.

This block should recommend jobs adjacent to the current job based on shared required skills.

The feature should remain deterministic and graph-based. No LLM should be used for ranking or explanation.

## Scope

Included in v1:

- recommendations based on shared required skills between jobs
- compact rendering inside ranked candidate detail
- deterministic score and templated reason

Excluded from v1:

- candidate-mediated job recommendation
- cross-tenant or external job discovery
- multi-hop job similarity
- LLM-generated job recommendation reasoning
- navigation or workflow actions from the recommendation itself

## Recommendation Model

### Job-to-Job Similarity

Compare the current job with other jobs using graph-safe required skills:

- `technical_skills`
- `platforms_cloud`
- `tooling_devops`

Recommended v1 score:

- `shared_required_skill_count / union_required_skill_count`

This keeps the meaning simple:

- a higher score means stronger overlap in the required skill footprint

### Shared Skills

Each related job should include the overlapping required skills that justify the recommendation.

Examples:

- `python`
- `fastapi`
- `docker`

### Reason

The reason should be deterministic and templated, for example:

- `Shares core backend and deployment requirements with the current job.`
- `Overlaps strongly on API and database skill requirements.`

The wording can be selected by a simple ruleset based on the shared skills.

## Data Design

Add a new payload under `final_report_json`:

```json
{
  "related_jobs": [
    {
      "job_id": 18,
      "title": "Backend Engineer",
      "shared_skills": ["python", "fastapi", "docker"],
      "similarity_score": 0.75,
      "reason": "Shares core backend and deployment requirements with the current job."
    }
  ]
}
```

The list should be:

- sorted descending by `similarity_score`
- capped at `3`
- exclude the current job itself

## Backend Design

### New Graph Job Recommendation Service

Add a small service, for example:

- `backend/app/services/graph_job_recommendation_service.py`

Responsibilities:

- compute related jobs for one job
- return a deterministic, UI-ready payload

### Query Shape

For the current job:

- find other `Job` nodes
- compare required graph-safe skills
- compute:
  - shared skills
  - union size
  - similarity score

Return the top `3`.

### Persistence Strategy

Recommended v1:

- enrich each ranked candidate’s `final_report_json` with the same `related_jobs` list for the active job

This duplicates the same job-level recommendation per ranked candidate, but it keeps the UI simple and consistent with the current detail-driven presentation.

## UI Design

### Placement

Render `Related Jobs` inside expanded ranked-candidate detail, after `Related Candidates`.

This placement works because:

- it extends the graph narrative progressively:
  - candidate fit
  - skill gap
  - related candidates
  - related jobs

### Content Structure

Each recommendation item should show:

- job title
- similarity score
- short reason
- shared skill badges

### Item Example

- `Backend Engineer`
- `Similarity 0.75`
- `Shares core backend and deployment requirements with the current job.`
- badges: `python`, `fastapi`, `docker`

### Empty State

If there are no related jobs with meaningful overlap, omit the block.

Do not show placeholder noise.

## Rendering Rules

### No Current Job

Never include the current job in its own recommendation list.

### Limit

Return at most `3` related jobs.

### Compactness

Keep each recommendation summary-sized, not full-card sized.

This preserves the compressed UX of the ranked candidate detail.

## Success Criteria

The feature is successful when:

1. HR can see the job’s neighborhood in the skill graph
2. recommendations are deterministic and easy to test
3. shared skills visibly justify each related job
4. the UI remains compact
5. Neo4j becomes visibly useful for demand-side relationship discovery, not just candidate-side reasoning

## Why This Feature Next

This is the right next Neo4j feature because it:

- complements related candidate recommendations with job-side graph intelligence
- broadens the product story from candidate evaluation to hiring-demand understanding
- strengthens the knowledge-graph demo narrative
- adds value without requiring a dedicated job recommendation page
