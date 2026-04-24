"""
Utilities router for AltynContract - Exchange rates, translations, health checks
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Request, HTTPException, UploadFile, File
import httpx
import logging
import os
import uuid
from pathlib import Path

from database import db

router = APIRouter(tags=["utilities"])

logger = logging.getLogger(__name__)

# Upload directory
UPLOAD_DIR = Path("/app/backend/uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

logger = logging.getLogger(__name__)

# Exchange rates cache
_exchange_rates_cache = {
    "rates": None,
    "timestamp": None,
    "base": None
}


@router.get("/")
async def root():
    """Root endpoint"""
    return {"message": "AltynContract API", "version": "1.0.0"}


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


@router.get("/exchange-rates")
async def get_exchange_rates(base: str = "USD"):
    """Get current exchange rates"""
    global _exchange_rates_cache
    
    # Check cache (valid for 1 hour)
    now = datetime.now(timezone.utc)
    if (_exchange_rates_cache["timestamp"] and 
        _exchange_rates_cache["base"] == base and
        (now - _exchange_rates_cache["timestamp"]).total_seconds() < 3600):
        return _exchange_rates_cache["rates"]
    
    try:
        # Free API from exchangerate-api.com
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://api.exchangerate-api.com/v4/latest/{base}",
                timeout=10.0
            )
            if response.status_code == 200:
                data = response.json()
                rates = {
                    "base": data.get("base", base),
                    "rates": data.get("rates", {}),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
                # Update cache
                _exchange_rates_cache = {
                    "rates": rates,
                    "timestamp": now,
                    "base": base
                }
                return rates
    except Exception as e:
        logger.error(f"Error fetching exchange rates: {e}")
    
    # Fallback rates if API fails
    fallback_rates = {
        "base": base,
        "rates": {
            "USD": 1.0,
            "EUR": 0.92,
            "KZT": 450.0,
            "USDT": 1.0,
            "RUB": 90.0
        },
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "fallback": True
    }
    return fallback_rates


@router.post("/convert-currency")
async def convert_currency(request: Request):
    """Convert amount from one currency to another"""
    body = await request.json()
    amount = body.get("amount", 0)
    from_currency = body.get("from", "USD")
    to_currency = body.get("to", "USD")
    
    if from_currency == to_currency:
        return {"converted": amount, "rate": 1.0}
    
    rates = await get_exchange_rates(from_currency)
    rate = rates.get("rates", {}).get(to_currency, 1.0)
    
    return {
        "original": amount,
        "converted": amount * rate,
        "from": from_currency,
        "to": to_currency,
        "rate": rate
    }


@router.post("/translate")
async def translate_text(request: Request):
    """Translate text using Gemini API (requires Emergent LLM key)"""
    body = await request.json()
    text = body.get("text", "")
    source_lang = body.get("source", "ru")
    target_lang = body.get("target", "en")
    
    if not text:
        return {"translated": ""}
    
    # Use Gemini for translation via Emergent LLM key
    try:
        from emergentintegrations.llm.gemini import GeminiConfig, chat as gemini_chat
        import os
        
        config = GeminiConfig(
            api_key=os.environ.get("EMERGENT_LLM_KEY", ""),
            model="gemini-2.0-flash"
        )
        
        prompt = f"Translate the following text from {source_lang} to {target_lang}. Return only the translation without any explanations:\n\n{text}"
        
        response = await gemini_chat(config=config, prompt=prompt)
        
        return {
            "original": text,
            "translated": response.message,
            "source": source_lang,
            "target": target_lang
        }
    except Exception as e:
        logger.error(f"Translation error: {e}")
        return {
            "original": text,
            "translated": text,  # Return original if translation fails
            "source": source_lang,
            "target": target_lang,
            "error": str(e)
        }


# ==================== PUBLIC SITE INFO ====================

@router.get("/site-documents")
async def get_public_site_documents():
    """Get all public site documents (PDFs) - no auth required"""
    docs = await db.site_documents.find({}, {"_id": 0, "updated_by": 0}).to_list(100)
    return docs


@router.get("/site-documents/{doc_type}")
async def get_public_site_document(doc_type: str):
    """Get a specific site document by type - no auth required"""
    doc = await db.site_documents.find_one({"doc_type": doc_type}, {"_id": 0, "updated_by": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.get("/contact-info")
async def get_public_contact_info():
    """Get public site contact information - no auth required"""
    contact = await db.site_settings.find_one({"setting_id": "contact_info"}, {"_id": 0})
    if not contact:
        contact = {
            "phone": "+7 (727) 123-45-67",
            "phone_hours": {"ru": "Пн-Пт: 9:00 - 18:00", "en": "Mon-Fri: 9:00 AM - 6:00 PM", "kz": "Дс-Жм: 9:00 - 18:00"},
            "email": "info@altyncontract.kz",
            "address": {
                "ru": "г. Алматы, пр. Аль-Фараби, 77/8, БЦ \"Esentai Tower\"",
                "en": "77/8 Al-Farabi Ave., Esentai Tower, Almaty, Kazakhstan",
                "kz": "Алматы қ., Әл-Фараби д., 77/8, \"Esentai Tower\" БО"
            }
        }
    return contact


# ==================== EMAIL DEBUG (PUBLIC) ====================

@router.get("/email-status")
async def email_status():
    """Public endpoint to check email configuration status (no sensitive data)"""
    import os
    from services.email_service import EmailService
    
    settings = await EmailService.get_settings()
    
    return {
        "email_enabled": settings.get("email_enabled", False),
        "email_provider": settings.get("email_provider", "not set"),
        "smtp_host_set": bool(settings.get("smtp_host")),
        "smtp_user_set": bool(settings.get("smtp_user")),
        "smtp_password_set": bool(settings.get("smtp_password")),
        "email_from_set": bool(settings.get("email_from")),
        "sendgrid_key_set": bool(settings.get("sendgrid_api_key")),
        "env_loaded": {
            "EMAIL_ENABLED": os.environ.get("EMAIL_ENABLED", "not set"),
            "SMTP_HOST": "set" if os.environ.get("SMTP_HOST") else "not set",
        }
    }


@router.get("/email-test-connection")
async def email_test_connection():
    """Test SMTP connection and return detailed error if fails"""
    import smtplib
    import ssl
    import os
    from services.email_service import EmailService
    
    settings = await EmailService.get_settings()
    
    if not settings.get("email_enabled"):
        return {"success": False, "error": "Email disabled"}
    
    smtp_host = settings.get("smtp_host")
    smtp_port_raw = settings.get("smtp_port") or "587"
    try:
        smtp_port = int(str(smtp_port_raw).strip())
    except:
        smtp_port = 587
    smtp_user = settings.get("smtp_user")
    smtp_pass = settings.get("smtp_password")
    
    if not all([smtp_host, smtp_user, smtp_pass]):
        return {"success": False, "error": "SMTP not fully configured"}
    
    try:
        if smtp_port == 465:
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(smtp_host, smtp_port, context=context, timeout=10) as server:
                server.login(smtp_user, smtp_pass)
                return {"success": True, "message": f"Connected to {smtp_host}:{smtp_port} via SSL"}
        else:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
                server.starttls()
                server.login(smtp_user, smtp_pass)
                return {"success": True, "message": f"Connected to {smtp_host}:{smtp_port} via STARTTLS"}
    except smtplib.SMTPAuthenticationError as e:
        return {"success": False, "error": f"Authentication failed: {str(e)}"}
    except smtplib.SMTPConnectError as e:
        return {"success": False, "error": f"Connection failed: {str(e)}"}
    except TimeoutError:
        return {"success": False, "error": "Connection timeout - port may be blocked"}
    except Exception as e:
        return {"success": False, "error": f"{type(e).__name__}: {str(e)}"}


# ==================== FILE UPLOAD ====================

@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload a file and return its URL"""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    # Validate file type
    allowed_types = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail=f"File type not allowed: {file.content_type}")
    
    # Generate unique filename
    ext = Path(file.filename).suffix
    unique_filename = f"{uuid.uuid4().hex}{ext}"
    file_path = UPLOAD_DIR / unique_filename
    
    # Save file
    try:
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)
        
        # Return URL with /api/uploads path for proper routing through ingress
        return {
            "url": f"/api/uploads/{unique_filename}",
            "filename": unique_filename,
            "original_name": file.filename,
            "content_type": file.content_type
        }
    except Exception as e:
        logger.error(f"Error uploading file: {e}")
        raise HTTPException(status_code=500, detail="Error uploading file")
