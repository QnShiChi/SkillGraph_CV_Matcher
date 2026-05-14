# Neo4j Skill Gap Analysis Design

## Goal

Expose recruiter-facing skill-gap classification for ranked candidates so the system can distinguish between skills a candidate already has, skills they are close to because of prerequisite support, and skills that remain true gaps.

This feature builds on the existing Neo4j graph-scoring output and graph explanation block. It should help HR understand not only whether a candidate fits now, but also whether they are close enough to onboard quickly.

## Current State

The system already computes and stores:

- direct exact graph matches
- prerequisite-supported matches
- missing skills
- a graph explanation summary

The UI can now show:

- exact matches
- prerequisite-supported matches
- missing skills

However, recruiters still need to interpret these lists manually. The product does not yet translate them into a more decision-friendly skill-gap model.

## Problem

Right now the system can explain graph reasoning, but it does not classify the candidate’s readiness level in a recruiter-friendly way.

That leaves two missing pieces:

1. HR cannot easily tell whether a missing skill is a soft gap or a hard gap.
2. The system does not provide a short, actionable next-skill recommendation.

For hiring, this matters because:

- some candidates are ready now
- some candidates are one skill away
- some candidates are too far from the job

The product should make that distinction explicit.

## Recommended Approach

Add a `Skill Gap Analysis` block inside the expanded detail view of ranked candidates.

The block should classify required skills into:

- `Ready`
- `Near Gap`
- `Hard Gap`

And add one compact action-oriented subsection:

- `Suggested Next Skills`

This keeps the UI recruiter-focused and actionable without introducing deep graph-path complexity.

## Scope

Included in v1:

- backend enrichment of `final_report_json.skill_gap_analysis`
- recruiter-facing rendering inside ranked candidate expanded detail
- deterministic recommendation of `1-3` next skills

Excluded from v1:

- skill-gap analysis for rejected candidates
- multi-hop prerequisite reasoning
- long-form learning roadmap generation
- cross-job recommendation or reskilling across multiple roles
- interactive graph path visualization

## Skill Gap Model

The new classification should be derived from existing graph-scoring data.

### Ready

Required skills that the candidate matches directly.

Source:

- `graph_scoring.exact_matches`

Examples:

- `python`
- `docker`
- `postgresql`

### Near Gap

Required skills that the candidate does not list directly, but that are supported by a 1-hop prerequisite already present in the CV.

Source:

- `graph_scoring.prerequisite_matches[].required_skill`

Examples:

- `spring_boot` supported by `java`
- `fastapi` supported by `python`
- `postgresql` supported by `sql`

This is the most important recruiter-facing distinction. A near-gap candidate may still be worth interviewing if the missing skill is close enough to ramp quickly.

### Hard Gap

Required skills that are still missing after graph support is considered.

Source:

- `graph_scoring.missing_skills`

Examples:

- `aws`
- `ci_cd`
- `kubernetes`

These represent skills that currently have no direct or prerequisite support in the candidate’s graph profile.

### Suggested Next Skills

This section should recommend the most useful next skills for the candidate relative to the job.

Rule for v1:

1. prioritize `Near Gap` skills first
2. if there are fewer than 3 near-gap skills, fill remaining slots with `Hard Gap` skills
3. cap the total at `3`

This keeps the recommendation deterministic and easy to explain.

## UX Design

### Placement

Render the `Skill Gap Analysis` block inside expanded ranked-candidate detail, immediately after `Graph Explanation`.

This placement works because:

- graph explanation establishes why the candidate scored as they did
- skill-gap analysis turns that explanation into a hiring-readiness view

Do not show this block in collapsed rows.

### Content Structure

The block should contain:

1. `Ready`
2. `Near Gap`
3. `Hard Gap`
4. `Suggested Next Skills`

### Ready

Render as positive pills.

Examples:

- `python`
- `docker`

### Near Gap

Render as pills or short cards with support context.

Recommended format:

- `spring_boot (via java)`
- `fastapi (via python)`

This gives enough context without rendering full graph paths.

### Hard Gap

Render as neutral or warning pills.

Examples:

- `aws`
- `ci_cd`

### Suggested Next Skills

Render as a compact ordered or inline list.

Examples:

- `spring_boot`
- `aws`

This answers the recruiter question:

- if we like this candidate, what are the most obvious missing skills?

## Data Design

Add a new deterministic payload to `final_report_json`:

```json
{
  "skill_gap_analysis": {
    "ready_skills": ["docker"],
    "near_gap_skills": [
      {
        "required_skill": "spring_boot",
        "support_skill": "java"
      }
    ],
    "hard_gap_skills": ["aws"],
    "suggested_next_skills": ["spring_boot", "aws"],
    "summary": "Ready on Docker, close on Spring Boot through Java, and still missing AWS."
  }
}
```

The backend should generate this deterministically from graph-scoring output. No LLM is required.

## Backend Changes

The backend should enrich ranking output with `skill_gap_analysis`.

Responsibilities:

- map exact matches to `ready_skills`
- map prerequisite-supported matches to `near_gap_skills`
- map missing skills to `hard_gap_skills`
- compute `suggested_next_skills`
- synthesize a short summary sentence

This feature should not change ranking order or score. It is explanation and recruiter insight only.

## Frontend Changes

Primary target:

- `frontend/components/jobs/job-candidate-panel.tsx`

Recommended UI pattern:

- add a focused `Skill Gap Analysis` render block
- keep it compact and badge-driven
- avoid long recommendation prose

The visual language should complement the graph explanation block without duplicating it.

## Rendering Rules

### Ranked Candidates

Show the block when:

- `candidate.final_report_json.skill_gap_analysis` exists

### Empty Groups

Do not render empty subsections.

Examples:

- if `near_gap_skills` is empty, omit that subsection
- if `suggested_next_skills` is empty, omit it

### Summary

Include a short one-line summary at the top of the block.

Example:

- `Ready on Docker, close on Spring Boot through Java, and still missing AWS.`

This summary should remain concise and recruiter-readable.

## Success Criteria

The feature is successful when:

1. HR can distinguish between ready skills, near gaps, and hard gaps
2. the ranked candidate detail becomes more actionable, not just more descriptive
3. the UI remains compact and readable
4. suggested next skills are deterministic and easy to understand
5. Neo4j contributes visible hiring-readiness insight beyond raw matching

## Why This Feature Next

This is the right next Neo4j feature because it:

- builds directly on graph scoring and graph explanation
- turns graph reasoning into a hiring-readiness lens
- helps HR identify candidates who are trainable vs. fundamentally mismatched
- adds product value without expanding into full recommendation systems yet
