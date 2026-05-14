# Neo4j Skill Gap Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic Neo4j-backed skill-gap classification to ranked candidate detail so HR can distinguish ready skills, near gaps, hard gaps, and suggested next skills without changing ranking behavior.

**Architecture:** Build a small backend enrichment layer on top of `graph_scoring` that derives `skill_gap_analysis` deterministically, then render a compact `Skill Gap Analysis` block under `Graph Explanation` in the ranked candidate detail view. The feature remains explanation-only and should not affect score calculation or ranking order.

**Tech Stack:** Python, FastAPI service layer, Next.js, React, TypeScript, pytest

---

## File Structure

### Modified files

- `backend/app/services/candidate_screening_service.py`
  - Add deterministic `skill_gap_analysis` payload derived from `graph_scoring`.
- `backend/tests/services/test_candidate_screening_service.py`
  - Verify `ready`, `near gap`, `hard gap`, and `suggested next skills` behavior.
- `backend/tests/api/test_job_ranking_api.py`
  - Verify `skill_gap_analysis` is exposed through ranking responses.
- `frontend/lib/api.ts`
  - Type the new `skill_gap_analysis` payload.
- `frontend/components/jobs/job-candidate-panel.tsx`
  - Render the `Skill Gap Analysis` block in ranked candidate detail.

### Reference files

- `backend/app/services/graph_match_service.py`
  - Existing source of graph scoring match breakdown.
- `frontend/components/jobs/candidate-list-item.tsx`
  - Existing row expansion shell used by the ranked candidate UI.

---

### Task 1: Add Backend Skill Gap Analysis Derivation

**Files:**
- Modify: `backend/app/services/candidate_screening_service.py`
- Test: `backend/tests/services/test_candidate_screening_service.py`

- [ ] **Step 1: Write the failing backend tests**

```python
def test_score_candidate_builds_skill_gap_analysis_from_graph_scoring(session) -> None:
    job = _create_job(session)
    candidate = _create_candidate(
        session,
        job_id=job.id,
        full_name="Gap Candidate",
        resume_text="GitHub: https://github.com/example/gap-candidate",
        technical=["Python", "Docker"],
    )
    candidate.verified_links_json = [{"final_url": "https://github.com/example/gap-candidate"}]

    result = _score_candidate(
        {
            "required_skills": [
                {"canonical": "fastapi", "requirement_type": "must_have"},
                {"canonical": "docker", "requirement_type": "must_have"},
                {"canonical": "aws", "requirement_type": "nice_to_have"},
            ],
            "technical_skills": [{"canonical": "fastapi"}],
            "platforms_cloud": [{"canonical": "aws"}],
            "tooling_devops": [{"canonical": "docker"}],
        },
        candidate,
        graph_breakdown={
            "graph_available": True,
            "required_skill_count": 3,
            "credited_score": 1.5,
            "overlap_score": 0.5,
            "exact_matches": ["docker"],
            "prerequisite_matches": [
                {"required_skill": "fastapi", "support_skill": "python", "credit": 0.5}
            ],
            "missing_skills": ["aws"],
        },
    )

    skill_gap = result["final_report_json"]["skill_gap_analysis"]
    assert skill_gap["ready_skills"] == ["docker"]
    assert skill_gap["near_gap_skills"] == [
        {"required_skill": "fastapi", "support_skill": "python"}
    ]
    assert skill_gap["hard_gap_skills"] == ["aws"]
    assert skill_gap["suggested_next_skills"] == ["fastapi", "aws"]
    assert "docker" in skill_gap["summary"].lower()
    assert "fastapi" in skill_gap["summary"].lower()
    assert "aws" in skill_gap["summary"].lower()


def test_score_candidate_skill_gap_analysis_handles_fallback_without_near_gaps(session) -> None:
    job = _create_job(session)
    candidate = _create_candidate(
        session,
        job_id=job.id,
        full_name="Fallback Gap Candidate",
        resume_text="GitHub: https://github.com/example/fallback-gap",
        technical=["Python"],
    )
    candidate.verified_links_json = [{"final_url": "https://github.com/example/fallback-gap"}]

    result = _score_candidate(job.structured_jd_json or {}, candidate, graph_breakdown=None)

    skill_gap = result["final_report_json"]["skill_gap_analysis"]
    assert skill_gap["near_gap_skills"] == []
    assert skill_gap["ready_skills"] == []
    assert skill_gap["hard_gap_skills"]
    assert skill_gap["suggested_next_skills"] == skill_gap["hard_gap_skills"][:3]
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `./.venv/bin/python -m pytest backend/tests/services/test_candidate_screening_service.py -k "skill_gap_analysis" -v`

Expected: FAIL because `skill_gap_analysis` is not present.

- [ ] **Step 3: Add backend derivation helpers**

```python
def _build_skill_gap_analysis(graph_scoring: dict) -> dict:
    ready_skills = list(graph_scoring.get("exact_matches", []))
    near_gap_skills = [
        {
            "required_skill": item["required_skill"],
            "support_skill": item["support_skill"],
        }
        for item in graph_scoring.get("prerequisite_matches", [])
    ]
    hard_gap_skills = list(graph_scoring.get("missing_skills", []))

    suggested_next_skills = [
        item["required_skill"] for item in near_gap_skills
    ]
    for skill in hard_gap_skills:
        if len(suggested_next_skills) >= 3:
            break
        suggested_next_skills.append(skill)

    summary = _build_skill_gap_summary(
        ready_skills=ready_skills,
        near_gap_skills=near_gap_skills,
        hard_gap_skills=hard_gap_skills,
    )

    return {
        "ready_skills": ready_skills,
        "near_gap_skills": near_gap_skills,
        "hard_gap_skills": hard_gap_skills,
        "suggested_next_skills": suggested_next_skills[:3],
        "summary": summary,
    }


def _build_skill_gap_summary(*, ready_skills: list[str], near_gap_skills: list[dict], hard_gap_skills: list[str]) -> str:
    parts: list[str] = []
    if ready_skills:
        parts.append(f"Ready on {', '.join(ready_skills[:3])}.")
    if near_gap_skills:
        first = near_gap_skills[0]
        parts.append(
            f"Close on {first['required_skill']} through {first['support_skill']}."
        )
    if hard_gap_skills:
        parts.append(f"Still missing {', '.join(hard_gap_skills[:3])}.")
    if not parts:
        return "No meaningful skill-gap insight available."
    return " ".join(parts)
```

- [ ] **Step 4: Attach `skill_gap_analysis` to the report payload**

```python
skill_gap_analysis = _build_skill_gap_analysis(graph_scoring)

return {
    "match_score": overall_score,
    "match_summary": ...,
    "final_report_json": {
        "strengths": strengths,
        "gaps": gaps,
        "verified_links": verified_links,
        "graph_scoring": graph_scoring,
        "skill_gap_analysis": skill_gap_analysis,
        "explanation": ...,
        "critic_review": ...,
    },
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `./.venv/bin/python -m pytest backend/tests/services/test_candidate_screening_service.py -k "skill_gap_analysis" -v`

Expected: PASS for both new backend cases.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/candidate_screening_service.py backend/tests/services/test_candidate_screening_service.py
git commit -m "feat: add graph-based skill gap analysis"
```

---

### Task 2: Expose Skill Gap Analysis Through API Types

**Files:**
- Modify: `frontend/lib/api.ts`

- [ ] **Step 1: Add the new frontend types**

```ts
export type SkillGapNearGap = {
  required_skill: string;
  support_skill: string;
};

export type SkillGapAnalysis = {
  ready_skills: string[];
  near_gap_skills: SkillGapNearGap[];
  hard_gap_skills: string[];
  suggested_next_skills: string[];
  summary: string;
};
```

- [ ] **Step 2: Attach the new payload to `CandidateFinalReport`**

```ts
export type CandidateFinalReport = {
  strengths?: string[];
  gaps?: string[];
  verified_links?: Array<Record<string, unknown>>;
  explanation?: string;
  critic_review?: string;
  graph_scoring?: GraphScoringSummary;
  skill_gap_analysis?: SkillGapAnalysis;
  [key: string]: unknown;
};
```

- [ ] **Step 3: Run frontend build verification**

Run: `docker compose exec frontend npm run build`

Expected: PASS with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/api.ts
git commit -m "feat: type skill gap analysis payload"
```

---

### Task 3: Render Skill Gap Analysis in Ranked Candidate Detail

**Files:**
- Modify: `frontend/components/jobs/job-candidate-panel.tsx`

- [ ] **Step 1: Add a rendering helper**

```tsx
function renderSkillGapAnalysis(skillGapAnalysis?: SkillGapAnalysis | null) {
  if (!skillGapAnalysis) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200/70 bg-white/80 p-4">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
          Skill Gap Analysis
        </p>
        <p className="text-sm leading-6 text-slate-700">{skillGapAnalysis.summary}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Render `Ready` and `Near Gap` subsections**

```tsx
{skillGapAnalysis.ready_skills.length > 0 ? (
  <div className="space-y-2">
    <p className="text-xs font-semibold text-slate-600">Ready</p>
    <div className="flex flex-wrap gap-2">
      {skillGapAnalysis.ready_skills.map((skill) => (
        <span
          key={skill}
          className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700"
        >
          {skill}
        </span>
      ))}
    </div>
  </div>
) : null}

{skillGapAnalysis.near_gap_skills.length > 0 ? (
  <div className="space-y-2">
    <p className="text-xs font-semibold text-slate-600">Near Gap</p>
    <div className="flex flex-wrap gap-2">
      {skillGapAnalysis.near_gap_skills.map((item) => (
        <span
          key={`${item.required_skill}:${item.support_skill}`}
          className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-700"
        >
          {item.required_skill} (via {item.support_skill})
        </span>
      ))}
    </div>
  </div>
) : null}
```

- [ ] **Step 3: Render `Hard Gap` and `Suggested Next Skills`**

```tsx
{skillGapAnalysis.hard_gap_skills.length > 0 ? (
  <div className="space-y-2">
    <p className="text-xs font-semibold text-slate-600">Hard Gap</p>
    <div className="flex flex-wrap gap-2">
      {skillGapAnalysis.hard_gap_skills.map((skill) => (
        <span
          key={skill}
          className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700"
        >
          {skill}
        </span>
      ))}
    </div>
  </div>
) : null}

{skillGapAnalysis.suggested_next_skills.length > 0 ? (
  <div className="space-y-2">
    <p className="text-xs font-semibold text-slate-600">Suggested Next Skills</p>
    <div className="flex flex-wrap gap-2">
      {skillGapAnalysis.suggested_next_skills.map((skill) => (
        <span
          key={skill}
          className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-medium text-violet-700"
        >
          {skill}
        </span>
      ))}
    </div>
  </div>
) : null}
```

- [ ] **Step 4: Insert the block under `Graph Explanation`**

```tsx
{renderGraphExplanation(report?.graph_scoring)}
{renderSkillGapAnalysis(report?.skill_gap_analysis)}
```

- [ ] **Step 5: Run frontend build verification**

Run: `docker compose exec frontend npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/components/jobs/job-candidate-panel.tsx
git commit -m "feat: render skill gap analysis for ranked candidates"
```

---

### Task 4: Add API Regression Coverage

**Files:**
- Modify: `backend/tests/api/test_job_ranking_api.py`

- [ ] **Step 1: Add persisted ranking API assertion**

```python
def test_get_job_ranking_returns_skill_gap_analysis(client, session) -> None:
    job = _create_job(session)
    candidate = _create_candidate(
        session,
        job_id=job.id,
        full_name="Gap Persisted Candidate",
        resume_text="GitHub: https://github.com/example/gap-persisted",
    )
    candidate.verification_status = "verified"
    candidate.verification_score = 90.0
    candidate.screening_decision = "pass"
    candidate.match_score = 82.0
    candidate.match_rank = 1
    candidate.match_summary = "Graph-aware match summary."
    candidate.final_report_json = {
        "graph_scoring": {
            "enabled": True,
            "used_fallback": False,
            "overlap_score": 0.75,
            "summary": "Strong direct match on python.",
            "exact_matches": ["python"],
            "prerequisite_matches": [],
            "missing_skills": ["aws"],
        },
        "skill_gap_analysis": {
            "ready_skills": ["python"],
            "near_gap_skills": [],
            "hard_gap_skills": ["aws"],
            "suggested_next_skills": ["aws"],
            "summary": "Ready on python. Still missing aws.",
        },
    }
    session.add(candidate)
    session.commit()

    response = client.get(f"/api/jobs/{job.id}/ranking")

    assert response.status_code == 200
    payload = response.json()
    assert payload["ranked_candidates"][0]["final_report_json"]["skill_gap_analysis"]["hard_gap_skills"] == ["aws"]
```

- [ ] **Step 2: Run focused API/backend verification**

Run: `./.venv/bin/python -m pytest backend/tests/services/test_candidate_screening_service.py backend/tests/api/test_job_ranking_api.py -k "skill_gap_analysis" -v`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/api/test_job_ranking_api.py
git commit -m "test: cover skill gap analysis payload"
```

---

### Task 5: Final Verification

**Files:**
- No code changes expected

- [ ] **Step 1: Run backend verification suite**

Run: `./.venv/bin/python -m pytest backend/tests/services/test_graph_match_service.py backend/tests/services/test_candidate_screening_service.py backend/tests/api/test_job_ranking_api.py -v`

Expected: PASS.

- [ ] **Step 2: Run adjacent backend regressions**

Run: `./.venv/bin/python -m pytest backend/tests/services/test_candidate_import_service.py backend/tests/services/test_job_import_service.py backend/tests/services/test_pdf_text_extractor.py backend/tests/api/test_candidate_import_api.py backend/tests/api/test_job_import_api.py -v`

Expected: PASS.

- [ ] **Step 3: Run final frontend build**

Run: `docker compose exec frontend npm run build`

Expected: PASS.

- [ ] **Step 4: Commit final verification-only state if needed**

```bash
git add backend/app/services/candidate_screening_service.py backend/tests/services/test_candidate_screening_service.py backend/tests/api/test_job_ranking_api.py frontend/lib/api.ts frontend/components/jobs/job-candidate-panel.tsx
git commit -m "chore: finalize skill gap analysis rollout"
```

If no files changed during verification, skip this commit.

---

## Self-Review

### Spec coverage

- backend skill-gap derivation: Task 1
- typed payload support: Task 2
- ranked candidate UI rendering: Task 3
- API regression coverage: Task 4
- final verification: Task 5

### Placeholder scan

- No `TODO`, `TBD`, or vague placeholders remain.
- Every task contains concrete file paths, commands, and code snippets.

### Type consistency

- `skill_gap_analysis` is used consistently across backend, API, and frontend
- `near_gap_skills` consistently uses `{required_skill, support_skill}`
- `suggested_next_skills` consistently remains `string[]`
