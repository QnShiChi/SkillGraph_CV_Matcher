# Neo4j Graph Scoring v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic Neo4j-backed 1-hop prerequisite partial credit to candidate ranking while preserving the current verifier, screening gate, and fallback behavior.

**Architecture:** Introduce a small graph query service that returns per-skill match breakdowns for one job and one candidate. Integrate that breakdown into `candidate_screening_service.py` so the existing weighted score keeps the same top-level structure while the skill-overlap portion becomes graph-aware when Neo4j is available and falls back cleanly when it is not.

**Tech Stack:** Python, FastAPI service layer, SQLAlchemy models, Neo4j Python driver, pytest

---

## File Structure

### New files

- `backend/app/services/graph_match_service.py`
  - Encapsulates Neo4j Cypher queries and returns a deterministic graph scoring breakdown for one job/candidate pair.
- `backend/tests/services/test_graph_match_service.py`
  - Covers exact match, prerequisite match, missing skill, and graph query shaping.

### Modified files

- `backend/app/services/candidate_screening_service.py`
  - Calls the graph match service from `_score_candidate(...)`, applies fallback behavior, and persists graph breakdown in `final_report_json`.
- `backend/tests/services/test_candidate_screening_service.py`
  - Extends score tests to cover graph-enabled scoring, no double count, and Neo4j fallback.

### Reference files

- `backend/app/services/job_graph_sync.py`
  - Existing graph shape for `(:Job)-[:REQUIRES]->(:Skill)` and `(:Skill)-[:PREREQUISITE_OF]->(:Skill)`.
- `backend/app/services/candidate_graph_sync.py`
  - Existing graph shape for `(:Candidate)-[:HAS_SKILL]->(:Skill)`.
- `backend/app/services/skill_taxonomy.py`
  - Existing curated prerequisite map.

---

### Task 1: Add Graph Match Service Tests

**Files:**
- Create: `backend/tests/services/test_graph_match_service.py`
- Reference: `backend/app/services/job_graph_sync.py`
- Reference: `backend/app/services/candidate_graph_sync.py`

- [ ] **Step 1: Write the failing tests**

```python
from app.services.graph_match_service import build_graph_skill_breakdown


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


def test_build_graph_skill_breakdown_returns_exact_prerequisite_and_missing_rows():
    driver = FakeDriver(
        [
            {
                "required_skill": "spring_boot",
                "match_type": "exact",
                "support_skill": None,
                "credit": 1.0,
            },
            {
                "required_skill": "postgresql",
                "match_type": "prerequisite",
                "support_skill": "sql",
                "credit": 0.5,
            },
            {
                "required_skill": "docker",
                "match_type": "missing",
                "support_skill": None,
                "credit": 0.0,
            },
        ]
    )

    result = build_graph_skill_breakdown(driver=driver, job_id=21, candidate_id=33)

    assert result["graph_available"] is True
    assert result["required_skill_count"] == 3
    assert result["credited_score"] == 1.5
    assert result["overlap_score"] == 0.5
    assert result["exact_matches"] == ["spring_boot"]
    assert result["prerequisite_matches"] == [
        {"required_skill": "postgresql", "support_skill": "sql", "credit": 0.5}
    ]
    assert result["missing_skills"] == ["docker"]


def test_build_graph_skill_breakdown_returns_zeroed_payload_for_empty_result():
    driver = FakeDriver([])

    result = build_graph_skill_breakdown(driver=driver, job_id=21, candidate_id=33)

    assert result["graph_available"] is True
    assert result["required_skill_count"] == 0
    assert result["credited_score"] == 0.0
    assert result["overlap_score"] == 0.0
    assert result["exact_matches"] == []
    assert result["prerequisite_matches"] == []
    assert result["missing_skills"] == []
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `./.venv/bin/python -m pytest backend/tests/services/test_graph_match_service.py -v`

Expected: FAIL with `ModuleNotFoundError` or missing `build_graph_skill_breakdown`.

- [ ] **Step 3: Write minimal implementation**

```python
from __future__ import annotations

from neo4j import Driver


def build_graph_skill_breakdown(*, driver: Driver, job_id: int, candidate_id: int) -> dict:
    with driver.session() as session:
        rows = session.run("RETURN 1 AS placeholder", job_id=job_id, candidate_id=candidate_id).data()

    exact_matches: list[str] = []
    prerequisite_matches: list[dict] = []
    missing_skills: list[str] = []

    for row in rows:
        match_type = row["match_type"]
        if match_type == "exact":
            exact_matches.append(row["required_skill"])
        elif match_type == "prerequisite":
            prerequisite_matches.append(
                {
                    "required_skill": row["required_skill"],
                    "support_skill": row["support_skill"],
                    "credit": row["credit"],
                }
            )
        else:
            missing_skills.append(row["required_skill"])

    credited_score = round(sum(float(row["credit"]) for row in rows), 4)
    required_skill_count = len(rows)
    overlap_score = round(credited_score / required_skill_count, 4) if required_skill_count else 0.0

    return {
        "graph_available": True,
        "required_skill_count": required_skill_count,
        "credited_score": credited_score,
        "overlap_score": overlap_score,
        "exact_matches": sorted(exact_matches),
        "prerequisite_matches": prerequisite_matches,
        "missing_skills": sorted(missing_skills),
    }
```

- [ ] **Step 4: Replace placeholder query with the real Cypher**

```python
GRAPH_MATCH_QUERY = """
MATCH (j:Job {job_id: $job_id})-[r:REQUIRES]->(req:Skill)
WHERE r.category IN ['technical_skills', 'platforms_cloud', 'tooling_devops']
OPTIONAL MATCH (c:Candidate {candidate_id: $candidate_id})-[:HAS_SKILL]->(req)
OPTIONAL MATCH (c2:Candidate {candidate_id: $candidate_id})-[:HAS_SKILL]->(support:Skill)-[:PREREQUISITE_OF]->(req)
WITH req,
     CASE WHEN c IS NOT NULL THEN true ELSE false END AS has_exact,
     collect(DISTINCT support.canonical) AS prerequisite_support
RETURN
  req.canonical AS required_skill,
  CASE
    WHEN has_exact THEN 'exact'
    WHEN size(prerequisite_support) > 0 THEN 'prerequisite'
    ELSE 'missing'
  END AS match_type,
  CASE
    WHEN has_exact OR size(prerequisite_support) = 0 THEN NULL
    ELSE prerequisite_support[0]
  END AS support_skill,
  CASE
    WHEN has_exact THEN 1.0
    WHEN size(prerequisite_support) > 0 THEN 0.5
    ELSE 0.0
  END AS credit
ORDER BY required_skill
"""


def build_graph_skill_breakdown(*, driver: Driver, job_id: int, candidate_id: int) -> dict:
    with driver.session() as session:
        rows = session.run(
            GRAPH_MATCH_QUERY,
            job_id=job_id,
            candidate_id=candidate_id,
        ).data()
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `./.venv/bin/python -m pytest backend/tests/services/test_graph_match_service.py -v`

Expected: PASS with `2 passed`.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/graph_match_service.py backend/tests/services/test_graph_match_service.py
git commit -m "feat: add neo4j graph match service"
```

---

### Task 2: Integrate Graph Score Into Candidate Screening

**Files:**
- Modify: `backend/app/services/candidate_screening_service.py`
- Reference: `backend/app/services/graph_match_service.py`
- Test: `backend/tests/services/test_candidate_screening_service.py`

- [ ] **Step 1: Write the failing screening tests**

```python
from app.services.candidate_screening_service import _score_candidate


def test_score_candidate_uses_graph_partial_credit_when_exact_skill_is_missing(candidate_factory, job_payload):
    candidate = candidate_factory(
        structured_cv_json={
            "technical_skills": [
                {"canonical": "java", "evidence": [{"text": "Built backend services"}]},
                {"canonical": "docker", "evidence": [{"text": "Dockerized apps"}]},
            ],
            "platforms_cloud": [],
            "tooling_devops": [],
            "experience": [{"title": "Backend Developer"}],
        },
        verified_links_json=[{"final_url": "https://github.com/example/repo"}],
        full_name="Graph Candidate",
    )
    job_payload["required_skills"] = [
        {"canonical": "spring_boot", "requirement_type": "must_have"},
        {"canonical": "docker", "requirement_type": "must_have"},
    ]
    job_payload["technical_skills"] = [
        {"canonical": "spring_boot"},
        {"canonical": "docker"},
    ]

    result = _score_candidate(
        job_payload,
        candidate,
        graph_breakdown={
            "graph_available": True,
            "required_skill_count": 2,
            "credited_score": 1.5,
            "overlap_score": 0.75,
            "exact_matches": ["docker"],
            "prerequisite_matches": [
                {"required_skill": "spring_boot", "support_skill": "java", "credit": 0.5}
            ],
            "missing_skills": [],
        },
    )

    assert result["final_report_json"]["graph_scoring"]["overlap_score"] == 0.75
    assert result["final_report_json"]["graph_scoring"]["used_fallback"] is False
    assert result["match_score"] > 70.0


def test_score_candidate_does_not_double_count_exact_and_prerequisite_support(candidate_factory, job_payload):
    candidate = candidate_factory(
        structured_cv_json={
            "technical_skills": [
                {"canonical": "spring_boot", "evidence": [{"text": "Spring Boot APIs"}]},
                {"canonical": "java", "evidence": [{"text": "Java backend"}]},
            ],
            "platforms_cloud": [],
            "tooling_devops": [],
        },
        verified_links_json=[{"final_url": "https://github.com/example/repo"}],
        full_name="No Double Count Candidate",
    )
    job_payload["required_skills"] = [{"canonical": "spring_boot", "requirement_type": "must_have"}]
    job_payload["technical_skills"] = [{"canonical": "spring_boot"}]

    result = _score_candidate(
        job_payload,
        candidate,
        graph_breakdown={
            "graph_available": True,
            "required_skill_count": 1,
            "credited_score": 1.0,
            "overlap_score": 1.0,
            "exact_matches": ["spring_boot"],
            "prerequisite_matches": [],
            "missing_skills": [],
        },
    )

    assert result["final_report_json"]["graph_scoring"]["exact_matches"] == ["spring_boot"]
    assert result["final_report_json"]["graph_scoring"]["prerequisite_matches"] == []
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `./.venv/bin/python -m pytest backend/tests/services/test_candidate_screening_service.py -k "graph_partial_credit or double_count" -v`

Expected: FAIL because `_score_candidate(...)` does not accept `graph_breakdown`.

- [ ] **Step 3: Refactor `_score_candidate(...)` to accept graph input**

```python
def _score_candidate(
    job_payload: dict,
    candidate: Candidate,
    *,
    graph_breakdown: dict | None = None,
) -> dict:
    candidate_payload = candidate.structured_cv_json or {}
    required_skills = _collect_skill_names(job_payload, ("required_skills",))
    must_have_skills = {
        skill["canonical"]
        for skill in job_payload.get("required_skills", [])
        if isinstance(skill, dict) and skill.get("canonical") and skill.get("requirement_type") == "must_have"
    }
    if not must_have_skills:
        must_have_skills = _collect_skill_names(job_payload, ("technical_skills",))

    job_skills = _collect_skill_names(
        job_payload,
        ("technical_skills", "platforms_cloud", "tooling_devops"),
    )
    candidate_skills = _collect_skill_names(
        candidate_payload,
        ("technical_skills", "platforms_cloud", "tooling_devops"),
    )
    matched_must_have = must_have_skills & candidate_skills

    must_have_score = len(matched_must_have) / len(must_have_skills) if must_have_skills else 1.0
    overlap_score = (
        graph_breakdown["overlap_score"]
        if graph_breakdown and graph_breakdown.get("graph_available")
        else (len(job_skills & candidate_skills) / len(job_skills) if job_skills else 0.0)
    )
```

- [ ] **Step 4: Persist graph breakdown into the final report**

```python
    graph_scoring = {
        "enabled": bool(graph_breakdown),
        "used_fallback": not bool(graph_breakdown and graph_breakdown.get("graph_available")),
        "exact_matches": graph_breakdown.get("exact_matches", []) if graph_breakdown else [],
        "prerequisite_matches": graph_breakdown.get("prerequisite_matches", []) if graph_breakdown else [],
        "missing_skills": graph_breakdown.get("missing_skills", sorted(job_skills - candidate_skills)) if graph_breakdown else sorted(job_skills - candidate_skills),
        "overlap_score": overlap_score,
    }

    return {
        "match_score": overall_score,
        "match_summary": (
            f"Matched {len(graph_scoring['exact_matches'])} exact skill(s) and "
            f"{len(graph_scoring['prerequisite_matches'])} prerequisite-supported skill(s)."
        ),
        "final_report_json": {
            "strengths": sorted(job_skills & candidate_skills),
            "gaps": graph_scoring["missing_skills"],
            "verified_links": verified_links,
            "graph_scoring": graph_scoring,
            "explanation": (
                f"{candidate.full_name} passed verification and received graph-aware partial credit where direct skill matches were missing."
            ),
            "critic_review": "Deterministic workflow output reviewed for evidence consistency.",
        },
    }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `./.venv/bin/python -m pytest backend/tests/services/test_candidate_screening_service.py -k "graph_partial_credit or double_count" -v`

Expected: PASS with the new graph-aware assertions succeeding.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/candidate_screening_service.py backend/tests/services/test_candidate_screening_service.py
git commit -m "feat: add graph-aware partial credit scoring"
```

---

### Task 3: Wire Neo4j Service Into Screening With Fallback

**Files:**
- Modify: `backend/app/services/candidate_screening_service.py`
- Reference: `backend/app/db/neo4j.py`
- Test: `backend/tests/services/test_candidate_screening_service.py`

- [ ] **Step 1: Write the failing fallback tests**

```python
from unittest.mock import patch


def test_screen_and_rank_job_candidates_uses_graph_breakdown_when_available(db_session, seeded_job, seeded_candidate):
    with patch(
        "app.services.candidate_screening_service.build_graph_skill_breakdown",
        return_value={
            "graph_available": True,
            "required_skill_count": 1,
            "credited_score": 0.5,
            "overlap_score": 0.5,
            "exact_matches": [],
            "prerequisite_matches": [{"required_skill": "spring_boot", "support_skill": "java", "credit": 0.5}],
            "missing_skills": [],
        },
    ):
        result = screen_and_rank_job_candidates(db_session, job_id=seeded_job.id)

    assert result["ranked_candidates"][0].final_report_json["graph_scoring"]["used_fallback"] is False


def test_screen_and_rank_job_candidates_falls_back_when_graph_query_fails(db_session, seeded_job, seeded_candidate):
    with patch(
        "app.services.candidate_screening_service.build_graph_skill_breakdown",
        side_effect=RuntimeError("neo4j unavailable"),
    ):
        result = screen_and_rank_job_candidates(db_session, job_id=seeded_job.id)

    assert result["ranked_candidates"][0].final_report_json["graph_scoring"]["used_fallback"] is True
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `./.venv/bin/python -m pytest backend/tests/services/test_candidate_screening_service.py -k "graph_breakdown_when_available or graph_query_fails" -v`

Expected: FAIL because `screen_and_rank_job_candidates(...)` does not call the graph service.

- [ ] **Step 3: Add graph service call and fallback wrapper**

```python
from app.db.neo4j import get_neo4j_driver
from app.services.graph_match_service import build_graph_skill_breakdown


def _load_graph_breakdown(*, job_id: int, candidate_id: int) -> dict | None:
    driver = None
    try:
        driver = get_neo4j_driver()
        return build_graph_skill_breakdown(
            driver=driver,
            job_id=job_id,
            candidate_id=candidate_id,
        )
    except Exception:
        return None
    finally:
        if driver is not None:
            driver.close()
```

- [ ] **Step 4: Pass graph breakdown into `_score_candidate(...)`**

```python
        graph_breakdown = _load_graph_breakdown(
            job_id=job.id,
            candidate_id=candidate.id,
        )
        match_payload = _score_candidate(
            job.structured_jd_json or {},
            candidate,
            graph_breakdown=graph_breakdown,
        )
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `./.venv/bin/python -m pytest backend/tests/services/test_candidate_screening_service.py -k "graph_breakdown_when_available or graph_query_fails" -v`

Expected: PASS with one graph-enabled case and one fallback case.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/candidate_screening_service.py backend/tests/services/test_candidate_screening_service.py
git commit -m "feat: add neo4j scoring fallback path"
```

---

### Task 4: Add End-to-End Regression Coverage

**Files:**
- Modify: `backend/tests/services/test_candidate_screening_service.py`
- Test: `backend/tests/api/test_job_ranking_api.py`

- [ ] **Step 1: Write the failing regression tests**

```python
def test_score_candidate_graph_breakdown_marks_missing_skills_without_graph_groups(candidate_factory, job_payload):
    candidate = candidate_factory(
        structured_cv_json={
            "technical_skills": [],
            "platforms_cloud": [],
            "tooling_devops": [],
        },
        verified_links_json=[{"final_url": "https://github.com/example/repo"}],
        full_name="No Graph Skills",
    )
    job_payload["required_skills"] = [{"canonical": "communication", "requirement_type": "must_have"}]
    job_payload["technical_skills"] = []

    result = _score_candidate(job_payload, candidate, graph_breakdown=None)

    assert result["final_report_json"]["graph_scoring"]["used_fallback"] is True
    assert result["final_report_json"]["graph_scoring"]["exact_matches"] == []
    assert result["final_report_json"]["graph_scoring"]["prerequisite_matches"] == []


def test_job_ranking_api_exposes_graph_scoring_payload(client, seeded_job_with_ranked_candidate):
    response = client.get(f"/api/jobs/{seeded_job_with_ranked_candidate.id}/ranking")
    payload = response.json()

    assert response.status_code == 200
    assert "graph_scoring" in payload["ranked_candidates"][0]["final_report_json"]
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `./.venv/bin/python -m pytest backend/tests/services/test_candidate_screening_service.py backend/tests/api/test_job_ranking_api.py -k "graph_scoring" -v`

Expected: FAIL because the persisted payload does not yet guarantee the expected structure in all paths.

- [ ] **Step 3: Tighten implementation where needed**

```python
graph_scoring = {
    "enabled": graph_breakdown is not None,
    "used_fallback": not bool(graph_breakdown and graph_breakdown.get("graph_available")),
    "exact_matches": list(graph_breakdown.get("exact_matches", [])) if graph_breakdown else [],
    "prerequisite_matches": list(graph_breakdown.get("prerequisite_matches", [])) if graph_breakdown else [],
    "missing_skills": list(graph_breakdown.get("missing_skills", [])) if graph_breakdown else sorted(job_skills - candidate_skills),
    "overlap_score": overlap_score,
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `./.venv/bin/python -m pytest backend/tests/services/test_candidate_screening_service.py backend/tests/api/test_job_ranking_api.py -k "graph_scoring" -v`

Expected: PASS for the new regression cases.

- [ ] **Step 5: Commit**

```bash
git add backend/tests/services/test_candidate_screening_service.py backend/tests/api/test_job_ranking_api.py backend/app/services/candidate_screening_service.py
git commit -m "test: cover neo4j graph scoring output"
```

---

### Task 5: Run Full Verification

**Files:**
- No code changes expected

- [ ] **Step 1: Run focused backend suite**

Run: `./.venv/bin/python -m pytest backend/tests/services/test_graph_match_service.py backend/tests/services/test_candidate_screening_service.py backend/tests/api/test_job_ranking_api.py -v`

Expected: PASS for all graph scoring tests.

- [ ] **Step 2: Run adjacent regression suite**

Run: `./.venv/bin/python -m pytest backend/tests/services/test_candidate_import_service.py backend/tests/services/test_job_import_service.py backend/tests/services/test_pdf_text_extractor.py backend/tests/api/test_candidate_import_api.py backend/tests/api/test_job_import_api.py -v`

Expected: PASS to confirm graph scoring did not regress import flows.

- [ ] **Step 3: Smoke check ranking API**

Run: `curl -s http://localhost:8000/api/jobs/21/ranking | jq '.ranked_candidates[0].final_report_json.graph_scoring'`

Expected: JSON object with `enabled`, `used_fallback`, `exact_matches`, `prerequisite_matches`, `missing_skills`, and `overlap_score`.

- [ ] **Step 4: Commit final verification-only state if code changed during fixes**

```bash
git add backend/app/services/graph_match_service.py backend/app/services/candidate_screening_service.py backend/tests/services/test_graph_match_service.py backend/tests/services/test_candidate_screening_service.py backend/tests/api/test_job_ranking_api.py
git commit -m "chore: finalize neo4j graph scoring v1"
```

If no files changed during verification, skip this commit.

---

## Self-Review

### Spec coverage

- Graph service: covered by Task 1
- `_score_candidate(...)` integration: covered by Task 2
- Neo4j fallback path: covered by Task 3
- Persisted graph breakdown and API visibility: covered by Task 4
- Verification suite: covered by Task 5

### Placeholder scan

- No `TODO`, `TBD`, or “similar to above” placeholders remain.
- Each task has explicit files, commands, and expected behavior.

### Type consistency

- Graph service function name is consistently `build_graph_skill_breakdown`
- Screening function uses `graph_breakdown`
- Persisted report field is consistently `final_report_json["graph_scoring"]`

