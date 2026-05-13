from types import SimpleNamespace

from app.services.candidate_graph_sync import _build_candidate_graph_payload


def test_build_candidate_graph_payload_projects_only_graph_safe_groups() -> None:
    candidate = SimpleNamespace(
        id=7,
        job_id=3,
        full_name="Nguyen Van A",
        source_type="cv_pdf",
        parse_source="rule_based",
        parse_confidence=0.91,
        status="new",
        structured_cv_json={
            "technical_skills": [
                {
                    "name": "Python",
                    "canonical": "python",
                    "confidence": 0.95,
                    "section_origin": "experience",
                    "evidence": [{"text": "Built Python APIs.", "section_origin": "experience", "confidence": 0.92}],
                }
            ],
            "platforms_cloud": [
                {
                    "name": "AWS",
                    "canonical": "aws",
                    "confidence": 0.88,
                    "section_origin": "experience",
                    "evidence": [{"text": "Deployed to AWS.", "section_origin": "experience", "confidence": 0.9}],
                }
            ],
            "tooling_devops": [
                {
                    "name": "Docker",
                    "canonical": "docker",
                    "confidence": 0.9,
                    "section_origin": "skills",
                    "evidence": [{"text": "Docker", "section_origin": "skills", "confidence": 0.84}],
                }
            ],
            "competencies": [{"name": "Software Development", "canonical": "software_development"}],
            "soft_skills": ["Communication"],
        },
    )

    payload = _build_candidate_graph_payload(candidate)

    canonicals = {skill["canonical"] for skill in payload["skills"]}
    assert canonicals == {"python", "aws", "docker"}
    assert payload["skills"][0]["evidence_count"] >= 1
    assert payload["job_candidate_edge"] == {"job_id": 3, "candidate_id": 7}
