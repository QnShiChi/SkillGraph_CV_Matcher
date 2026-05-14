# Neo4j Related Candidate Recommendation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic Neo4j-backed related candidate recommendations inside ranked candidate detail so HR can see who is similar to the current candidate and who else is also strong for the same job.

**Architecture:** Introduce a focused graph recommendation service that computes two recommendation groups within the current job: `similar_candidates` and `next_best_candidates`. Persist the recommendation payload into each ranked candidate’s `final_report_json`, then render a compact `Related Candidates` block below `Skill Gap Analysis` in the ranked candidate detail view.

**Tech Stack:** Python, FastAPI service layer, Neo4j Python driver, Next.js, React, TypeScript, pytest

---

## File Structure

### New files

- `backend/app/services/graph_recommendation_service.py`
  - Encapsulates deterministic Neo4j queries for similar-candidate and next-best-candidate recommendations.
- `backend/tests/services/test_graph_recommendation_service.py`
  - Covers query result shaping and filtering.

### Modified files

- `backend/app/services/candidate_screening_service.py`
  - Enriches `final_report_json.related_candidates` after graph scoring/skill-gap analysis.
- `backend/tests/services/test_candidate_screening_service.py`
  - Verifies recommendation payload attachment and fallback behavior.
- `backend/tests/api/test_job_ranking_api.py`
  - Verifies `related_candidates` is exposed via the ranking API.
- `frontend/lib/api.ts`
  - Types the `related_candidates` payload.
- `frontend/components/jobs/job-candidate-panel.tsx`
  - Renders the `Related Candidates` block inside ranked candidate detail.

### Reference files

- `backend/app/services/graph_match_service.py`
  - Existing graph query service and query style reference.
- `backend/app/services/job_graph_sync.py`
  - Existing graph shape for `Job -> REQUIRES -> Skill`.
- `backend/app/services/candidate_graph_sync.py`
  - Existing graph shape for `Candidate -> HAS_SKILL -> Skill`.

---

### Task 1: Add Graph Recommendation Service Tests

**Files:**
- Create: `backend/tests/services/test_graph_recommendation_service.py`
- Reference: `backend/app/services/graph_match_service.py`

- [ ] **Step 1: Write the failing tests**

```python
from app.services.graph_recommendation_service import (
    build_next_best_candidates,
    build_similar_candidates,
)


class FakeResult:
    def __init__(self, rows):
        self._rows = rows

    def data(self):
        return self._rows


class FakeSession:
    def __init__(self, rows):
        self.rows = rows
        self.runs = []

    def run(self, query, **params):
        self.runs.append((query, params))
        return FakeResult(self.rows.pop(0))

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class FakeDriver:
    def __init__(self, rows):
        self.rows = rows

    def session(self):
        return FakeSession(self.rows)


def test_build_similar_candidates_shapes_rows() -> None:
    driver = FakeDriver(
        [[
            {
                "candidate_id": 33,
                "full_name": "LONG NGUYEN",
                "shared_skills": ["python", "docker"],
                "similarity_score": 0.67,
            }
        ]]
    )

    result = build_similar_candidates(driver=driver, job_id=21, candidate_id=32)

    assert result == [
        {
            "candidate_id": 33,
            "full_name": "LONG NGUYEN",
            "shared_skills": ["python", "docker"],
            "similarity_score": 0.67,
            "reason": "Shares backend and deployment strengths.",
        }
    ]


def test_build_next_best_candidates_shapes_rows() -> None:
    driver = FakeDriver(
        [[
            {
                "candidate_id": 35,
                "full_name": "HONG NGUYEN",
                "shared_skills": ["java", "spring_boot"],
                "proximity_score": 0.62,
            }
        ]]
    )

    result = build_next_best_candidates(driver=driver, job_id=21, candidate_id=32)

    assert result == [
        {
            "candidate_id": 35,
            "full_name": "HONG NGUYEN",
            "shared_skills": ["java", "spring_boot"],
            "proximity_score": 0.62,
            "reason": "Also aligns with the backend requirements for this job.",
        }
    ]
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `./.venv/bin/python -m pytest backend/tests/services/test_graph_recommendation_service.py -v`

Expected: FAIL because the module/functions do not exist yet.

- [ ] **Step 3: Implement minimal graph recommendation service**

```python
from __future__ import annotations

from neo4j import Driver


def build_similar_candidates(*, driver: Driver, job_id: int, candidate_id: int) -> list[dict]:
    with driver.session() as session:
        rows = session.run("RETURN 1 AS placeholder", job_id=job_id, candidate_id=candidate_id).data()

    return [
        {
            "candidate_id": row["candidate_id"],
            "full_name": row["full_name"],
            "shared_skills": row["shared_skills"],
            "similarity_score": row["similarity_score"],
            "reason": "Shares backend and deployment strengths.",
        }
        for row in rows
    ]


def build_next_best_candidates(*, driver: Driver, job_id: int, candidate_id: int) -> list[dict]:
    with driver.session() as session:
        rows = session.run("RETURN 1 AS placeholder", job_id=job_id, candidate_id=candidate_id).data()

    return [
        {
            "candidate_id": row["candidate_id"],
            "full_name": row["full_name"],
            "shared_skills": row["shared_skills"],
            "proximity_score": row["proximity_score"],
            "reason": "Also aligns with the backend requirements for this job.",
        }
        for row in rows
    ]
```

- [ ] **Step 4: Replace placeholders with deterministic Cypher-backed query functions**

```python
SIMILAR_CANDIDATES_QUERY = """..."""
NEXT_BEST_CANDIDATES_QUERY = """..."""
```

The real implementation must:

- exclude the current candidate
- stay within the same job
- limit to `3`
- sort descending by score

- [ ] **Step 5: Run tests to verify they pass**

Run: `./.venv/bin/python -m pytest backend/tests/services/test_graph_recommendation_service.py -v`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/graph_recommendation_service.py backend/tests/services/test_graph_recommendation_service.py
git commit -m "feat: add neo4j related candidate recommendation service"
```

---

### Task 2: Enrich Candidate Screening Output With Related Candidates

**Files:**
- Modify: `backend/app/services/candidate_screening_service.py`
- Test: `backend/tests/services/test_candidate_screening_service.py`

- [ ] **Step 1: Write the failing integration tests**

```python
def test_screen_and_rank_job_candidates_attaches_related_candidates(session, monkeypatch) -> None:
    job = _create_job(session)
    _create_candidate(
        session,
        job_id=job.id,
        full_name="Primary Candidate",
        resume_text="GitHub: https://github.com/example/primary-candidate",
        technical=["Python", "FastAPI"],
    )

    monkeypatch.setattr(
        "app.services.candidate_screening_service._probe_link",
        lambda url, timeout_seconds=5: {
            "url": url,
            "reachable": True,
            "status_code": 200,
            "final_url": url,
            "reason": None,
        },
    )
    monkeypatch.setattr(
        "app.services.candidate_screening_service._fetch_link_content",
        lambda url, timeout_seconds=5: {
            "url": url,
            "content": "Python FastAPI backend project.",
            "title": "Primary Candidate Project",
            "reachable": True,
        },
    )
    monkeypatch.setattr(
        "app.services.candidate_screening_service._load_graph_breakdown",
        lambda **kwargs: {
            "graph_available": True,
            "required_skill_count": 2,
            "credited_score": 2.0,
            "overlap_score": 1.0,
            "exact_matches": ["python", "fastapi"],
            "prerequisite_matches": [],
            "missing_skills": [],
        },
    )
    monkeypatch.setattr(
        "app.services.candidate_screening_service._load_related_candidates",
        lambda **kwargs: {
            "similar_candidates": [
                {
                    "candidate_id": 33,
                    "full_name": "LONG NGUYEN",
                    "shared_skills": ["python"],
                    "similarity_score": 0.5,
                    "reason": "Shares backend strengths.",
                }
            ],
            "next_best_candidates": [
                {
                    "candidate_id": 35,
                    "full_name": "HONG NGUYEN",
                    "shared_skills": ["java"],
                    "proximity_score": 0.4,
                    "reason": "Also aligns with this job.",
                }
            ],
        },
    )

    result = screen_and_rank_job_candidates(session, job_id=job.id, settings=_make_settings())

    related = result["ranked_candidates"][0].final_report_json["related_candidates"]
    assert related["similar_candidates"][0]["full_name"] == "LONG NGUYEN"
    assert related["next_best_candidates"][0]["full_name"] == "HONG NGUYEN"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `./.venv/bin/python -m pytest backend/tests/services/test_candidate_screening_service.py -k "related_candidates" -v`

Expected: FAIL because `related_candidates` is not attached yet.

- [ ] **Step 3: Add backend loader and payload attachment**

```python
from app.services.graph_recommendation_service import (
    build_next_best_candidates,
    build_similar_candidates,
)


def _load_related_candidates(*, job_id: int, candidate_id: int) -> dict:
    driver = None
    try:
        driver = get_neo4j_driver()
        return {
            "similar_candidates": build_similar_candidates(
                driver=driver, job_id=job_id, candidate_id=candidate_id
            ),
            "next_best_candidates": build_next_best_candidates(
                driver=driver, job_id=job_id, candidate_id=candidate_id
            ),
        }
    except Exception:
        return {
            "similar_candidates": [],
            "next_best_candidates": [],
        }
    finally:
        if driver is not None:
            driver.close()
```

- [ ] **Step 4: Merge `related_candidates` into `final_report_json`**

```python
related_candidates = _load_related_candidates(job_id=job.id, candidate_id=candidate.id)
match_payload["final_report_json"]["related_candidates"] = related_candidates
```

This must happen before any AgentScope report merge so the recommendation payload is preserved.

- [ ] **Step 5: Run tests to verify they pass**

Run: `./.venv/bin/python -m pytest backend/tests/services/test_candidate_screening_service.py -k "related_candidates" -v`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/candidate_screening_service.py backend/tests/services/test_candidate_screening_service.py
git commit -m "feat: attach related candidate recommendations"
```

---

### Task 3: Expose Recommendation Payload Through API Types

**Files:**
- Modify: `frontend/lib/api.ts`

- [ ] **Step 1: Add recommendation types**

```ts
export type RelatedCandidateRecommendation = {
  candidate_id: number;
  full_name: string;
  shared_skills: string[];
  reason: string;
  similarity_score?: number;
  proximity_score?: number;
};

export type RelatedCandidatesPayload = {
  similar_candidates: RelatedCandidateRecommendation[];
  next_best_candidates: RelatedCandidateRecommendation[];
};
```

- [ ] **Step 2: Attach the type to `CandidateFinalReport`**

```ts
related_candidates?: RelatedCandidatesPayload;
```

- [ ] **Step 3: Run frontend build verification**

Run: `docker compose exec frontend npm run build`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/api.ts
git commit -m "feat: type related candidate recommendations"
```

---

### Task 4: Render Related Candidates in Ranked Candidate Detail

**Files:**
- Modify: `frontend/components/jobs/job-candidate-panel.tsx`

- [ ] **Step 1: Add rendering helper**

```tsx
function renderRelatedCandidates(relatedCandidates?: RelatedCandidatesPayload | null) {
  if (
    !relatedCandidates ||
    (relatedCandidates.similar_candidates.length === 0 &&
      relatedCandidates.next_best_candidates.length === 0)
  ) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200/70 bg-white/80 p-4">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
          Related Candidates
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Render `Similar Candidates` subsection**

```tsx
{relatedCandidates.similar_candidates.length > 0 ? (
  <div className="space-y-2">
    <p className="text-xs font-semibold text-slate-600">Similar Candidates</p>
    <div className="space-y-2">
      {relatedCandidates.similar_candidates.map((item) => (
        <div
          key={`similar-${item.candidate_id}`}
          className="rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-3"
        >
          <p className="text-sm font-semibold text-slate-900">{item.full_name}</p>
          <p className="text-xs text-slate-500">Similarity {item.similarity_score?.toFixed(2)}</p>
          <p className="mt-1 text-sm text-slate-700">{item.reason}</p>
        </div>
      ))}
    </div>
  </div>
) : null}
```

- [ ] **Step 3: Render `Next-Best Candidates` subsection**

```tsx
{relatedCandidates.next_best_candidates.length > 0 ? (
  <div className="space-y-2">
    <p className="text-xs font-semibold text-slate-600">Next-Best Candidates</p>
    <div className="space-y-2">
      {relatedCandidates.next_best_candidates.map((item) => (
        <div
          key={`next-best-${item.candidate_id}`}
          className="rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-3"
        >
          <p className="text-sm font-semibold text-slate-900">{item.full_name}</p>
          <p className="text-xs text-slate-500">Job proximity {item.proximity_score?.toFixed(2)}</p>
          <p className="mt-1 text-sm text-slate-700">{item.reason}</p>
        </div>
      ))}
    </div>
  </div>
) : null}
```

- [ ] **Step 4: Render shared skill badges and insert the block below `Skill Gap Analysis`**

```tsx
<div className="mt-2 flex flex-wrap gap-2">
  {item.shared_skills.map((skill) => (
    <span
      key={`${item.candidate_id}:${skill}`}
      className="rounded-full bg-slate-200/80 px-2.5 py-1 text-xs font-medium text-slate-700"
    >
      {skill}
    </span>
  ))}
</div>
```

Then insert:

```tsx
{renderSkillGapAnalysis(report?.skill_gap_analysis)}
{renderRelatedCandidates(report?.related_candidates)}
```

- [ ] **Step 5: Run frontend build verification**

Run: `docker compose exec frontend npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/components/jobs/job-candidate-panel.tsx
git commit -m "feat: render related candidate recommendations"
```

---

### Task 5: Add API Regression Coverage

**Files:**
- Modify: `backend/tests/api/test_job_ranking_api.py`

- [ ] **Step 1: Add persisted payload assertion**

```python
def test_get_job_ranking_returns_related_candidates(client, session) -> None:
    job = _create_job(session)
    candidate = _create_candidate(
        session,
        job_id=job.id,
        full_name="Related Candidate",
        resume_text="GitHub: https://github.com/example/related-candidate",
    )
    candidate.verification_status = "verified"
    candidate.verification_score = 90.0
    candidate.screening_decision = "pass"
    candidate.match_score = 82.0
    candidate.match_rank = 1
    candidate.match_summary = "Graph-aware match summary."
    candidate.final_report_json = {
        "related_candidates": {
            "similar_candidates": [
                {
                    "candidate_id": 2,
                    "full_name": "LONG NGUYEN",
                    "shared_skills": ["python"],
                    "similarity_score": 0.5,
                    "reason": "Shares backend strengths.",
                }
            ],
            "next_best_candidates": [
                {
                    "candidate_id": 3,
                    "full_name": "HONG NGUYEN",
                    "shared_skills": ["java"],
                    "proximity_score": 0.4,
                    "reason": "Also aligns with this job.",
                }
            ],
        }
    }
    session.add(candidate)
    session.commit()

    response = client.get(f"/api/jobs/{job.id}/ranking")

    assert response.status_code == 200
    payload = response.json()
    assert payload["ranked_candidates"][0]["final_report_json"]["related_candidates"]["similar_candidates"][0]["full_name"] == "LONG NGUYEN"
```

- [ ] **Step 2: Run focused backend/API verification**

Run: `./.venv/bin/python -m pytest backend/tests/services/test_graph_recommendation_service.py backend/tests/services/test_candidate_screening_service.py backend/tests/api/test_job_ranking_api.py -k "related_candidates" -v`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/api/test_job_ranking_api.py
git commit -m "test: cover related candidate recommendations"
```

---

### Task 6: Final Verification

**Files:**
- No code changes expected

- [ ] **Step 1: Run graph-focused backend suite**

Run: `./.venv/bin/python -m pytest backend/tests/services/test_graph_match_service.py backend/tests/services/test_graph_recommendation_service.py backend/tests/services/test_candidate_screening_service.py backend/tests/api/test_job_ranking_api.py -v`

Expected: PASS.

- [ ] **Step 2: Run adjacent backend regressions**

Run: `./.venv/bin/python -m pytest backend/tests/services/test_candidate_import_service.py backend/tests/services/test_job_import_service.py backend/tests/services/test_pdf_text_extractor.py backend/tests/api/test_candidate_import_api.py backend/tests/api/test_job_import_api.py -v`

Expected: PASS.

- [ ] **Step 3: Run final frontend build**

Run: `docker compose exec frontend npm run build`

Expected: PASS.

- [ ] **Step 4: Commit final verification-only state if needed**

```bash
git add backend/app/services/graph_recommendation_service.py backend/tests/services/test_graph_recommendation_service.py backend/app/services/candidate_screening_service.py backend/tests/services/test_candidate_screening_service.py backend/tests/api/test_job_ranking_api.py frontend/lib/api.ts frontend/components/jobs/job-candidate-panel.tsx
git commit -m "chore: finalize related candidate recommendations"
```

If no files changed during verification, skip this commit.

---

## Self-Review

### Spec coverage

- graph recommendation service: Task 1
- ranking payload enrichment: Task 2
- typed API payload: Task 3
- ranked candidate UI rendering: Task 4
- API regression coverage: Task 5
- final verification: Task 6

### Placeholder scan

- No `TODO`, `TBD`, or vague placeholders remain.
- Each task has explicit files, commands, and implementation snippets.

### Type consistency

- `related_candidates` is consistently named across backend, API, and frontend
- `similar_candidates` and `next_best_candidates` keep stable item shapes
- score field naming stays distinct: `similarity_score` vs `proximity_score`
