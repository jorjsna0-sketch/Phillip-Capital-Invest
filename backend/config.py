"""
Configuration settings for Phillip Capital Invest
"""
import os

# App settings
APP_NAME = "Phillip Capital Invest"
DEBUG = os.environ.get("DEBUG", "false").lower() == "true"

# Database
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "altyncontract")

# Security
SECRET_KEY = os.environ.get("SECRET_KEY", "altyncontract-secret-key-change-in-production")
SESSION_EXPIRE_HOURS = 24 * 7  # 7 days

# File uploads
UPLOAD_DIR = "/app/backend/uploads"
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
