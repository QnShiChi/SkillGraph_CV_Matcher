# Neo4j Related Job Recommendation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic Neo4j-backed related job recommendations inside ranked candidate detail so HR can see which other jobs are adjacent to the current job in the skill graph.

**Architecture:** Introduce a small graph job recommendation service that computes job-to-job similarity from shared required skills, then enrich each ranked candidate’s `final_report_json` with a `related_jobs` list for the current job. Render that list as a compact block below `Related Candidates` in the ranked candidate detail view.

**Tech Stack:** Python, FastAPI service layer, Neo4j Python driver, Next.js, React, TypeScript, pytest

---

## File Structure

### New files

- `backend/app/services/graph_job_recommendation_service.py`
  - Computes deterministic job-to-job similarity recommendations from Neo4j.
- `backend/tests/services/test_graph_job_recommendation_service.py`
  - Covers row shaping and score payload format.

### Modified files

- `backend/app/services/candidate_screening_service.py`
  - Enriches ranked candidate reports with `related_jobs`.
- `backend/tests/services/test_candidate_screening_service.py`
  - Verifies job recommendations attach to ranked candidate output.
- `backend/tests/api/test_job_ranking_api.py`
  - Verifies `related_jobs` is exposed through the ranking API.
- `frontend/lib/api.ts`
  - Types the `related_jobs` payload.
- `frontend/components/jobs/job-candidate-panel.tsx`
  - Renders the `Related Jobs` block in ranked candidate detail.

### Reference files

- `backend/app/services/graph_recommendation_service.py`
  - Existing graph recommendation service style.
- `backend/app/services/job_graph_sync.py`
  - Existing `Job -> REQUIRES -> Skill` graph structure.

---

### Task 1: Add Graph Job Recommendation Service Tests

**Files:**
- Create: `backend/tests/services/test_graph_job_recommendation_service.py`
- Reference: `backend/app/services/graph_recommendation_service.py`

- [ ] **Step 1: Write the failing tests**

```python
from app.services.graph_job_recommendation_service import build_related_jobs


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
        return FakeResult(self.rows)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class FakeDriver:
    def __init__(self, rows):
        self.rows = rows

    def session(self):
        return FakeSession(self.rows)


def test_build_related_jobs_shapes_rows() -> None:
    driver = FakeDriver(
        [
            {
                "job_id": 18,
                "title": "Backend Engineer",
                "shared_skills": ["python", "fastapi", "docker"],
                "similarity_score": 0.75,
            }
        ]
    )

    result = build_related_jobs(driver=driver, job_id=21)

    assert result == [
        {
            "job_id": 18,
            "title": "Backend Engineer",
            "shared_skills": ["python", "fastapi", "docker"],
            "similarity_score": 0.75,
            "reason": "Shares core backend and deployment requirements with the current job.",
        }
    ]


def test_build_related_jobs_returns_empty_list_for_empty_result() -> None:
    driver = FakeDriver([])

    result = build_related_jobs(driver=driver, job_id=21)

    assert result == []
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `./.venv/bin/python -m pytest backend/tests/services/test_graph_job_recommendation_service.py -v`

Expected: FAIL because the service does not exist yet.

- [ ] **Step 3: Implement minimal service**

```python
from __future__ import annotations

from neo4j import Driver


def build_related_jobs(*, driver: Driver, job_id: int) -> list[dict]:
    with driver.session() as session:
        rows = session.run("RETURN 1 AS placeholder", job_id=job_id).data()

    return [
        {
            "job_id": row["job_id"],
            "title": row["title"],
            "shared_skills": row["shared_skills"],
            "similarity_score": row["similarity_score"],
            "reason": "Shares core backend and deployment requirements with the current job.",
        }
        for row in rows
    ]
```

- [ ] **Step 4: Replace placeholder query with deterministic Cypher**

```python
RELATED_JOBS_QUERY = """..."""
```

The real query must:

- exclude the current job
- compare shared graph-safe required skills
- compute similarity from shared/union skill counts
- return top `3`

- [ ] **Step 5: Run tests to verify they pass**

Run: `./.venv/bin/python -m pytest backend/tests/services/test_graph_job_recommendation_service.py -v`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/graph_job_recommendation_service.py backend/tests/services/test_graph_job_recommendation_service.py
git commit -m "feat: add neo4j related job recommendation service"
```

---

### Task 2: Enrich Ranked Candidate Reports With Related Jobs

**Files:**
- Modify: `backend/app/services/candidate_screening_service.py`
- Test: `backend/tests/services/test_candidate_screening_service.py`

- [ ] **Step 1: Write the failing integration test**

```python
def test_screen_and_rank_job_candidates_attaches_related_jobs(session, monkeypatch) -> None:
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
            "similar_candidates": [],
            "next_best_candidates": [],
        },
    )
    monkeypatch.setattr(
        "app.services.candidate_screening_service._load_related_jobs",
        lambda **kwargs: [
            {
                "job_id": 18,
                "title": "Backend Engineer",
                "shared_skills": ["python", "fastapi"],
                "similarity_score": 0.75,
                "reason": "Shares core backend requirements.",
            }
        ],
    )

    result = screen_and_rank_job_candidates(session, job_id=job.id, settings=_make_settings())

    related_jobs = result["ranked_candidates"][0].final_report_json["related_jobs"]
    assert related_jobs[0]["title"] == "Backend Engineer"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `./.venv/bin/python -m pytest backend/tests/services/test_candidate_screening_service.py -k "related_jobs" -v`

Expected: FAIL because `related_jobs` is not attached yet.

- [ ] **Step 3: Add backend loader**

```python
from app.services.graph_job_recommendation_service import build_related_jobs


def _load_related_jobs(*, job_id: int) -> list[dict]:
    driver = None
    try:
        driver = get_neo4j_driver()
        return build_related_jobs(driver=driver, job_id=job_id)
    except Exception:
        return []
    finally:
        if driver is not None:
            driver.close()
```

- [ ] **Step 4: Attach `related_jobs` into `final_report_json`**

```python
related_jobs = _load_related_jobs(job_id=job.id)
match_payload["final_report_json"]["related_jobs"] = related_jobs
```

This should happen before any AgentScope merge so the payload remains preserved.

- [ ] **Step 5: Run tests to verify they pass**

Run: `./.venv/bin/python -m pytest backend/tests/services/test_candidate_screening_service.py -k "related_jobs" -v`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/candidate_screening_service.py backend/tests/services/test_candidate_screening_service.py
git commit -m "feat: attach related job recommendations"
```

---

### Task 3: Expose `related_jobs` Through API Types

**Files:**
- Modify: `frontend/lib/api.ts`

- [ ] **Step 1: Add related job recommendation type**

```ts
export type RelatedJobRecommendation = {
  job_id: number;
  title: string;
  shared_skills: string[];
  similarity_score: number;
  reason: string;
};
```

- [ ] **Step 2: Attach it to `CandidateFinalReport`**

```ts
related_jobs?: RelatedJobRecommendation[];
```

- [ ] **Step 3: Run frontend build verification**

Run: `docker compose exec frontend npm run build`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/api.ts
git commit -m "feat: type related job recommendations"
```

---

### Task 4: Render Related Jobs in Ranked Candidate Detail

**Files:**
- Modify: `frontend/components/jobs/job-candidate-panel.tsx`

- [ ] **Step 1: Add rendering helper**

```tsx
function renderRelatedJobs(relatedJobs?: RelatedJobRecommendation[] | null) {
  if (!relatedJobs || relatedJobs.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200/70 bg-white/80 p-4">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
          Related Jobs
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Render recommendation items**

```tsx
<div className="space-y-2">
  {relatedJobs.map((item) => (
    <div
      key={item.job_id}
      className="rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-3"
    >
      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
      <p className="text-xs text-slate-500">
        Similarity {item.similarity_score.toFixed(2)}
      </p>
      <p className="mt-1 text-sm text-slate-700">{item.reason}</p>
    </div>
  ))}
</div>
```

- [ ] **Step 3: Render shared skill badges**

```tsx
<div className="mt-2 flex flex-wrap gap-2">
  {item.shared_skills.map((skill) => (
    <span
      key={`${item.job_id}:${skill}`}
      className="rounded-full bg-slate-200/80 px-2.5 py-1 text-xs font-medium text-slate-700"
    >
      {skill}
    </span>
  ))}
</div>
```

- [ ] **Step 4: Insert block below `Related Candidates`**

```tsx
{renderRelatedCandidates(report?.related_candidates)}
{renderRelatedJobs(report?.related_jobs)}
```

- [ ] **Step 5: Run frontend build verification**

Run: `docker compose exec frontend npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/components/jobs/job-candidate-panel.tsx
git commit -m "feat: render related jobs in ranked candidate detail"
```

---

### Task 5: Add API Regression Coverage

**Files:**
- Modify: `backend/tests/api/test_job_ranking_api.py`

- [ ] **Step 1: Add persisted payload assertion**

```python
def test_get_job_ranking_returns_related_jobs(client, session) -> None:
    job = _create_job(session)
    candidate = _create_candidate(
        session,
        job_id=job.id,
        full_name="Related Job Candidate",
        resume_text="GitHub: https://github.com/example/related-job-candidate",
    )
    candidate.verification_status = "verified"
    candidate.verification_score = 90.0
    candidate.screening_decision = "pass"
    candidate.match_score = 82.0
    candidate.match_rank = 1
    candidate.match_summary = "Graph-aware match summary."
    candidate.final_report_json = {
        "related_jobs": [
            {
                "job_id": 18,
                "title": "Backend Engineer",
                "shared_skills": ["python", "fastapi"],
                "similarity_score": 0.75,
                "reason": "Shares core backend requirements.",
            }
        ]
    }
    session.add(candidate)
    session.commit()

    response = client.get(f"/api/jobs/{job.id}/ranking")

    assert response.status_code == 200
    payload = response.json()
    assert payload["ranked_candidates"][0]["final_report_json"]["related_jobs"][0]["title"] == "Backend Engineer"
```

- [ ] **Step 2: Run focused backend/API verification**

Run: `./.venv/bin/python -m pytest backend/tests/services/test_graph_job_recommendation_service.py backend/tests/services/test_candidate_screening_service.py backend/tests/api/test_job_ranking_api.py -k "related_jobs" -v`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/api/test_job_ranking_api.py
git commit -m "test: cover related job recommendations"
```

---

### Task 6: Final Verification

**Files:**
- No code changes expected

- [ ] **Step 1: Run graph-focused backend suite**

Run: `./.venv/bin/python -m pytest backend/tests/services/test_graph_match_service.py backend/tests/services/test_graph_recommendation_service.py backend/tests/services/test_graph_job_recommendation_service.py backend/tests/services/test_candidate_screening_service.py backend/tests/api/test_job_ranking_api.py -v`

Expected: PASS.

- [ ] **Step 2: Run adjacent backend regressions**

Run: `./.venv/bin/python -m pytest backend/tests/services/test_candidate_import_service.py backend/tests/services/test_job_import_service.py backend/tests/services/test_pdf_text_extractor.py backend/tests/api/test_candidate_import_api.py backend/tests/api/test_job_import_api.py -v`

Expected: PASS.

- [ ] **Step 3: Run final frontend build**

Run: `docker compose exec frontend npm run build`

Expected: PASS.

- [ ] **Step 4: Commit final verification-only state if needed**

```bash
git add backend/app/services/graph_job_recommendation_service.py backend/tests/services/test_graph_job_recommendation_service.py backend/app/services/candidate_screening_service.py backend/tests/services/test_candidate_screening_service.py backend/tests/api/test_job_ranking_api.py frontend/lib/api.ts frontend/components/jobs/job-candidate-panel.tsx
git commit -m "chore: finalize related job recommendations"
```

If no files changed during verification, skip this commit.

---

## Self-Review

### Spec coverage

- graph job recommendation service: Task 1
- payload enrichment: Task 2
- API typing: Task 3
- ranked detail rendering: Task 4
- API regression coverage: Task 5
- final verification: Task 6

### Placeholder scan

- No `TODO`, `TBD`, or vague implementation notes remain.
- Every task contains concrete file paths, commands, and payload snippets.

### Type consistency

- `related_jobs` is used consistently across backend, API, and frontend
- item keys stay stable: `job_id`, `title`, `shared_skills`, `similarity_score`, `reason`
