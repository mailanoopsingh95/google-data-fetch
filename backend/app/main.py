import os
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.core.logging import MetricsMiddleware, get_prometheus_metrics
from app.db.models import Base
from app.db.session import sync_engine
from app.api.v1 import auth, search, dashboard

# Ensure database tables exist on start
try:
    Base.metadata.create_all(bind=sync_engine)
    print("[db] Database schemas verified and successfully created.")
except Exception as db_err:
    print(f"[db] Warning: Database table creation failed: {db_err}. Ensure Postgres is running.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Production SaaS Platform for Google Places and Business lead enrichment",
    version="1.0.0",
    docs_url="/docs",
    openapi_url="/openapi.json"
)

# CORS Policy
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify ["http://localhost:3000"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Metrics Middleware
app.add_middleware(MetricsMiddleware)

# Mount exports directory to serve static file downloads
static_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "static"))
os.makedirs(os.path.join(static_dir, "exports"), exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Register v1 Endpoints
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["Authentication"])
app.include_router(search.router, prefix=settings.API_V1_STR, tags=["Search"])
app.include_router(dashboard.router, prefix=f"{settings.API_V1_STR}/dashboard", tags=["Dashboard"])

@app.get("/metrics")
def get_metrics():
    """Prometheus metrics endpoint."""
    metrics_data, content_type = get_prometheus_metrics()
    return Response(content=metrics_data, media_type=content_type)

@app.get("/healthz")
def healthz():
    """Health check endpoint."""
    return {"status": "healthy", "service": settings.PROJECT_NAME}
