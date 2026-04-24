"""
Authentication router for Phillip Capital Invest
"""
from datetime import datetime, timezone, timedelta
import uuid
import secrets
import httpx
import pyotp
from fastapi import APIRouter, Request, Response, HTTPException
from pydantic import BaseModel

from database import db
from models import User, UserCreate, UserLogin
from utils import hash_password, verify_password, get_current_user
from services.email_service import EmailService

router = APIRouter(prefix="/auth", tags=["auth"])


class Login2FARequest(BaseModel):
    email: str
    password: str
    totp_code: str = None
    email_code: str = None


@router.post("/register")
async def register(data: UserCreate, response: Response):
    """Register new user with email/password"""
    existing = await db.users.find_one({"email": data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user = User(
        user_id=user_id,
        email=data.email,
        name=data.name,
        role="user"
    )
    user_doc = user.model_dump()
    user_doc['password_hash'] = hash_password(data.password)
    user_doc['created_at'] = user_doc['created_at'].isoformat()
    
    await db.users.insert_one(user_doc)
    
    # Create session
    session_token = f"sess_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Note: We use Bearer token in Authorization header instead of cookies
    # This avoids Safari ITP (Intelligent Tracking Prevention) blocking issues
    
    return {"user_id": user_id, "email": data.email, "name": data.name, "session_token": session_token}


@router.post("/login")
async def login(data: UserLogin, response: Response):
    """Login with email/password - returns 2FA requirement if enabled"""
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(data.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Check if 2FA is enabled
    totp_enabled = user.get("totp_enabled", False)
    email_2fa_enabled = user.get("email_2fa_enabled", False)
    
    if totp_enabled or email_2fa_enabled:
        # Return 2FA required response
        # Send email code if email 2FA is enabled
        if email_2fa_enabled:
            code = f"{secrets.randbelow(900000) + 100000:06d}"
            expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
            await db.users.update_one(
                {"user_id": user["user_id"]},
                {"$set": {
                    "login_2fa_code": code,
                    "login_2fa_expires": expires_at.isoformat()
                }}
            )
            try:
                await EmailService.send_email(
                    to_email=user["email"],
                    subject="Phillip Capital Invest - Код входа",
                    html_content=f"""
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #064E3B;">Вход в аккаунт</h2>
                        <p>Ваш код для входа:</p>
                        <div style="background: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
                            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #064E3B;">{code}</span>
                        </div>
                        <p style="color: #6b7280; font-size: 14px;">Код действителен 10 минут.</p>
                    </div>
                    """
                )
            except Exception as e:
                print(f"Email sending failed: {e}")
        
        return {
            "requires_2fa": True,
            "totp_enabled": totp_enabled,
            "email_2fa_enabled": email_2fa_enabled,
            "email_masked": user["email"][:3] + "***" + user["email"][user["email"].index("@"):]
        }
    
    # No 2FA - proceed with login
    return await _complete_login(user, response)


@router.post("/login/2fa")
async def login_with_2fa(data: Login2FARequest, response: Response):
    """Complete login with 2FA code"""
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(data.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Verify 2FA
    totp_enabled = user.get("totp_enabled", False)
    email_2fa_enabled = user.get("email_2fa_enabled", False)
    
    if totp_enabled and data.totp_code:
        # Verify TOTP
        totp = pyotp.TOTP(user.get("totp_secret", ""))
        if not totp.verify(data.totp_code, valid_window=1):
            raise HTTPException(status_code=401, detail="Invalid authenticator code")
    elif email_2fa_enabled and data.email_code:
        # Verify email code
        stored_code = user.get("login_2fa_code")
        expires_str = user.get("login_2fa_expires")
        
        if not stored_code or data.email_code != stored_code:
            raise HTTPException(status_code=401, detail="Invalid email code")
        
        if expires_str:
            expires_at = datetime.fromisoformat(expires_str.replace('Z', '+00:00'))
            if datetime.now(timezone.utc) > expires_at:
                raise HTTPException(status_code=401, detail="Code expired")
        
        # Clear used code
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$unset": {"login_2fa_code": "", "login_2fa_expires": ""}}
        )
    else:
        raise HTTPException(status_code=400, detail="2FA code required")
    
    return await _complete_login(user, response)


async def _complete_login(user: dict, response: Response):
    """Complete login after password/2FA verification"""
    # Ensure user has account_number (for legacy users)
    if not user.get("account_number"):
        account_number = f"AC{uuid.uuid4().hex[:8].upper()}"
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": {"account_number": account_number}}
        )
        user["account_number"] = account_number
    
    # Create session
    session_token = f"sess_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user["user_id"],
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Note: We use Bearer token in Authorization header instead of cookies
    # This avoids Safari ITP (Intelligent Tracking Prevention) blocking issues
    
    return {
        "user_id": user["user_id"],
        "email": user["email"],
        "name": user["name"],
        "role": user.get("role", "user"),
        "session_token": session_token,
        "account_number": user.get("account_number")
    }


@router.post("/session")
async def process_session(request: Request, response: Response):
    """Process OAuth session from Emergent Auth"""
    body = await request.json()
    session_id = body.get("session_id")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="Session ID required")
    
    # Call Emergent Auth API
    async with httpx.AsyncClient() as client:
        auth_response = await client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
        
        if auth_response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session")
        
        auth_data = auth_response.json()
    
    # Find or create user
    user = await db.users.find_one({"email": auth_data["email"]}, {"_id": 0})
    
    if not user:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user = User(
            user_id=user_id,
            email=auth_data["email"],
            name=auth_data["name"],
            picture=auth_data.get("picture"),
            role="user"
        )
        user_doc = user.model_dump()
        user_doc['created_at'] = user_doc['created_at'].isoformat()
        await db.users.insert_one(user_doc)
        user = user_doc
    else:
        # Update picture if changed
        if auth_data.get("picture") and auth_data["picture"] != user.get("picture"):
            await db.users.update_one(
                {"user_id": user["user_id"]},
                {"$set": {"picture": auth_data["picture"]}}
            )
            user["picture"] = auth_data["picture"]
    
    # Create internal session
    session_token = auth_data.get("session_token", f"sess_{uuid.uuid4().hex}")
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    await db.user_sessions.insert_one({
        "user_id": user["user_id"],
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Note: We use Bearer token in Authorization header instead of cookies
    # This avoids Safari ITP (Intelligent Tracking Prevention) blocking issues
    
    return {
        "user_id": user["user_id"],
        "email": user["email"],
        "name": user["name"],
        "picture": user.get("picture"),
        "role": user.get("role", "user"),
        "session_token": session_token
    }


@router.get("/me")
async def get_me(request: Request):
    """Get current user data"""
    user = await get_current_user(request)
    
    # Ensure user has account_number (for legacy users)
    account_number = user.get("account_number")
    if not account_number:
        account_number = f"AC{uuid.uuid4().hex[:8].upper()}"
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": {"account_number": account_number}}
        )
    
    return {
        "user_id": user["user_id"],
        "email": user["email"],
        "name": user["name"],
        "picture": user.get("picture"),
        "role": user.get("role", "user"),
        "tier": user.get("tier", "silver"),
        "available_balance": user.get("available_balance", {"USD": 0, "TRY": 0, "EUR": 0, "USDT": 0}),
        "portfolio_balance": user.get("portfolio_balance", {"USD": 0, "TRY": 0, "EUR": 0, "USDT": 0}),
        "total_invested": user.get("total_invested", 0),
        "kyc_status": user.get("kyc_status", "none"),
        "preferred_language": user.get("preferred_language", "ru"),
        "preferred_currency": user.get("preferred_currency", "USD"),
        "account_number": account_number,
        "phone": user.get("phone"),
        "phone_verified": user.get("phone_verified", False),
        "can_invest_without_kyc": user.get("can_invest_without_kyc", False)
    }


@router.post("/logout")
async def logout(request: Request, response: Response):
    """Logout user"""
    # Try to get token from Authorization header first
    auth_header = request.headers.get("Authorization", "")
    session_token = None
    
    if auth_header.startswith("Bearer "):
        session_token = auth_header[7:]
    else:
        # Fallback to cookie for backwards compatibility
        session_token = request.cookies.get("session_token")
    
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    
    return {"message": "Logged out successfully"}
