from neo4j import Driver, GraphDatabase

from app.core.config import get_settings


def get_neo4j_driver() -> Driver:
    settings = get_settings()
    return GraphDatabase.driver(
        settings.neo4j_uri,
        auth=(settings.neo4j_username, settings.neo4j_password),
    )


def check_neo4j_connection() -> dict:
    driver = None

    try:
        driver = get_neo4j_driver()
        driver.verify_connectivity()
        return {"status": "ok", "message": "Connected to Neo4j"}
    except Exception as exc:
        return {"status": "error", "message": str(exc)}
    finally:
        if driver is not None:
            driver.close()
