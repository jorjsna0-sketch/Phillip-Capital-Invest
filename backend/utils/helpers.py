"""
Utility functions for AltynContract
"""
import hashlib
from datetime import datetime, timezone
from fastapi import Request, HTTPException

from database import db
from models import AuditLog
from config import TIER_THRESHOLDS


def hash_password(password: str) -> str:
    """Hash password using SHA256"""
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(password: str, hashed: str) -> bool:
    """Verify password against hash"""
    return hash_password(password) == hashed


def calculate_tier(total_invested: float) -> str:
    """Calculate user tier based on total invested amount"""
    if total_invested >= TIER_THRESHOLDS.get("platinum", 100000):
        return "platinum"
    elif total_invested >= TIER_THRESHOLDS.get("gold", 50000):
        return "gold"
    return "silver"


async def get_current_user(request: Request) -> dict:
    """Get current user from session token"""
    # First try Authorization header (preferred for Safari/iOS compatibility)
    session_token = None
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        session_token = auth_header[7:]
    
    # Fallback to cookie for backwards compatibility
    if not session_token:
        session_token = request.cookies.get("session_token")
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    expires_at = session.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user


async def get_admin_user(request: Request) -> dict:
    """Get current admin user"""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


async def log_admin_action(admin_id: str, action: str, target_type: str, target_id: str, details: dict):
    """Log admin action for audit"""
    log = AuditLog(
        admin_id=admin_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        details=details
    )
    doc = log.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.audit_logs.insert_one(doc)
