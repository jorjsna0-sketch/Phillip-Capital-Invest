"""
User router for Phillip Capital Invest - User profile and settings endpoints
"""
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Request, HTTPException
import secrets

from database import db
from models import Transaction, DepositRequest
from services import EmailService

router = APIRouter(prefix="/user", tags=["user"])


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
    
    expires_at = session.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user


@router.put("/settings")
async def update_user_settings(request: Request):
    """Update user settings"""
    user = await get_current_user(request)
    body = await request.json()
    
    update_fields = {}
    if "preferred_language" in body:
        update_fields["preferred_language"] = body["preferred_language"]
    if "preferred_currency" in body:
        update_fields["preferred_currency"] = body["preferred_currency"]
    if "name" in body:
        update_fields["name"] = body["name"]
    if "phone" in body:
        new_phone = body["phone"]
        if new_phone != user.get("phone"):
            update_fields["phone"] = new_phone
            update_fields["phone_verified"] = False
    
    if update_fields:
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": update_fields}
        )
    
    return {"message": "Settings updated"}


@router.post("/phone/send-code")
async def send_phone_verification_code(request: Request):
    """Send phone verification code to user's email"""
    user = await get_current_user(request)
    
    if not user.get("phone"):
        raise HTTPException(status_code=400, detail="Сначала укажите номер телефона")
    
    if user.get("phone_verified"):
        raise HTTPException(status_code=400, detail="Телефон уже подтверждён")
    
    # Generate 6-digit code
    code = f"{secrets.randbelow(900000) + 100000:06d}"
    expires = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
    
    # Save code to user
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {
            "phone_verification_code": code,
            "phone_verification_expires": expires
        }}
    )
    
    # Send code via email
    email_sent = await EmailService.send_email(
        to_email=user["email"],
        to_name=user.get("name"),
        subject="Код подтверждения телефона - Phillip Capital Invest",
        html_content=f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #064E3B;">Подтверждение телефона</h2>
            <p>Здравствуйте, {user.get('name', 'Уважаемый клиент')}!</p>
            <p>Ваш код подтверждения для номера <strong>{user.get('phone')}</strong>:</p>
            <div style="background: #f3f4f6; padding: 20px; text-align: center; font-size: 32px; letter-spacing: 8px; font-weight: bold; color: #064E3B; margin: 20px 0;">
                {code}
            </div>
            <p>Код действителен 15 минут.</p>
            <p>Если вы не запрашивали этот код, проигнорируйте это письмо.</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
            <p style="color: #6b7280; font-size: 12px;">С уважением,<br>Команда Phillip Capital Invest</p>
        </div>
        """
    )
    
    return {"message": "Код отправлен на ваш email", "email_sent": email_sent}


@router.post("/phone/verify")
async def verify_phone_code(request: Request):
    """Verify phone with code sent to email"""
    user = await get_current_user(request)
    body = await request.json()
    
    code = body.get("code", "").strip()
    if not code:
        raise HTTPException(status_code=400, detail="Введите код")
    
    stored_code = user.get("phone_verification_code")
    expires_str = user.get("phone_verification_expires")
    
    if not stored_code:
        raise HTTPException(status_code=400, detail="Сначала запросите код")
    
    if expires_str:
        expires = datetime.fromisoformat(expires_str.replace('Z', '+00:00'))
        if datetime.now(timezone.utc) > expires:
            raise HTTPException(status_code=400, detail="Код истёк. Запросите новый.")
    
    if code != stored_code:
        raise HTTPException(status_code=400, detail="Неверный код")
    
    # Mark phone as verified
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {
            "$set": {"phone_verified": True},
            "$unset": {"phone_verification_code": "", "phone_verification_expires": ""}
        }
    )
    
    return {"message": "Телефон успешно подтверждён"}


@router.get("/transactions")
async def get_user_transactions(request: Request):
    """Get user's transaction history"""
    user = await get_current_user(request)
    
    transactions = await db.transactions.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return transactions


@router.get("/profit-analytics")
async def get_profit_analytics(request: Request):
    """Get profit analytics for the current user"""
    user = await get_current_user(request)
    
    # Get all profit transactions
    profit_txs = await db.transactions.find(
        {"user_id": user["user_id"], "type": {"$in": ["profit", "income"]}},
        {"_id": 0}
    ).sort("created_at", 1).to_list(1000)
    
    if not profit_txs:
        return {"total_profit": 0, "monthly": [], "transactions": []}
    
    # Group by month
    monthly = {}
    total_profit = 0
    
    for tx in profit_txs:
        amount = tx.get("amount", 0)
        total_profit += amount
        
        created_at = tx.get("created_at")
        if isinstance(created_at, str):
            try:
                created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
            except:
                continue
        
        if created_at:
            month_key = created_at.strftime("%Y-%m")
            month_name = created_at.strftime("%B %Y")
            
            if month_key not in monthly:
                monthly[month_key] = {
                    "month": month_key,
                    "month_name": month_name,
                    "profit": 0,
                    "count": 0
                }
            
            monthly[month_key]["profit"] += amount
            monthly[month_key]["count"] += 1
    
    # Convert to list and add cumulative
    monthly_list = sorted(monthly.values(), key=lambda x: x["month"])
    cumulative = 0
    for m in monthly_list:
        cumulative += m["profit"]
        m["cumulative"] = cumulative
    
    return {
        "total_profit": total_profit,
        "monthly": monthly_list,
        "transactions": profit_txs[-20:]  # Last 20
    }
