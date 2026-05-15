from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.candidate_routes import router as candidate_router
from app.api.job_routes import router as job_router
from app.api.runtime_settings import hydrate_runtime_settings
from app.api.routes import router as core_router
from app.api.settings_routes import router as settings_router
from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models.app_setting import AppSetting  # noqa: F401

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        with SessionLocal() as session:
            hydrate_runtime_settings(session)
    except Exception:
        # The app can still start without a persisted key; requests will resolve settings later.
        pass
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(core_router)
app.include_router(job_router)
app.include_router(candidate_router)
app.include_router(settings_router)
