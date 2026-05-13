from app.services.cv_parser import parse_cv_text, parse_cv_text_hybrid


class _StubOpenRouterClient:
    def __init__(self, responses: list[str]) -> None:
        self._responses = responses
        self._index = 0

    def create_chat_completion(self, *, system_prompt: str, user_prompt: str) -> str:
        del system_prompt, user_prompt
        response = self._responses[self._index]
        self._index += 1
        return response


def test_parse_cv_text_returns_grouped_candidate_structure_with_evidence() -> None:
    cv_text = """
    Nguyen Van A
    Senior Backend Engineer

    Summary
    Backend engineer with 5 years building Python and FastAPI services for internal platforms.

    Experience
    - Built Python APIs with FastAPI and PostgreSQL for candidate matching systems.
    - Deployed Docker-based services to AWS with CI/CD pipelines.

    Skills
    Python, FastAPI, PostgreSQL, Docker, AWS, CI/CD, Git
    """

    result = parse_cv_text(cv_text)
    structured = result["structured_cv_json"]

    technical = {item["canonical"]: item for item in structured["technical_skills"]}
    platforms = {item["canonical"]: item for item in structured["platforms_cloud"]}
    tooling = {item["canonical"]: item for item in structured["tooling_devops"]}

    assert result["full_name"] == "Nguyen Van A"
    assert "Backend engineer" in result["summary"]
    assert "python" in technical
    assert "fastapi" in technical
    assert "postgresql" in technical
    assert "aws" in platforms
    assert "docker" in tooling
    assert "ci_cd" in tooling
    assert technical["python"]["evidence"]
    assert technical["python"]["evidence"][0]["section_origin"] in {"experience", "skills", "summary"}


def test_parse_cv_text_excludes_soft_skills_from_graph_safe_groups() -> None:
    cv_text = """
    Tran Thi B

    Summary
    Collaborative engineer with strong communication and problem-solving skills.

    Experience
    - Worked across cross-functional teams and delivered Python tooling.
    """

    result = parse_cv_text(cv_text)
    structured = result["structured_cv_json"]

    technical = {item["canonical"] for item in structured["technical_skills"]}
    soft_skills = structured["soft_skills"]

    assert "python" in technical
    assert any("communication" in item.lower() for item in soft_skills)
    assert any("problem" in item.lower() for item in soft_skills)


def test_parse_cv_text_hybrid_merges_llm_groups_and_evidence() -> None:
    cv_text = """
    Nguyen Van A

    Summary
    Backend engineer building Python APIs and internal tooling.

    Experience
    - Built FastAPI services on PostgreSQL and AWS.
    - Automated delivery with Docker and CI/CD.
    """
    client = _StubOpenRouterClient(
        responses=[
            """
            {
              "full_name": "Nguyen Van A",
              "summary": "Backend engineer focused on Python APIs, cloud delivery, and internal tooling.",
              "technical_skills": [
                {
                  "name": "Python",
                  "section_origin": "experience",
                  "confidence": 0.96,
                  "aliases": ["python3"],
                  "evidence": ["Built Python APIs and internal tooling."]
                },
                {
                  "name": "FastAPI",
                  "section_origin": "experience",
                  "confidence": 0.94,
                  "evidence": [{"text": "Built FastAPI services on PostgreSQL and AWS.", "section_origin": "experience", "confidence": 0.94}]
                }
              ],
              "platforms_cloud": [
                {
                  "name": "AWS",
                  "section_origin": "experience",
                  "confidence": 0.91,
                  "evidence": ["Built FastAPI services on PostgreSQL and AWS."]
                }
              ],
              "tooling_devops": [
                {
                  "name": "Docker",
                  "section_origin": "experience",
                  "confidence": 0.9,
                  "evidence": ["Automated delivery with Docker and CI/CD."]
                }
              ],
              "competencies": [
                {
                  "name": "Internal tooling",
                  "section_origin": "summary",
                  "confidence": 0.83,
                  "evidence": ["Backend engineer focused on Python APIs, cloud delivery, and internal tooling."]
                }
              ],
              "soft_skills": ["Communication"],
              "experience": ["Built FastAPI services on PostgreSQL and AWS."],
              "education": [],
              "language_requirements": [],
              "parser_confidence": 0.93
            }
            """
        ]
    )

    result = parse_cv_text_hybrid(cv_text, client=client)
    structured = result["structured_cv_json"]
    technical = {item["canonical"]: item for item in structured["technical_skills"]}
    tooling = {item["canonical"]: item for item in structured["tooling_devops"]}

    assert result["parse_source"] == "llm_hybrid"
    assert result["parse_confidence"] >= 0.9
    assert "python" in technical
    assert technical["python"]["source"] == "llm_structured"
    assert technical["python"]["evidence"][0]["text"]
    assert "fastapi" in technical
    assert "docker" in tooling
    assert structured["soft_skills"] == ["Communication"]
