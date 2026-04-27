"""
Configuration settings for Phillip Capital Invest
"""
import os
from pathlib import Path

# App settings
APP_NAME = "Phillip Capital Invest"
DEBUG = os.environ.get("DEBUG", "false").lower() == "true"

# Database
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "altyncontract")

# Security
SECRET_KEY = os.environ.get("SECRET_KEY", "altyncontract-secret-key-change-in-production")
SESSION_EXPIRE_HOURS = 24 * 7  # 7 days


# File uploads — pick a writable directory at import time so production filesystems
# (which can be read-only outside /tmp) degrade gracefully instead of crashing.
def _resolve_upload_dir() -> str:
    backend_root = Path(__file__).resolve().parent
    candidates = [
        os.environ.get("UPLOADS_DIR"),
        str(backend_root / "uploads"),
        "/tmp/uploads",
    ]
    for candidate in candidates:
        if not candidate:
            continue
        path = Path(candidate)
        try:
            path.mkdir(parents=True, exist_ok=True)
            test = path / ".write_test"
            test.touch()
            test.unlink(missing_ok=True)
            return str(path)
        except (OSError, PermissionError):
            continue
    fallback = Path("/tmp/uploads")
    fallback.mkdir(parents=True, exist_ok=True)
    return str(fallback)


UPLOAD_DIR = _resolve_upload_dir()
MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10MB

# Scheduler
PROFIT_ACCRUAL_INTERVAL_HOURS = 24
PROFIT_ACCRUAL_HOUR = 0  # Midnight
PROFIT_ACCRUAL_MINUTE = 5

# Tier thresholds (USD)
TIER_THRESHOLDS = {
    "silver": 0,
    "gold": 50000,
    "platinum": 100000
}

# Currency rates cache TTL (seconds)
CURRENCY_RATES_TTL = 3600  # 1 hour
