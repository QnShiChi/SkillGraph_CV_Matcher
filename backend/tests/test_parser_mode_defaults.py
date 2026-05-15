from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]


def _read_env_value(path: Path, key: str) -> str | None:
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        current_key, value = stripped.split("=", 1)
        if current_key == key:
            return value
    return None


def test_env_example_enables_hybrid_parser_for_jd_and_cv() -> None:
    env_example = PROJECT_ROOT / ".env.example"

    assert _read_env_value(env_example, "JD_PARSER_MODE") == "hybrid"
    assert _read_env_value(env_example, "CV_PARSER_MODE") == "hybrid"


def test_local_env_enables_hybrid_parser_for_jd_and_cv() -> None:
    env_file = PROJECT_ROOT / ".env"

    assert _read_env_value(env_file, "JD_PARSER_MODE") == "hybrid"
    assert _read_env_value(env_file, "CV_PARSER_MODE") == "hybrid"
