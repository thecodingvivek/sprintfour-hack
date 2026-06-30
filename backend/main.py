import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pii_route import router as pii_router

# Load environment variables
dotenv_path = os.path.join(os.path.dirname(__file__), "test_agent", ".env")
load_dotenv(dotenv_path)

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