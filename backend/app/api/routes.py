from fastapi import APIRouter

from app.core.config import get_settings
from app.db.neo4j import check_neo4j_connection
from app.db.postgres import check_postgres_connection

router = APIRouter()


@router.get("/health")
def health() -> dict:
    return {"status": "ok"}


@router.get("/api/health")
def app_health() -> dict:
    settings = get_settings()
    return {"status": "ok", "app_name": settings.app_name}


@router.get("/api/connections")
def connections() -> dict:
    postgres = check_postgres_connection()
    neo4j = check_neo4j_connection()

    return {
        "status": "ok"
        if postgres["status"] == "ok" and neo4j["status"] == "ok"
        else "degraded",
        "services": {
            "postgres": postgres,
            "neo4j": neo4j,
        },
    }
