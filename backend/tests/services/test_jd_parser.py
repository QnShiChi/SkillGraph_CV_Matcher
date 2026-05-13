from app.services.jd_parser import parse_jd_text


def test_parse_jd_text_returns_graph_ready_structure() -> None:
    jd_text = """
    Senior Frontend Developer

    Overview
    Build modern recruiting dashboards for enterprise HR teams.

    Responsibilities
    - Build Next.js interfaces
    - Integrate REST APIs

    Required Skills
    - Next.js
    - TypeScript
    - PostgreSQL

    Nice to Have
    - Neo4j
    """

    result = parse_jd_text(jd_text)

    assert result["title"] == "Senior Frontend Developer"
    assert "dashboard" in result["description"].lower()
    assert "Next.js" in result["required_skills_text"]
    technical_skills = result["structured_jd_json"]["technical_skills"]
    assert technical_skills[0]["canonical"] == "nextjs"
    assert technical_skills[0]["importance"] == 5
    assert technical_skills[0]["requirement_type"] == "must_have"
    assert "react" in technical_skills[0]["prerequisites"]


def test_parse_jd_text_marks_preferred_skill_as_nice_to_have() -> None:
    jd_text = """
    Backend Engineer

    Requirements
    - Python
    - FastAPI

    Preferred Skills
    - Neo4j
    """

    result = parse_jd_text(jd_text)
    skills = {
        item["canonical"]: item
        for item in result["structured_jd_json"]["technical_skills"]
    }

    assert skills["python"]["requirement_type"] == "must_have"
    assert skills["neo4j"]["requirement_type"] == "nice_to_have"


def test_parse_jd_text_groups_mixed_jd_signals() -> None:
    jd_text = """
    Software Developer

    Responsibilities
    - Build services with Python and Node.js
    - Maintain Docker-based deployment workflows

    Requirements
    - Strong software development background
    - Experience with AWS and CI/CD pipelines
    - Work effectively in cross-functional remote teams
    """

    result = parse_jd_text(jd_text)
    structured = result["structured_jd_json"]

    technical = {item["canonical"]: item for item in structured["technical_skills"]}
    platforms = {item["canonical"]: item for item in structured["platforms_cloud"]}
    tooling = {item["canonical"]: item for item in structured["tooling_devops"]}
    competencies = {item["canonical"]: item for item in structured["competencies"]}
    role_descriptors = {
        item["canonical"]: item for item in structured["role_descriptors"]
    }

    assert "python" in technical
    assert "node_js" in technical
    assert "aws" in platforms
    assert "ci_cd" in tooling
    assert "software_development" in competencies
    assert "cross_functional_teamwork" in role_descriptors
    assert competencies["software_development"]["prerequisites"] == []


def test_parse_jd_text_excludes_role_descriptors_from_required_skills_text() -> None:
    jd_text = """
    Platform Engineer

    Summary
    Contract remote role for a distributed platform team.

    Responsibilities
    - Build Python services
    - Collaborate across cross-functional teams

    Requirements
    - Python
    - FastAPI
    - Strong software development background
    - Experience working in remote collaborative environments
    """

    result = parse_jd_text(jd_text)

    assert "Python" in result["required_skills_text"]
    assert "software development" in result["required_skills_text"].lower()
    assert "remote" not in result["required_skills_text"].lower()
    assert "cross-functional" not in result["required_skills_text"].lower()


def test_parse_jd_text_enriches_ai_ml_skills_with_taxonomy() -> None:
    jd_text = """
    Senior AI Engineer

    Summary
    Build AI solutions for computer vision and NLP workloads.

    Requirements
    - Machine Learning
    - Transformer
    - BERT
    - MLOps
    - MLflow
    - OCR
    """

    result = parse_jd_text(jd_text)
    structured = result["structured_jd_json"]

    technical = {item["canonical"]: item for item in structured["technical_skills"]}
    tooling = {item["canonical"]: item for item in structured["tooling_devops"]}

    assert "machine_learning" in technical
    assert "transformer" in technical
    assert "bert" in technical
    assert "optical_character_recognition" in technical
    assert "mlops" in tooling
    assert "mlflow" in tooling
    assert technical["machine_learning"]["prerequisites"]
    assert "deep_learning" in technical["transformer"]["prerequisites"]
    assert "transformer" in technical["bert"]["prerequisites"]
    assert tooling["mlops"]["related_skills"]
