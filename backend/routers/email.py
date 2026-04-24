"""
Email router for AltynContract - Email templates, campaigns, notifications
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Request, HTTPException, BackgroundTasks
import uuid
import logging
import os

from database import db
from services.email_service import EmailService

router = APIRouter(prefix="/admin/email", tags=["email"])

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


async def log_admin_action(admin_id: str, action: str, target_type: str, target_id: str, details: dict):
    """Log admin action for audit"""
    log_id = f"log_{uuid.uuid4().hex[:12]}"
    doc = {
        "log_id": log_id,
        "admin_id": admin_id,
        "action": action,
        "target_type": target_type,
        "target_id": target_id,
        "details": details,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.audit_logs.insert_one(doc)


# ==================== TEST EMAIL ====================

@router.post("/test")
async def admin_test_email(request: Request):
    """Send test email to verify configuration"""
    admin = await get_admin_user(request)
    body = await request.json()
    test_email = body.get("email", admin.get("email"))
    
    success = await EmailService.send_email(
        test_email,
        "Тестовое письмо - AltynContract",
        """
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #0d4a4a; color: white; padding: 20px; text-align: center;">
                <h1>AltynContract</h1>
            </div>
            <div style="padding: 30px;">
                <h2>Тестовое письмо</h2>
                <p>Это тестовое письмо для проверки настроек email.</p>
                <p>Если вы получили это письмо, значит настройки работают корректно!</p>
            </div>
        </body>
        </html>
        """,
        admin.get("name")
    )
    
    if success:
        return {"message": "Test email sent", "email": test_email}
    else:
        raise HTTPException(status_code=500, detail="Failed to send email. Check email settings.")


# ==================== EMAIL TEMPLATES ====================

@router.get("/templates")
async def admin_get_email_templates(request: Request):
    """Get all email templates"""
    await get_admin_user(request)
    templates = await db.email_templates.find({}, {"_id": 0}).to_list(100)
    return templates


@router.post("/templates")
async def admin_create_email_template(request: Request):
    """Create email template"""
    admin = await get_admin_user(request)
    body = await request.json()
    
    template = {
        "template_id": f"etmpl_{uuid.uuid4().hex[:8]}",
        "name": body.get("name"),
        "subject": body.get("subject", {"ru": "", "en": "", "kz": ""}),
        "content": body.get("content", {"ru": "", "en": "", "kz": ""}),
        "is_active": body.get("is_active", True),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.email_templates.insert_one(template)
    
    await log_admin_action(admin["user_id"], "create_email_template", "email_template", template["template_id"], {"name": template["name"]})
    
    return {"template_id": template["template_id"], "message": "Template created"}


@router.put("/templates/{template_id}")
async def admin_update_email_template(template_id: str, request: Request):
    """Update email template"""
    admin = await get_admin_user(request)
    body = await request.json()
    
    body.pop("template_id", None)
    body.pop("created_at", None)
    
    result = await db.email_templates.update_one(
        {"template_id": template_id},
        {"$set": body}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    
    await log_admin_action(admin["user_id"], "update_email_template", "email_template", template_id, body)
    
    return {"message": "Template updated"}


@router.delete("/templates/{template_id}")
async def admin_delete_email_template(template_id: str, request: Request):
    """Delete email template"""
    admin = await get_admin_user(request)
    
    result = await db.email_templates.delete_one({"template_id": template_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    
    await log_admin_action(admin["user_id"], "delete_email_template", "email_template", template_id, {})
    
    return {"message": "Template deleted"}


# ==================== EMAIL CAMPAIGNS ====================

@router.get("/campaigns")
async def admin_get_campaigns(request: Request):
    """Get all email campaigns"""
    await get_admin_user(request)
    campaigns = await db.email_campaigns.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return campaigns


@router.post("/campaigns")
async def admin_create_campaign(request: Request):
    """Create email campaign"""
    admin = await get_admin_user(request)
    body = await request.json()
    
    campaign = {
        "campaign_id": f"camp_{uuid.uuid4().hex[:8]}",
        "subject": body.get("subject", {"ru": "", "en": "", "kz": ""}),
        "content": body.get("content", {"ru": "", "en": "", "kz": ""}),
        "filters": body.get("filters", {}),
        "status": "draft",
        "recipients_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.email_campaigns.insert_one(campaign)
    
    await log_admin_action(admin["user_id"], "create_campaign", "email_campaign", campaign["campaign_id"], {"subject": campaign["subject"]})
    
    return {"campaign_id": campaign["campaign_id"], "message": "Campaign created"}


@router.post("/campaigns/{campaign_id}/send")
async def admin_send_campaign(campaign_id: str, request: Request, background_tasks: BackgroundTasks):
    """Send email campaign"""
    admin = await get_admin_user(request)
    
    campaign = await db.email_campaigns.find_one({"campaign_id": campaign_id}, {"_id": 0})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    if campaign.get("status") == "sent":
        raise HTTPException(status_code=400, detail="Campaign already sent")
    
    # Build user query from filters
    user_query = {"role": "user"}
    filters = campaign.get("filters", {})
    
    if filters.get("tier"):
        user_query["tier"] = filters["tier"]
    if filters.get("min_balance"):
        user_query["total_invested"] = {"$gte": filters["min_balance"]}
    if filters.get("kyc_status"):
        user_query["kyc_status"] = filters["kyc_status"]
    
    # Get recipients
    users = await db.users.find(user_query, {"_id": 0, "email": 1, "name": 1, "preferred_language": 1}).to_list(10000)
    
    if not users:
        raise HTTPException(status_code=400, detail="No recipients match the filters")
    
    # Update campaign status
    await db.email_campaigns.update_one(
        {"campaign_id": campaign_id},
        {"$set": {"status": "sending", "recipients_count": len(users)}}
    )
    
    # Send emails in background
    async def send_campaign_emails():
        sent_count = 0
        for user in users:
            lang = user.get('preferred_language', 'ru')
            subject = campaign['subject'].get(lang, campaign['subject'].get('ru', 'Уведомление'))
            content = campaign['content'].get(lang, campaign['content'].get('ru', ''))
            
            # Replace placeholders
            content = content.replace('{{client_name}}', user.get('name', 'Клиент'))
            
            if await EmailService.send_email(user['email'], subject, content, user.get('name')):
                sent_count += 1
        
        await db.email_campaigns.update_one(
            {"campaign_id": campaign_id},
            {"$set": {
                "status": "sent",
                "sent_at": datetime.now(timezone.utc).isoformat(),
                "sent_count": sent_count
            }}
        )
    
    background_tasks.add_task(send_campaign_emails)
    
    await log_admin_action(admin["user_id"], "send_campaign", "email_campaign", campaign_id, {"recipients": len(users)})
    
    return {"message": "Campaign sending started", "recipients_count": len(users)}


@router.post("/notify-new-portfolio")
async def admin_notify_new_portfolio(request: Request, background_tasks: BackgroundTasks):
    """Send notification about new portfolio to all users"""
    admin = await get_admin_user(request)
    body = await request.json()
    portfolio_id = body.get("portfolio_id")
    
    portfolio = await db.portfolios.find_one({"portfolio_id": portfolio_id}, {"_id": 0})
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    users = await db.users.find({"role": "user"}, {"_id": 0, "email": 1, "name": 1, "preferred_language": 1}).to_list(10000)
    
    async def send_notifications():
        sent_count = await EmailService.send_new_portfolio_notification(users, portfolio)
        logger.info(f"New portfolio notification sent to {sent_count} users")
    
    background_tasks.add_task(send_notifications)
    
    await log_admin_action(admin["user_id"], "notify_new_portfolio", "portfolio", portfolio_id, {"users_count": len(users)})
    
    return {"message": "Notifications sending started", "recipients_count": len(users)}
