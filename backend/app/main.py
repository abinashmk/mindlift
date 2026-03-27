from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.config import settings
from app.core.limiter import limiter
from app.routers import auth, chat, devices, escalations, interventions, metrics, users
from app.routers import risk, account, support, home


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

# Attach the rate limiter to the app state and register middleware/handler.
app.state.limiter = limiter
app.add_exception_handler(
    RateLimitExceeded,
    lambda req, exc: JSONResponse(
        status_code=429,
        content={"error": {"code": "RATE_LIMITED", "message": str(exc)}},
    ),
)
app.add_middleware(SlowAPIMiddleware)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# End-user API routers (prefixed under /v1)
_V1_PREFIX = "/v1"
app.include_router(auth.router, prefix=_V1_PREFIX)
app.include_router(users.router, prefix=_V1_PREFIX)
app.include_router(devices.router, prefix=_V1_PREFIX)
app.include_router(metrics.router, prefix=_V1_PREFIX)
app.include_router(interventions.router, prefix=_V1_PREFIX)
app.include_router(chat.router, prefix=_V1_PREFIX)
app.include_router(escalations.router, prefix=_V1_PREFIX)
app.include_router(risk.router, prefix=_V1_PREFIX)
app.include_router(account.router, prefix=_V1_PREFIX)
app.include_router(home.router, prefix=_V1_PREFIX)

# Support dashboard API router
app.include_router(support.router, prefix=_V1_PREFIX)


@app.get("/health", tags=["health"])
async def health_check():
    return {"status": "ok", "version": "1.0.0"}
