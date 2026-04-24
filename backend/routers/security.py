"""
Security router for AltynContract - 2FA (Google Authenticator & Email)
"""
import io
import base64
import uuid
import random
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import pyotp
import qrcode

from database import db
from utils import get_current_user
from services.email_service import EmailService

router = APIRouter(prefix="/security", tags=["security"])


class Enable2FARequest(BaseModel):
    method: str  # 'totp' or 'email'


class Verify2FARequest(BaseModel):
    code: str
    method: str  # 'totp' or 'email'


class Disable2FARequest(BaseModel):
    method: str  # 'totp' or 'email'
    code: str


# ==================== TOTP (Google Authenticator) ====================

@router.get("/2fa/totp/setup")
async def setup_totp(user: dict = Depends(get_current_user)):
    """Generate TOTP secret and QR code for Google Authenticator setup"""
    # Generate new secret
    secret = pyotp.random_base32()
    
    # Create TOTP URI for QR code
    totp = pyotp.TOTP(secret)
    provisioning_uri = totp.provisioning_uri(
        name=user["email"],
        issuer_name="AltynContract"
    )
    
    # Generate QR code as base64
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(provisioning_uri)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    qr_base64 = base64.b64encode(buffer.getvalue()).decode()
    
    # Store temporary secret (not yet verified)
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"totp_secret_pending": secret}}
    )
    
    return {
        "secret": secret,
        "qr_code": f"data:image/png;base64,{qr_base64}",
        "manual_entry_key": secret
    }


@router.post("/2fa/totp/verify")
async def verify_and_enable_totp(data: Verify2FARequest, user: dict = Depends(get_current_user)):
    """Verify TOTP code and enable Google Authenticator 2FA"""
    # Get pending secret
    user_data = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    secret = user_data.get("totp_secret_pending")
    
    if not secret:
        raise HTTPException(status_code=400, detail="No pending TOTP setup. Please start setup first.")
    
    # Verify code
    totp = pyotp.TOTP(secret)
    if not totp.verify(data.code, valid_window=1):
        raise HTTPException(status_code=400, detail="Invalid code. Please try again.")
    
    # Enable TOTP 2FA
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {
            "$set": {
                "totp_secret": secret,
                "totp_enabled": True,
                "totp_enabled_at": datetime.now(timezone.utc).isoformat()
            },
            "$unset": {"totp_secret_pending": ""}
        }
    )
    
    return {"success": True, "message": "Google Authenticator enabled successfully"}


@router.post("/2fa/totp/disable")
async def disable_totp(data: Disable2FARequest, user: dict = Depends(get_current_user)):
    """Disable TOTP 2FA"""
    user_data = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    
    if not user_data.get("totp_enabled"):
        raise HTTPException(status_code=400, detail="TOTP is not enabled")
    
    # Verify code before disabling
    totp = pyotp.TOTP(user_data["totp_secret"])
    if not totp.verify(data.code, valid_window=1):
        raise HTTPException(status_code=400, detail="Invalid code")
    
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {
            "$set": {"totp_enabled": False},
            "$unset": {"totp_secret": "", "totp_secret_pending": ""}
        }
    )
    
    return {"success": True, "message": "Google Authenticator disabled"}


# ==================== Email 2FA ====================

@router.post("/2fa/email/setup")
async def setup_email_2fa(user: dict = Depends(get_current_user)):
    """Enable Email 2FA - sends verification code"""
    # Generate 6-digit code
    code = str(random.randint(100000, 999999))
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    
    # Store code
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {
            "$set": {
                "email_2fa_setup_code": code,
                "email_2fa_setup_expires": expires_at.isoformat()
            }
        }
    )
    
    # Send email
    try:
        await EmailService.send_email(
            to_email=user["email"],
            subject="AltynContract - Код подтверждения 2FA",
            html_content=f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #064E3B;">Включение двухфакторной аутентификации</h2>
                <p>Ваш код подтверждения:</p>
                <div style="background: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
                    <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #064E3B;">{code}</span>
                </div>
                <p style="color: #6b7280; font-size: 14px;">Код действителен 10 минут.</p>
                <p style="color: #6b7280; font-size: 14px;">Если вы не запрашивали этот код, проигнорируйте это письмо.</p>
            </div>
            """
        )
    except Exception as e:
        print(f"Email sending failed: {e}")
        # Continue anyway for development
    
    return {"success": True, "message": "Verification code sent to your email"}


@router.post("/2fa/email/verify")
async def verify_and_enable_email_2fa(data: Verify2FARequest, user: dict = Depends(get_current_user)):
    """Verify email code and enable Email 2FA"""
    user_data = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    
    stored_code = user_data.get("email_2fa_setup_code")
    expires_str = user_data.get("email_2fa_setup_expires")
    
    if not stored_code or not expires_str:
        raise HTTPException(status_code=400, detail="No pending setup. Please request a new code.")
    
    # Check expiration
    expires_at = datetime.fromisoformat(expires_str.replace('Z', '+00:00'))
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="Code expired. Please request a new code.")
    
    # Verify code
    if data.code != stored_code:
        raise HTTPException(status_code=400, detail="Invalid code")
    
    # Enable Email 2FA
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {
            "$set": {
                "email_2fa_enabled": True,
                "email_2fa_enabled_at": datetime.now(timezone.utc).isoformat()
            },
            "$unset": {"email_2fa_setup_code": "", "email_2fa_setup_expires": ""}
        }
    )
    
    return {"success": True, "message": "Email 2FA enabled successfully"}


@router.post("/2fa/email/disable")
async def disable_email_2fa(data: Disable2FARequest, user: dict = Depends(get_current_user)):
    """Disable Email 2FA"""
    user_data = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    
    if not user_data.get("email_2fa_enabled"):
        raise HTTPException(status_code=400, detail="Email 2FA is not enabled")
    
    # Send verification code
    code = str(random.randint(100000, 999999))
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    
    # For disable, we check if the provided code matches a recently sent one
    stored_code = user_data.get("email_2fa_disable_code")
    
    if not stored_code or data.code != stored_code:
        # Send new code
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {
                "$set": {
                    "email_2fa_disable_code": code,
                    "email_2fa_disable_expires": expires_at.isoformat()
                }
            }
        )
        
        try:
            await EmailService.send_email(
                to_email=user["email"],
                subject="AltynContract - Отключение 2FA",
                html_content=f"""
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #dc2626;">Отключение двухфакторной аутентификации</h2>
                    <p>Код для отключения 2FA:</p>
                    <div style="background: #fef2f2; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
                        <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #dc2626;">{code}</span>
                    </div>
                    <p style="color: #6b7280; font-size: 14px;">Код действителен 10 минут.</p>
                </div>
                """
            )
        except Exception as e:
            print(f"Email sending failed: {e}")
        
        raise HTTPException(status_code=400, detail="Verification code sent to your email. Please enter the code.")
    
    # Disable Email 2FA
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {
            "$set": {"email_2fa_enabled": False},
            "$unset": {"email_2fa_disable_code": "", "email_2fa_disable_expires": ""}
        }
    )
    
    return {"success": True, "message": "Email 2FA disabled"}


# ==================== 2FA Status ====================

@router.get("/2fa/status")
async def get_2fa_status(user: dict = Depends(get_current_user)):
    """Get current 2FA status for user"""
    user_data = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    
    return {
        "totp_enabled": user_data.get("totp_enabled", False),
        "totp_enabled_at": user_data.get("totp_enabled_at"),
        "email_2fa_enabled": user_data.get("email_2fa_enabled", False),
        "email_2fa_enabled_at": user_data.get("email_2fa_enabled_at")
    }


# ==================== Login 2FA Verification ====================

@router.post("/2fa/login/send-email-code")
async def send_login_email_code(email: str):
    """Send 2FA code for login (called during login if email 2FA is enabled)"""
    user = await db.users.find_one({"email": email}, {"_id": 0})
    
    if not user or not user.get("email_2fa_enabled"):
        raise HTTPException(status_code=400, detail="User not found or 2FA not enabled")
    
    code = str(random.randint(100000, 999999))
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {
            "$set": {
                "login_2fa_code": code,
                "login_2fa_expires": expires_at.isoformat()
            }
        }
    )
    
    try:
        await EmailService.send_email(
            to_email=email,
            subject="AltynContract - Код входа",
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
    
    return {"success": True}
