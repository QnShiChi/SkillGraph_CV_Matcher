from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]


def test_makefile_uses_plain_sql_dump_and_restore() -> None:
    makefile = (REPO_ROOT / "Makefile").read_text()

    assert ".sql" in makefile
    assert ".dump" not in makefile
    assert "pg_dump" in makefile
    assert "-Fc" not in makefile
    assert "psql" in makefile
    assert "pg_restore" not in makefile


def test_readme_documents_sql_backup_and_restore() -> None:
    readme = (REPO_ROOT / "README.md").read_text()

    assert ".sql" in readme
    assert ".dump" not in readme
    assert "psql" in readme
