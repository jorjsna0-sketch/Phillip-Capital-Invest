"""
Scheduler router for AltynContract - Automatic profit accrual
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Request, HTTPException
import asyncio
import logging

from database import db

router = APIRouter(prefix="/scheduler", tags=["scheduler"])

logger = logging.getLogger(__name__)


async def get_admin_user(request: Request) -> dict:
    """Get current admin user"""
    # First try Authorization header (Safari ITP compatibility)
    auth_header = request.headers.get("Authorization")
    session_token = None
    if auth_header and auth_header.startswith("Bearer "):
        session_token = auth_header[7:]
    # Fallback to cookie
    if not session_token:
        session_token = request.cookies.get("session_token")
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return user


# These will be set by the main server.py
scheduler = None
run_profit_accrual = None


def set_scheduler(sched, accrual_func):
    """Set scheduler instance and accrual function from main app"""
    global scheduler, run_profit_accrual
    scheduler = sched
    run_profit_accrual = accrual_func


@router.get("/status")
async def get_scheduler_status(request: Request):
    """Get profit accrual scheduler status (admin only)"""
    await get_admin_user(request)
    
    if scheduler is None:
        return {"running": False, "jobs": [], "error": "Scheduler not initialized"}
    
    jobs = []
    for job in scheduler.get_jobs():
        jobs.append({
            "id": job.id,
            "name": job.name,
            "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
            "trigger": str(job.trigger)
        })
    
    return {
        "running": scheduler.running,
        "jobs": jobs
    }


@router.post("/run-now")
async def run_profit_accrual_now(request: Request):
    """Manually trigger profit accrual (admin only)"""
    await get_admin_user(request)
    
    if run_profit_accrual is None:
        raise HTTPException(status_code=500, detail="Profit accrual function not initialized")
    
    # Run in background
    asyncio.create_task(run_profit_accrual())
    
    return {"message": "Profit accrual job started in background", "status": "running"}
