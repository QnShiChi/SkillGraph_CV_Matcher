# Neo4j Graph Explanation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface recruiter-facing Neo4j graph reasoning inside the ranked candidate detail view without changing ranking behavior or re-expanding the compressed job workspace UI.

**Architecture:** Enrich the existing `final_report_json.graph_scoring` payload with a deterministic summary sentence in backend scoring code, then render a compact `Graph Explanation` block inside the expandable ranked-candidate detail view. The block should reuse the current summary-first UI pattern by showing only short sections for exact matches, prerequisite-supported matches, and missing skills.

**Tech Stack:** Python, FastAPI service layer, Next.js, React, TypeScript, pytest

---

## File Structure

### Modified files

- `backend/app/services/candidate_screening_service.py`
  - Add deterministic graph explanation summary text to `final_report_json.graph_scoring`.
- `backend/tests/services/test_candidate_screening_service.py`
  - Verify `graph_scoring.summary` for exact, prerequisite, and fallback cases.
- `frontend/components/jobs/candidate-list-item.tsx`
  - Render the `Graph Explanation` block in the expanded ranked-candidate detail.
- `frontend/lib/api.ts`
  - Tighten the TypeScript shape for `graph_scoring` so the UI can render safely.

### Reference files

- `backend/app/services/graph_match_service.py`
  - Existing graph scoring breakdown source.
- `frontend/components/jobs/job-candidate-panel.tsx`
  - Existing candidate list composition and section order.

---

### Task 1: Add Backend Summary Generation for Graph Explanation

**Files:**
- Modify: `backend/app/services/candidate_screening_service.py`
- Test: `backend/tests/services/test_candidate_screening_service.py`

- [ ] **Step 1: Write the failing backend tests**

```python
def test_score_candidate_graph_scoring_summary_prefers_exact_and_prerequisite_language(session) -> None:
    job = _create_job(session)
    candidate = _create_candidate(
        session,
        job_id=job.id,
        full_name="Summary Candidate",
        resume_text="GitHub: https://github.com/example/summary-candidate",
        technical=["Python", "Docker"],
    )
    candidate.verified_links_json = [{"final_url": "https://github.com/example/summary-candidate"}]

    result = _score_candidate(
        {
            "required_skills": [
                {"canonical": "fastapi", "requirement_type": "must_have"},
                {"canonical": "docker", "requirement_type": "must_have"},
            ],
            "technical_skills": [{"canonical": "fastapi"}],
            "platforms_cloud": [],
            "tooling_devops": [{"canonical": "docker"}],
        },
        candidate,
        graph_breakdown={
            "graph_available": True,
            "required_skill_count": 2,
            "credited_score": 1.5,
            "overlap_score": 0.75,
            "exact_matches": ["docker"],
            "prerequisite_matches": [
                {"required_skill": "fastapi", "support_skill": "python", "credit": 0.5}
            ],
            "missing_skills": [],
        },
    )

    summary = result["final_report_json"]["graph_scoring"]["summary"]
    assert "docker" in summary.lower()
    assert "fastapi" in summary.lower()
    assert "python" in summary.lower()


def test_score_candidate_graph_scoring_summary_reports_fallback(session) -> None:
    job = _create_job(session)
    candidate = _create_candidate(
        session,
        job_id=job.id,
        full_name="Fallback Summary Candidate",
        resume_text="GitHub: https://github.com/example/fallback-summary",
        technical=["Python"],
    )
    candidate.verified_links_json = [{"final_url": "https://github.com/example/fallback-summary"}]

    result = _score_candidate(
        job.structured_jd_json or {},
        candidate,
        graph_breakdown=None,
    )

    assert result["final_report_json"]["graph_scoring"]["summary"] == (
        "Graph scoring unavailable. Showing direct skill overlap fallback."
    )
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `./.venv/bin/python -m pytest backend/tests/services/test_candidate_screening_service.py -k "graph_scoring_summary" -v`

Expected: FAIL because `graph_scoring.summary` is not present.

- [ ] **Step 3: Add deterministic summary builder**

```python
def _build_graph_scoring_summary(graph_scoring: dict) -> str:
    if graph_scoring["used_fallback"]:
        return "Graph scoring unavailable. Showing direct skill overlap fallback."

    exact = graph_scoring.get("exact_matches", [])
    prerequisite = graph_scoring.get("prerequisite_matches", [])
    missing = graph_scoring.get("missing_skills", [])

    parts: list[str] = []
    if exact:
        parts.append(f"Strong direct match on {', '.join(exact[:3])}.")
    if prerequisite:
        first = prerequisite[0]
        parts.append(
            f"Prerequisite support for {first['required_skill']} through {first['support_skill']}."
        )
    if missing:
        parts.append(f"Still missing {', '.join(missing[:3])}.")
    if not parts:
        return "Graph scoring found no meaningful skill support."
    return " ".join(parts)
```

- [ ] **Step 4: Attach summary to `graph_scoring`**

```python
graph_scoring = {
    "enabled": graph_breakdown is not None,
    "used_fallback": not bool(graph_breakdown and graph_breakdown.get("graph_available")),
    "exact_matches": list(graph_breakdown.get("exact_matches", [])) if graph_breakdown else [],
    "prerequisite_matches": list(graph_breakdown.get("prerequisite_matches", [])) if graph_breakdown else [],
    "missing_skills": list(graph_breakdown.get("missing_skills", [])) if graph_breakdown else missing_required,
    "overlap_score": overlap_score,
}
graph_scoring["summary"] = _build_graph_scoring_summary(graph_scoring)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `./.venv/bin/python -m pytest backend/tests/services/test_candidate_screening_service.py -k "graph_scoring_summary" -v`

Expected: PASS for both summary cases.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/candidate_screening_service.py backend/tests/services/test_candidate_screening_service.py
git commit -m "feat: add graph explanation summaries"
```

---

### Task 2: Add Typed Graph Scoring Shape in Frontend API Layer

**Files:**
- Modify: `frontend/lib/api.ts`

- [ ] **Step 1: Write the failing type usage by introducing explicit graph-scoring reads in the UI task**

```ts
type GraphScoringSummary = {
  enabled: boolean;
  used_fallback: boolean;
  overlap_score: number;
  summary: string;
  exact_matches: string[];
  prerequisite_matches: Array<{
    required_skill: string;
    support_skill: string;
    credit: number;
  }>;
  missing_skills: string[];
};
```

- [ ] **Step 2: Add the type to the API contract**

```ts
export type GraphScoringSummary = {
  enabled: boolean;
  used_fallback: boolean;
  overlap_score: number;
  summary: string;
  exact_matches: string[];
  prerequisite_matches: Array<{
    required_skill: string;
    support_skill: string;
    credit: number;
  }>;
  missing_skills: string[];
};

export type CandidateFinalReport = {
  strengths?: string[];
  gaps?: string[];
  verified_links?: Array<Record<string, unknown>>;
  explanation?: string;
  critic_review?: string;
  graph_scoring?: GraphScoringSummary;
  [key: string]: unknown;
};
```

- [ ] **Step 3: Wire candidate response types to use `CandidateFinalReport`**

```ts
final_report_json?: CandidateFinalReport | null;
```

- [ ] **Step 4: Run frontend type/build verification**

Run: `docker compose exec frontend npm run build`

Expected: PASS with no TypeScript errors from the tightened graph-scoring shape.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/api.ts
git commit -m "feat: type graph explanation payload"
```

---

### Task 3: Render Graph Explanation in Ranked Candidate Detail

**Files:**
- Modify: `frontend/components/jobs/candidate-list-item.tsx`

- [ ] **Step 1: Add the rendering helper inside the component**

```tsx
function renderGraphExplanation(graphScoring?: GraphScoringSummary | null) {
  if (!graphScoring?.enabled) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
          Graph Explanation
        </p>
        <p className="text-sm leading-6 text-slate-700">{graphScoring.summary}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Extend the block with exact matches**

```tsx
{graphScoring.exact_matches.length > 0 ? (
  <div className="space-y-2">
    <p className="text-xs font-semibold text-slate-600">Exact Matches</p>
    <div className="flex flex-wrap gap-2">
      {graphScoring.exact_matches.map((skill) => (
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
```

- [ ] **Step 3: Extend the block with prerequisite-supported matches and missing skills**

```tsx
{graphScoring.prerequisite_matches.length > 0 ? (
  <div className="space-y-2">
    <p className="text-xs font-semibold text-slate-600">Prerequisite-Supported Matches</p>
    <div className="space-y-2">
      {graphScoring.prerequisite_matches.map((item) => (
        <div
          key={`${item.required_skill}:${item.support_skill}`}
          className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
        >
          <span className="font-medium text-slate-900">{item.required_skill}</span>
          <span className="mx-2 text-slate-400">&larr;</span>
          <span>{item.support_skill}</span>
        </div>
      ))}
    </div>
  </div>
) : null}

{graphScoring.missing_skills.length > 0 ? (
  <div className="space-y-2">
    <p className="text-xs font-semibold text-slate-600">Missing Skills</p>
    <div className="flex flex-wrap gap-2">
      {graphScoring.missing_skills.map((skill) => (
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
```

- [ ] **Step 4: Insert the block into the expanded ranked-candidate detail**

```tsx
{candidate.final_report_json?.graph_scoring ? (
  renderGraphExplanation(candidate.final_report_json.graph_scoring)
) : null}
```

- [ ] **Step 5: Run frontend build verification**

Run: `docker compose exec frontend npm run build`

Expected: PASS with the new graph explanation block rendering safely.

- [ ] **Step 6: Commit**

```bash
git add frontend/components/jobs/candidate-list-item.tsx
git commit -m "feat: render graph explanation for ranked candidates"
```

---

### Task 4: Verify End-to-End Payload and UI Contract

**Files:**
- Modify if needed: `backend/tests/api/test_job_ranking_api.py`

- [ ] **Step 1: Add API regression for graph-scoring summary**

```python
def test_get_job_ranking_returns_graph_scoring_summary(client, session) -> None:
    job = _create_job(session)
    candidate = _create_candidate(
        session,
        job_id=job.id,
        full_name="Graph Summary Candidate",
        resume_text="GitHub: https://github.com/example/graph-summary",
    )
    candidate.verification_status = "verified"
    candidate.verification_score = 90.0
    candidate.screening_decision = "pass"
    candidate.match_score = 80.0
    candidate.match_rank = 1
    candidate.match_summary = "Graph-aware match summary."
    candidate.final_report_json = {
        "strengths": ["python"],
        "gaps": ["aws"],
        "graph_scoring": {
            "enabled": True,
            "used_fallback": False,
            "overlap_score": 0.75,
            "summary": "Strong direct match on python.",
            "exact_matches": ["python"],
            "prerequisite_matches": [],
            "missing_skills": ["aws"],
        },
    }
    session.add(candidate)
    session.commit()

    response = client.get(f"/api/jobs/{job.id}/ranking")

    assert response.status_code == 200
    payload = response.json()
    assert payload["ranked_candidates"][0]["final_report_json"]["graph_scoring"]["summary"] == (
        "Strong direct match on python."
    )
```

- [ ] **Step 2: Run focused backend/API verification**

Run: `./.venv/bin/python -m pytest backend/tests/services/test_candidate_screening_service.py backend/tests/api/test_job_ranking_api.py -k "graph_scoring or graph_summary" -v`

Expected: PASS with the summary field exposed in API output.

- [ ] **Step 3: Run full frontend build check**

Run: `docker compose exec frontend npm run build`

Expected: PASS with no UI/type regressions.

- [ ] **Step 4: Manual smoke-check candidate detail HTML anchor text**

Run: `bash -lc "curl -s http://localhost:3000/jobs/21 | grep -o 'Graph Explanation\\|Exact Matches\\|Prerequisite-Supported Matches\\|Missing Skills' | sort | uniq -c"`

Expected: output includes the new section labels when seeded/rendered content is present.

- [ ] **Step 5: Commit**

```bash
git add backend/tests/api/test_job_ranking_api.py
git commit -m "test: cover graph explanation payload"
```

---

### Task 5: Final Verification

**Files:**
- No code changes expected

- [ ] **Step 1: Run backend verification suite**

Run: `./.venv/bin/python -m pytest backend/tests/services/test_graph_match_service.py backend/tests/services/test_candidate_screening_service.py backend/tests/api/test_job_ranking_api.py -v`

Expected: PASS for graph scoring and explanation coverage.

- [ ] **Step 2: Run adjacent backend regressions**

Run: `./.venv/bin/python -m pytest backend/tests/services/test_candidate_import_service.py backend/tests/services/test_job_import_service.py backend/tests/services/test_pdf_text_extractor.py backend/tests/api/test_candidate_import_api.py backend/tests/api/test_job_import_api.py -v`

Expected: PASS, confirming explanation surfacing did not regress import behavior.

- [ ] **Step 3: Run final frontend build**

Run: `docker compose exec frontend npm run build`

Expected: PASS.

- [ ] **Step 4: Commit final verification-only state if needed**

```bash
git add backend/app/services/candidate_screening_service.py backend/tests/services/test_candidate_screening_service.py backend/tests/api/test_job_ranking_api.py frontend/lib/api.ts frontend/components/jobs/candidate-list-item.tsx
git commit -m "chore: finalize graph explanation rollout"
```

If no files changed during verification, skip this commit.

---

## Self-Review

### Spec coverage

- backend summary enrichment: Task 1
- UI graph explanation block: Task 3
- typed payload support: Task 2
- API regression and build validation: Task 4
- full verification: Task 5

### Placeholder scan

- No `TODO`, `TBD`, or vague “handle appropriately” steps remain.
- Each implementation and verification step names exact files and commands.

### Type consistency

- `graph_scoring.summary` is consistently named across backend, API, and frontend
- `prerequisite_matches` uses the same `{required_skill, support_skill, credit}` shape in all tasks
- rendering target remains `candidate.final_report_json.graph_scoring`
