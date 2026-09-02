import os
import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, PlainTextResponse, JSONResponse
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST, Counter, Histogram

from backend.config import settings
from backend.db.session import init_db, async_session_factory
from backend.db.bootstrap import bootstrap_roles_and_permissions
from backend.routers import auth, agents, marketplace, tasks, financial, admin, websockets

# Prometheus Metrics
try:
    REQUEST_COUNT = Counter("agentchain_http_requests_total", "Total HTTP requests", ["method", "endpoint", "status"])
    REQUEST_LATENCY = Histogram("agentchain_http_request_duration_seconds", "HTTP request latency in seconds", ["endpoint"])
except Exception:
    from prometheus_client import REGISTRY
    REQUEST_COUNT = REGISTRY._names_to_collectors.get("agentchain_http_requests_total")
    REQUEST_LATENCY = REGISTRY._names_to_collectors.get("agentchain_http_request_duration_seconds")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB tables & seed system roles/permissions on startup
    await init_db()
    async with async_session_factory() as session:
        await bootstrap_roles_and_permissions(session)
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="AgentChain Enterprise Autonomous AI Workforce Platform API",
    lifespan=lifespan
)

# Structured Exception Handler
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    request_id = str(uuid.uuid4())
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.detail,
            "error": {
                "code": "AUTHENTICATION_ERROR" if exc.status_code in [401, 403] else "API_ERROR",
                "message": exc.detail,
                "request_id": request_id
            }
        },
        headers=exc.headers or {}
    )

# CORS Configuration
allow_origins = settings.CORS_ORIGINS
if settings.ENVIRONMENT == "production" and "*" in allow_origins:
    allow_origins = ["https://agentchain.ai"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Middleware for metrics and request logging
@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    endpoint = request.url.path
    with REQUEST_LATENCY.labels(endpoint=endpoint).time():
        response = await call_next(request)
    REQUEST_COUNT.labels(method=request.method, endpoint=endpoint, status=response.status_code).inc()
    return response

from backend.routers import auth, agents, marketplace, tasks, financial, admin, websockets, github
from backend.api.v1 import workspaces

# Mount Modular API Routers
app.include_router(auth.router)
app.include_router(agents.router)
app.include_router(marketplace.router)
app.include_router(tasks.router)
app.include_router(financial.router)
app.include_router(admin.router)
app.include_router(websockets.router)
app.include_router(workspaces.router)
app.include_router(github.router)

# Health & Metrics Endpoints
@app.get("/health", tags=["System"])
def health_check():
    return {
        "status": "healthy",
        "service": "AgentChain Enterprise Gateway",
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT
    }

@app.get("/metrics", tags=["System"], include_in_schema=False)
def metrics():
    return PlainTextResponse(generate_latest(), media_type=CONTENT_TYPE_LATEST)

# Static Frontend Mounting
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

if os.path.exists(os.path.join(BASE_DIR, "diagrams")):
    app.mount("/diagrams", StaticFiles(directory=os.path.join(BASE_DIR, "diagrams")), name="diagrams")

@app.get("/", include_in_schema=False)
def serve_index():
    return FileResponse(os.path.join(BASE_DIR, "index.html"))

@app.get("/style.css", include_in_schema=False)
def serve_css():
    return FileResponse(os.path.join(BASE_DIR, "style.css"), media_type="text/css")

@app.get("/app.js", include_in_schema=False)
def serve_js():
    return FileResponse(os.path.join(BASE_DIR, "app.js"), media_type="application/javascript")

@app.get("/agentchain_architecture.svg", include_in_schema=False)
def serve_svg():
    return FileResponse(os.path.join(BASE_DIR, "agentchain_architecture.svg"), media_type="image/svg+xml")
