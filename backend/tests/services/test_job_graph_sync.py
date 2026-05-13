from types import SimpleNamespace

from app.services.job_graph_sync import _build_graph_payload


def test_build_graph_payload_projects_only_graph_safe_groups() -> None:
    job = SimpleNamespace(
        id=42,
        title="Platform Engineer",
        source_type="jd_pdf",
        parse_source="llm_hybrid",
        parse_confidence=0.95,
        status="draft",
        structured_jd_json={
            "technical_skills": [
                {
                    "name": "Python",
                    "canonical": "python",
                    "importance": 5,
                    "requirement_type": "must_have",
                    "confidence": 0.95,
                    "section_origin": "qualifications",
                    "prerequisites": [],
                }
            ],
            "platforms_cloud": [
                {
                    "name": "AWS",
                    "canonical": "aws",
                    "importance": 3,
                    "requirement_type": "nice_to_have",
                    "confidence": 0.9,
                    "section_origin": "preferred_skills",
                    "prerequisites": [],
                }
            ],
            "tooling_devops": [
                {
                    "name": "FastAPI",
                    "canonical": "fastapi",
                    "importance": 5,
                    "requirement_type": "must_have",
                    "confidence": 0.96,
                    "section_origin": "qualifications",
                    "prerequisites": ["python", "rest_api"],
                }
            ],
            "competencies": [
                {
                    "name": "Software Development",
                    "canonical": "software_development",
                }
            ],
            "role_descriptors": [
                {
                    "name": "Remote Work",
                    "canonical": "remote_work",
                }
            ],
        },
    )

    payload = _build_graph_payload(job)

    canonicals = {skill["canonical"] for skill in payload["skills"]}
    assert canonicals == {"python", "aws", "fastapi"}
    assert "software_development" not in canonicals
    assert "remote_work" not in canonicals
    assert payload["prerequisite_edges"] == [
        {"from_canonical": "python", "to_canonical": "fastapi"},
        {"from_canonical": "rest_api", "to_canonical": "fastapi"},
    ]


def test_build_graph_payload_keeps_ai_prerequisite_edges() -> None:
    job = SimpleNamespace(
        id=99,
        title="Senior AI Engineer",
        source_type="jd_pdf",
        parse_source="llm_hybrid",
        parse_confidence=0.94,
        status="draft",
        structured_jd_json={
            "technical_skills": [
                {
                    "name": "Machine Learning",
                    "canonical": "machine_learning",
                    "importance": 5,
                    "requirement_type": "must_have",
                    "confidence": 0.95,
                    "section_origin": "qualifications",
                    "prerequisites": ["python"],
                },
                {
                    "name": "Transformer",
                    "canonical": "transformer",
                    "importance": 5,
                    "requirement_type": "must_have",
                    "confidence": 0.95,
                    "section_origin": "qualifications",
                    "prerequisites": ["deep_learning"],
                },
                {
                    "name": "BERT",
                    "canonical": "bert",
                    "importance": 5,
                    "requirement_type": "must_have",
                    "confidence": 0.95,
                    "section_origin": "qualifications",
                    "prerequisites": ["transformer"],
                },
            ],
            "platforms_cloud": [],
            "tooling_devops": [
                {
                    "name": "MLOps",
                    "canonical": "mlops",
                    "importance": 4,
                    "requirement_type": "must_have",
                    "confidence": 0.9,
                    "section_origin": "qualifications",
                    "prerequisites": ["machine_learning"],
                }
            ],
            "competencies": [],
            "role_descriptors": [],
        },
    )

    payload = _build_graph_payload(job)

    assert {skill["canonical"] for skill in payload["skills"]} == {
        "machine_learning",
        "transformer",
        "bert",
        "mlops",
    }
    assert payload["prerequisite_edges"] == [
        {"from_canonical": "python", "to_canonical": "machine_learning"},
        {"from_canonical": "deep_learning", "to_canonical": "transformer"},
        {"from_canonical": "transformer", "to_canonical": "bert"},
        {"from_canonical": "machine_learning", "to_canonical": "mlops"},
    ]
