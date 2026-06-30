from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

try:
    from .common.config.env import load_backend_env
except ImportError:
    from common.config.env import load_backend_env

load_backend_env()

try:
    from .pii_route import router as pii_router
except ImportError:
    from pii_route import router as pii_router

app = FastAPI(
    title="Conseal - Trust & Explainability",
    description="Privacy-first document anonymization with explainable PII redaction",
    version="1.0.0",
)

# CORS middleware for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pii_router, prefix="/pii", tags=["PII Anonymization"])
