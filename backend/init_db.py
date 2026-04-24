"""
Database initialization script for AltynContract
Restores backup data if database is empty
"""
import asyncio
import os
import subprocess
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load environment
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "altyncontract")
BACKUP_DIR = ROOT_DIR / "db_backup"


async def init_database():
    """Initialize database with backup data if empty"""
    print(f"Checking database: {DB_NAME} at {MONGO_URL[:50]}...")
    
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Check if database has data
    users_count = await db.users.count_documents({})
    portfolios_count = await db.portfolios.count_documents({})
    
    print(f"Current data: {users_count} users, {portfolios_count} portfolios")
    
    if users_count == 0 and portfolios_count == 0:
        print("Database is empty. Restoring from backup...")
        
        if BACKUP_DIR.exists():
            # Use mongorestore to import data
            try:
                result = subprocess.run([
                    "mongorestore",
                    f"--uri={MONGO_URL}",
                    f"--db={DB_NAME}",
                    str(BACKUP_DIR),
                    "--drop"
                ], capture_output=True, text=True)
                
                if result.returncode == 0:
                    print("Database restored successfully!")
                    # Verify
                    users_count = await db.users.count_documents({})
                    portfolios_count = await db.portfolios.count_documents({})
                    print(f"After restore: {users_count} users, {portfolios_count} portfolios")
                else:
                    print(f"Restore failed: {result.stderr}")
            except Exception as e:
                print(f"Error during restore: {e}")
        else:
            print(f"Backup directory not found: {BACKUP_DIR}")
            print("Creating default admin user...")
            
            # Create default admin if no backup
            import secrets
            from datetime import datetime, timezone
            
            admin_exists = await db.users.find_one({"role": "admin"})
            if not admin_exists:
                from passlib.context import CryptContext
                pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
                
                await db.users.insert_one({
                    "user_id": "user_admin001",
                    "email": "admin@altyncontract.kz",
                    "password_hash": pwd_context.hash("abc123"),
                    "name": "Admin User",
                    "role": "admin",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "balances": {"USD": 0, "EUR": 0, "KZT": 0},
                    "account_number": f"AC{secrets.token_hex(4).upper()}"
                })
                print("Default admin created: admin@altyncontract.kz / abc123")
    else:
        print("Database already has data. Skipping initialization.")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(init_database())
