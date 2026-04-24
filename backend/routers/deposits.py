"""
Deposits router for Phillip Capital Invest - Deposit and withdrawal requests
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Request, HTTPException
import uuid

from database import db

router = APIRouter(tags=["deposits"])


async def get_current_user(request: Request) -> dict:
    """Get current user from session token"""
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
    
    return user


# ==================== DEPOSIT REQUESTS ====================

@router.get("/deposit-requests")
async def get_deposit_requests(request: Request):
    """Get user's deposit requests"""
    user = await get_current_user(request)
    
    requests = await db.deposit_requests.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return requests


@router.post("/deposit-requests")
async def create_deposit_request(request: Request):
    """Create deposit request"""
    user = await get_current_user(request)
    body = await request.json()
    
    amount = body.get("amount", 0)
    currency = body.get("currency", "USD")
    
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid amount")
    
    request_id = f"dep_{uuid.uuid4().hex[:12]}"
    doc = {
        "request_id": request_id,
        "user_id": user["user_id"],
        "amount": amount,
        "currency": currency,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.deposit_requests.insert_one(doc)
    
    return {"message": "Deposit request created", "request_id": request_id}


# ==================== WITHDRAWAL REQUESTS ====================

@router.get("/withdrawal-requests")
async def get_withdrawal_requests(request: Request):
    """Get user's withdrawal requests"""
    user = await get_current_user(request)
    
    requests = await db.withdrawal_requests.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return requests


@router.post("/withdrawal-requests")
async def create_withdrawal_request(request: Request):
    """Create withdrawal request"""
    user = await get_current_user(request)
    body = await request.json()
    
    amount = body.get("amount", 0)
    currency = body.get("currency", "USD")
    broker_id = body.get("broker_id", "")
    broker_account = body.get("broker_account", "")
    
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid amount")
    
    # Check available balance
    available = user.get("available_balance", {}).get(currency, 0)
    if amount > available:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    # Get broker info
    broker_name = ""
    if broker_id:
        settings = await db.admin_settings.find_one({"setting_id": "admin_settings"}, {"_id": 0})
        if settings:
            brokers = settings.get("brokers", [])
            for b in brokers:
                if b.get("broker_id") == broker_id:
                    broker_name = b.get("name", "")
                    break
    
    request_id = f"wd_{uuid.uuid4().hex[:12]}"
    doc = {
        "request_id": request_id,
        "user_id": user["user_id"],
        "amount": amount,
        "currency": currency,
        "broker_id": broker_id,
        "broker_name": broker_name,
        "broker_account": broker_account,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.withdrawal_requests.insert_one(doc)
    
    return {"message": "Withdrawal request created", "request_id": request_id}


# ==================== BROKERS ====================

@router.get("/brokers")
async def get_brokers():
    """Get available brokers for withdrawals"""
    settings = await db.admin_settings.find_one({"setting_id": "admin_settings"}, {"_id": 0})
    
    if not settings:
        return []
    
    brokers = settings.get("brokers", [])
    # Return only active brokers with safe fields
    return [
        {
            "broker_id": b.get("broker_id"),
            "name": b.get("name"),
            "instructions": b.get("instructions", {})
        }
        for b in brokers if b.get("is_active", True)
    ]


# ==================== COMPANY BANK INFO ====================

@router.get("/company-bank-info")
async def get_company_bank_info():
    """Get company bank info for deposits"""
    settings = await db.admin_settings.find_one({"setting_id": "admin_settings"}, {"_id": 0})
    
    if not settings:
        return {}
    
    return {
        "bank_name": settings.get("company_bank_name"),
        "bank_account": settings.get("company_bank_account"),
        "bank_iban": settings.get("company_bank_iban"),
        "company_name": settings.get("company_name")
    }
