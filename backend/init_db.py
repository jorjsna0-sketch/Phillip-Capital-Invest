"""
Database initialization script for Phillip Capital Invest

On a fresh deployment with an empty database we:
  1. Skip restore for managed Atlas (mongodb+srv://) — `mongorestore` is not
     available in production containers and is not appropriate for managed DBs.
  2. For local/self-hosted Mongo we attempt `mongorestore` from db_backup/ if
     the binary is available; we degrade gracefully on failure.
  3. Always seed a default admin if no admin exists, using the SAME password
     hashing function used by the auth router so login actually works.
"""
import asyncio
import os
import shutil
import subprocess
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load environment
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "phillipcapitalinvest")
BACKUP_DIR = ROOT_DIR / "db_backup"

DEFAULT_ADMIN_EMAIL = os.environ.get("DEFAULT_ADMIN_EMAIL", "admin@phillipcapital.app")
DEFAULT_ADMIN_PASSWORD = os.environ.get("DEFAULT_ADMIN_PASSWORD", "abc123")


def _is_managed_atlas(uri: str) -> bool:
    """Detect Atlas / managed MongoDB to avoid pointless mongorestore attempts."""
    return uri.startswith("mongodb+srv://") or "mongodb.net" in uri


async def _ensure_default_admin(db) -> None:
    """Seed a default admin if none exists, using helpers.hash_password()
    so the auth router's verify_password() can actually validate the login."""
    import secrets
    from datetime import datetime, timezone

    admin_exists = await db.users.find_one({"role": "admin"})
    if admin_exists:
        return

    # Use the SAME hashing function used by /api/auth/login. Otherwise the seed
    # admin can never log in (history shows this was bcrypt vs SHA256 mismatch).
    try:
        from utils.helpers import hash_password
    except Exception:
        # Fallback for direct script execution (no PYTHONPATH)
        import sys
        sys.path.insert(0, str(ROOT_DIR))
        from utils.helpers import hash_password  # type: ignore

    password_hash = hash_password(DEFAULT_ADMIN_PASSWORD)
    await db.users.insert_one({
        "user_id": "user_admin001",
        "email": DEFAULT_ADMIN_EMAIL,
        "password_hash": password_hash,
        "name": "Admin User",
        "role": "admin",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "available_balance": {"USD": 0},
        "portfolio_balance": {"USD": 0},
        "balances": {"USD": 0, "EUR": 0, "TRY": 0},
        "account_number": f"AC{secrets.token_hex(4).upper()}",
        "status": "active",
        "kyc_status": "approved",
    })
    print(f"Default admin created: {DEFAULT_ADMIN_EMAIL} (password is set; check secrets)")


async def _try_mongorestore(db) -> bool:
    """Attempt to restore from BACKUP_DIR using mongorestore. Returns True on
    success. Skips silently on managed Atlas or when binary is unavailable."""
    if _is_managed_atlas(MONGO_URL):
        print("Skip mongorestore: managed MongoDB (Atlas) detected.")
        return False

    if shutil.which("mongorestore") is None:
        print("Skip mongorestore: binary not available in this container.")
        return False

    if not BACKUP_DIR.exists():
        print(f"Skip mongorestore: backup directory not found at {BACKUP_DIR}")
        return False

    try:
        result = subprocess.run(
            [
                "mongorestore",
                f"--uri={MONGO_URL}",
                f"--db={DB_NAME}",
                str(BACKUP_DIR),
                "--drop",
            ],
            capture_output=True,
            text=True,
            timeout=120,
        )
        if result.returncode == 0:
            print("Database restored from db_backup successfully.")
            users_count = await db.users.count_documents({})
            portfolios_count = await db.portfolios.count_documents({})
            print(f"After restore: {users_count} users, {portfolios_count} portfolios")
            return True
        print(f"mongorestore failed (rc={result.returncode}): {result.stderr[:500]}")
        return False
    except Exception as e:
        print(f"mongorestore exception: {e}")
        return False


async def init_database():
    """Initialize database with backup data if empty, or seed a default admin."""
    masked = MONGO_URL[:30] + "..." if len(MONGO_URL) > 30 else MONGO_URL
    print(f"[init_db] Checking database: {DB_NAME} at {masked}")

    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    try:
        users_count = await db.users.count_documents({})
        portfolios_count = await db.portfolios.count_documents({})
    except Exception as e:
        print(f"[init_db] Cannot reach database, skipping init: {e}")
        client.close()
        return

    print(f"[init_db] Current data: {users_count} users, {portfolios_count} portfolios")

    if users_count == 0 and portfolios_count == 0:
        print("[init_db] Database is empty.")
        restored = await _try_mongorestore(db)
        if not restored:
            await _ensure_default_admin(db)
    else:
        # DB has data, but make sure we still have an admin we can log in as.
        await _ensure_default_admin(db)
        print("[init_db] Database already has data. Skipping bulk restore.")

    client.close()


if __name__ == "__main__":
    asyncio.run(init_database())
