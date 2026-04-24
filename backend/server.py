"""
AltynContract API - Main Server Entry Point
Clean, modular FastAPI application with automatic profit accrual scheduler
"""
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
import uuid
from datetime import datetime, timezone

# APScheduler for automatic profit accrual
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI(title="AltynContract API", version="2.0.0")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# ================== CORS MIDDLEWARE ==================

# For production: set CORS_ORIGINS env variable with comma-separated origins
# For preview/dev: defaults to common development origins
cors_origins_env = os.environ.get("CORS_ORIGINS", "")
if cors_origins_env:
    cors_allow_origins = [origin.strip() for origin in cors_origins_env.split(",")]
else:
    # Default origins for development/preview
    cors_allow_origins = [
        "http://localhost:3000",
        "https://localhost:3000",
        "https://portfix.preview.emergentagent.com"
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ================== SCHEDULER FOR AUTOMATIC PROFIT ACCRUAL ==================

scheduler = AsyncIOScheduler()


async def calculate_profit_for_investment(investment: dict, portfolio: dict) -> float:
    """
    Calculate profit for a single accrual period.
    
    Logic:
    - Term rate is for the FULL TERM (not annual). E.g., 25% for 10 days means 25% total for 10 days.
    - If auto_reinvest is ON: use compound interest (profit calculated on current_balance)
    - If auto_reinvest is OFF: use simple interest (profit calculated on initial amount)
    
    Calculation:
    - Get term rate (e.g., 25% for 10 days)
    - Divide by number of accrual periods in the term to get per-period rate
    - Apply to balance (current_balance for compound, amount for simple)
    """
    returns_by_term = portfolio.get("returns_by_term", {})
    term_key = str(investment.get('duration_months', 12))
    
    # Get the term rate (this is the total rate for the entire term, NOT annual)
    if term_key in returns_by_term:
        term_rate = returns_by_term[term_key]
    else:
        term_rate = portfolio.get("expected_return", 10)
    
    accrual_interval = portfolio.get("profit_accrual_interval", "monthly")
    duration_unit = portfolio.get("duration_unit", "months")
    duration_value = investment.get("duration_months", 12)
    
    # Calculate total number of accrual periods in the investment term
    if duration_unit == "days":
        # Duration is in days
        if accrual_interval == "hourly":
            total_periods = duration_value * 24
        elif accrual_interval == "daily":
            total_periods = duration_value
        elif accrual_interval == "weekly":
            total_periods = max(1, duration_value // 7)
        elif accrual_interval == "monthly":
            total_periods = max(1, duration_value // 30)
        else:
            total_periods = max(1, duration_value // 365)
    elif duration_unit == "hours":
        # Duration is in hours
        if accrual_interval == "hourly":
            total_periods = duration_value
        elif accrual_interval == "daily":
            total_periods = max(1, duration_value // 24)
        else:
            total_periods = max(1, duration_value // 720)  # ~30 days
    elif duration_unit == "years":
        # Duration is in years
        if accrual_interval == "hourly":
            total_periods = duration_value * 8760
        elif accrual_interval == "daily":
            total_periods = duration_value * 365
        elif accrual_interval == "weekly":
            total_periods = duration_value * 52
        elif accrual_interval == "monthly":
            total_periods = duration_value * 12
        else:
            total_periods = duration_value
    else:
        # Default: duration is in months
        if accrual_interval == "hourly":
            total_periods = duration_value * 720  # ~30 days * 24 hours
        elif accrual_interval == "daily":
            total_periods = duration_value * 30
        elif accrual_interval == "weekly":
            total_periods = duration_value * 4
        elif accrual_interval == "monthly":
            total_periods = duration_value
        else:
            total_periods = max(1, duration_value // 12)
    
    # Ensure at least 1 period
    total_periods = max(1, total_periods)
    
    # Per-period rate = term_rate / total_periods
    period_rate = term_rate / total_periods
    
    # Select balance based on auto_reinvest (compound vs simple interest)
    if investment.get("auto_reinvest"):
        # Compound interest: use current_balance (includes previously reinvested profits)
        balance = investment.get("current_balance", investment.get("amount", 0))
    else:
        # Simple interest: always use initial amount
        balance = investment.get("amount", 0)
    
    # Calculate profit for this period
    profit = balance * (period_rate / 100)
    return profit


async def run_profit_accrual():
    """Automatic profit accrual job - runs every hour"""
    logger.info("Starting automatic profit accrual job...")
    
    try:
        active_investments = await db.investments.find({"status": "active"}).to_list(1000)
        
        processed = 0
        skipped = 0
        errors = 0
        completed_count = 0
        total_profit = 0.0
        
        now = datetime.now(timezone.utc)
        
        for investment in active_investments:
            try:
                portfolio = await db.portfolios.find_one(
                    {"portfolio_id": investment["portfolio_id"]}, 
                    {"_id": 0}
                )
                if not portfolio:
                    skipped += 1
                    continue
                
                # Get user
                user = await db.users.find_one({"user_id": investment["user_id"]}, {"_id": 0})
                if not user:
                    skipped += 1
                    continue
                
                currency = investment.get("currency", "USD")
                portfolio_name = portfolio.get("name", {}).get("ru", portfolio.get("portfolio_id", ""))
                
                # Check if contract has ended
                end_date_str = investment.get("end_date")
                if end_date_str:
                    try:
                        end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00'))
                        if now >= end_date:
                            # Contract ended - payout to available balance
                            final_balance = investment.get("current_balance", investment.get("amount", 0))
                            initial_amount = investment.get("amount", 0)
                            total_profit_earned = final_balance - initial_amount
                            
                            # Update investment status
                            await db.investments.update_one(
                                {"investment_id": investment["investment_id"]},
                                {"$set": {"status": "completed", "completed_at": now.isoformat()}}
                            )
                            
                            # Transfer final balance to available balance
                            current_available = user.get("available_balance", {}).get(currency, 0)
                            current_portfolio = user.get("portfolio_balance", {}).get(currency, 0)
                            
                            await db.users.update_one(
                                {"user_id": user["user_id"]},
                                {
                                    "$set": {
                                        f"available_balance.{currency}": current_available + final_balance,
                                        f"portfolio_balance.{currency}": max(0, current_portfolio - final_balance)
                                    }
                                }
                            )
                            
                            # Create payout transaction
                            tx_id = f"tx_{uuid.uuid4().hex[:12]}"
                            await db.transactions.insert_one({
                                "transaction_id": tx_id,
                                "user_id": user["user_id"],
                                "type": "payout",
                                "amount": final_balance,
                                "currency": currency,
                                "status": "completed",
                                "description": f"Завершение контракта «{portfolio_name}» → Выплата {final_balance:,.2f} {currency}",
                                "reference_id": investment["investment_id"],
                                "created_at": now.isoformat()
                            })
                            
                            # Send notification
                            try:
                                from routers.notifications import send_push_notification
                                await send_push_notification(
                                    user["user_id"],
                                    "Контракт завершён",
                                    f"Выплата {final_balance:,.2f} {currency} зачислена на ваш баланс"
                                )
                            except Exception as notify_err:
                                logger.debug(f"Push notification failed: {notify_err}")
                            
                            completed_count += 1
                            logger.info(f"Contract {investment['investment_id']} completed, payout: {final_balance} {currency}")
                            continue
                    except Exception as date_err:
                        logger.error(f"Error parsing end_date: {date_err}")
                
                # Check if it's time to accrue based on interval
                accrual_interval = portfolio.get("profit_accrual_interval", "monthly")
                last_accrual = investment.get("last_accrual_date")
                
                if last_accrual:
                    last_accrual_dt = datetime.fromisoformat(last_accrual.replace('Z', '+00:00'))
                    
                    if accrual_interval == "hourly" and (now - last_accrual_dt).total_seconds() < 3600:
                        skipped += 1
                        continue
                    elif accrual_interval == "daily" and (now - last_accrual_dt).days < 1:
                        skipped += 1
                        continue
                    elif accrual_interval == "weekly" and (now - last_accrual_dt).days < 7:
                        skipped += 1
                        continue
                    elif accrual_interval == "monthly" and (now - last_accrual_dt).days < 30:
                        skipped += 1
                        continue
                    elif accrual_interval == "yearly" and (now - last_accrual_dt).days < 365:
                        skipped += 1
                        continue
                
                # Calculate profit
                profit = await calculate_profit_for_investment(investment, portfolio)
                
                if profit <= 0:
                    skipped += 1
                    continue
                portfolio_name = portfolio.get("name", {}).get("ru", portfolio.get("portfolio_id", ""))
                
                if investment.get("auto_reinvest"):
                    # AUTO-REINVEST ON: Add profit to investment balance
                    new_balance = investment.get("current_balance", investment.get("amount", 0)) + profit
                    new_accrued = investment.get("accrued_profit", 0) + profit
                    
                    await db.investments.update_one(
                        {"investment_id": investment["investment_id"]},
                        {
                            "$set": {
                                "current_balance": new_balance,
                                "accrued_profit": new_accrued,
                                "last_accrual_date": now.isoformat()
                            }
                        }
                    )
                    
                    # Update user's portfolio balance
                    current_portfolio = user.get("portfolio_balance", {}).get(currency, 0)
                    await db.users.update_one(
                        {"user_id": user["user_id"]},
                        {"$set": {f"portfolio_balance.{currency}": current_portfolio + profit}}
                    )
                    
                    description = f"Доход от портфеля «{portfolio_name}» → Реинвестирован"
                else:
                    # AUTO-REINVEST OFF: Add profit to available balance
                    new_accrued = investment.get("accrued_profit", 0) + profit
                    
                    await db.investments.update_one(
                        {"investment_id": investment["investment_id"]},
                        {
                            "$set": {
                                "accrued_profit": new_accrued,
                                "last_accrual_date": now.isoformat()
                            }
                        }
                    )
                    
                    # Add profit to user's available balance
                    current_available = user.get("available_balance", {}).get(currency, 0)
                    await db.users.update_one(
                        {"user_id": user["user_id"]},
                        {"$set": {f"available_balance.{currency}": current_available + profit}}
                    )
                    
                    description = f"Доход от портфеля «{portfolio_name}» → Свободные средства"
                
                # Create transaction record
                tx_id = f"tx_{uuid.uuid4().hex[:12]}"
                await db.transactions.insert_one({
                    "transaction_id": tx_id,
                    "user_id": user["user_id"],
                    "type": "income",
                    "amount": profit,
                    "currency": currency,
                    "status": "completed",
                    "description": description,
                    "reference_id": investment["investment_id"],
                    "created_at": now.isoformat()
                })
                
                # Send push notification
                try:
                    from routers.notifications import notify_profit_accrued
                    await notify_profit_accrued(user["user_id"], profit, currency, portfolio_name)
                except Exception as notify_err:
                    logger.debug(f"Push notification failed: {notify_err}")
                
                processed += 1
                total_profit += profit
                
            except Exception as e:
                logger.error(f"Error processing investment {investment.get('investment_id')}: {e}")
                errors += 1
        
        logger.info(f"Profit accrual completed: processed={processed}, completed={completed_count}, skipped={skipped}, errors={errors}, total_profit=${total_profit:.2f}")
        
        # Log to audit
        await db.audit_logs.insert_one({
            "log_id": f"log_{uuid.uuid4().hex[:12]}",
            "action": "automatic_profit_accrual",
            "user_id": "system",
            "details": {
                "processed": processed,
                "completed_contracts": completed_count,
                "skipped": skipped,
                "errors": errors,
                "total_profit_distributed": total_profit
            },
            "timestamp": now.isoformat()
        })
        
    except Exception as e:
        logger.error(f"Profit accrual job failed: {e}")


# ================== BACKUP FUNCTION ==================

async def run_database_backup():
    """Create database backup every hour"""
    import subprocess
    from pathlib import Path
    
    backup_dir = Path("/app/backend/db_backup")
    db_name = os.environ.get('DB_NAME', 'test_database')
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    
    try:
        # Remove old backup and create new one
        result = subprocess.run([
            "mongodump",
            f"--uri={mongo_url}",
            f"--db={db_name}",
            f"--out={backup_dir.parent}/db_backup_temp",
            "--quiet"
        ], capture_output=True, text=True, timeout=60)
        
        if result.returncode == 0:
            # Replace old backup with new one
            import shutil
            temp_backup = backup_dir.parent / "db_backup_temp" / db_name
            if temp_backup.exists():
                if backup_dir.exists():
                    shutil.rmtree(backup_dir)
                backup_dir.mkdir(parents=True, exist_ok=True)
                for item in temp_backup.iterdir():
                    shutil.copy2(item, backup_dir / item.name)
                shutil.rmtree(backup_dir.parent / "db_backup_temp")
                logger.info(f"Database backup completed successfully")
        else:
            logger.error(f"Backup failed: {result.stderr}")
    except Exception as e:
        logger.error(f"Backup exception: {e}")


# ================== STARTUP / SHUTDOWN EVENTS ==================

@app.on_event("startup")
async def startup_event():
    """Initialize database and start scheduler when the app starts"""
    # Initialize database with backup data if empty
    try:
        from init_db import init_database
        await init_database()
    except Exception as e:
        logger.warning(f"Database initialization skipped: {e}")
    
    # Start profit accrual scheduler
    scheduler.add_job(
        run_profit_accrual,
        CronTrigger(minute=0),  # Every hour at minute 0
        id="profit_accrual_hourly",
        name="Automatic Profit Accrual",
        replace_existing=True
    )
    
    # Start database backup scheduler (every hour at minute 30)
    scheduler.add_job(
        run_database_backup,
        CronTrigger(minute=30),  # Every hour at minute 30
        id="database_backup_hourly",
        name="Automatic Database Backup",
        replace_existing=True
    )
    
    scheduler.start()
    logger.info("Schedulers started - Profit accrual at :00, Backup at :30")


@app.on_event("shutdown")
async def stop_scheduler():
    """Stop the scheduler when the app shuts down"""
    scheduler.shutdown(wait=False)
    logger.info("Profit accrual scheduler stopped")


@app.on_event("shutdown")
async def shutdown_db_client():
    """Close MongoDB connection on shutdown"""
    client.close()


# ================== STATIC FILES ==================

# Create uploads directory if it doesn't exist
uploads_dir = Path("/app/backend/uploads")
uploads_dir.mkdir(parents=True, exist_ok=True)

# Mount uploads directory for serving static files at /api/uploads
# This ensures the files are served through the backend API path
app.mount("/api/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")


# ================== INCLUDE MODULAR ROUTERS ==================

try:
    from routers import api_router as modular_api_router
    from routers.scheduler import set_scheduler
    
    # Pass scheduler instance to scheduler router
    set_scheduler(scheduler, run_profit_accrual)
    
    # Include all modular routers with /api prefix
    app.include_router(modular_api_router, prefix="/api")
    
    logging.info("Modular routers loaded successfully")
except ImportError as e:
    logging.error(f"Failed to load modular routers: {e}")
    raise


# ================== ROOT ENDPOINTS ==================

@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "AltynContract API", "version": "2.0.0"}


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}
