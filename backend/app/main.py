from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.routers import auth, chat, devices, escalations, interventions, metrics, users


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: nothing to do here since Alembic handles migrations.
    yield
    # Shutdown: close DB engine.
    from app.database import engine
    await engine.dispose()


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="Backend API for the MindLift mental health application.",
    lifespan=lifespan,
    docs_url="/docs" if settings.environment != "production" else None,
    redoc_url="/redoc" if settings.environment != "production" else None,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(devices.router)
app.include_router(metrics.router)
app.include_router(interventions.router)
app.include_router(chat.router)
app.include_router(escalations.router)


@app.get("/health", tags=["health"])
async def health_check():
    return {"status": "ok", "version": "1.0.0"}
