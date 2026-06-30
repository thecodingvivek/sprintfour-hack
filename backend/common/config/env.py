import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[2]
ENV_PATH = BACKEND_DIR / "test_agent" / ".env"
LOCAL_CREDENTIALS_PATH = BACKEND_DIR / "fourhack-5f384-136980915a0a.json"


def load_backend_env() -> None:
    """Load backend env vars and repair stale local credential paths."""
    load_dotenv(ENV_PATH)

    credentials_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    credentials_missing = not credentials_path or not Path(credentials_path).exists()

    if credentials_missing and LOCAL_CREDENTIALS_PATH.exists():
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(LOCAL_CREDENTIALS_PATH)
