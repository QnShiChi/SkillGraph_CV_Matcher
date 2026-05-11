from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.candidate_routes import router as candidate_router
from app.api.job_routes import router as job_router
from app.api.routes import router as core_router
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(core_router)
app.include_router(job_router)
app.include_router(candidate_router)
