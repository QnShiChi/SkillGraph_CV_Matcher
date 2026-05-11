from neo4j import GraphDatabase

from app.core.config import get_settings


def check_neo4j_connection() -> dict:
    settings = get_settings()
    driver = None

    try:
        driver = GraphDatabase.driver(
            settings.neo4j_uri,
            auth=(settings.neo4j_username, settings.neo4j_password),
        )
        driver.verify_connectivity()
        return {"status": "ok", "message": "Connected to Neo4j"}
    except Exception as exc:
        return {"status": "error", "message": str(exc)}
    finally:
        if driver is not None:
            driver.close()
