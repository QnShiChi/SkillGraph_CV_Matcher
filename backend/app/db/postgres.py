from psycopg import connect

from app.core.config import get_settings


def check_postgres_connection() -> dict:
    settings = get_settings()

    try:
        with connect(settings.postgres_dsn, connect_timeout=3) as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1;")
                cursor.fetchone()

        return {"status": "ok", "message": "Connected to PostgreSQL"}
    except Exception as exc:
        return {"status": "error", "message": str(exc)}
