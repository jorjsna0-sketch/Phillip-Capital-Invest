"""
Push Notifications router for AltynContract PWA
"""
import os
import json
import uuid
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel
from pywebpush import webpush, WebPushException

from database import db
from utils import get_current_user

router = APIRouter(prefix="/notifications", tags=["notifications"])

# VAPID configuration
VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY", "")
VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "")
VAPID_MAILTO = os.environ.get("VAPID_MAILTO", "mailto:support@altyncontract.kz")


class PushSubscription(BaseModel):
    endpoint: str
    keys: dict


class NotificationPayload(BaseModel):
    title: str
    body: str
    icon: Optional[str] = "/icons/icon-192x192.png"
    badge: Optional[str] = "/icons/icon-72x72.png"
    url: Optional[str] = "/dashboard"
    tag: Optional[str] = None


# ==================== PUBLIC KEY ====================

@router.get("/vapid-public-key")
async def get_vapid_public_key():
    """Get VAPID public key for push subscription"""
    return {"publicKey": VAPID_PUBLIC_KEY}


# ==================== SUBSCRIPTION MANAGEMENT ====================

@router.post("/subscribe")
async def subscribe_push(subscription: PushSubscription, user: dict = Depends(get_current_user)):
    """Subscribe to push notifications"""
    subscription_id = f"sub_{uuid.uuid4().hex[:12]}"
    
    # Check if already subscribed with same endpoint
    existing = await db.push_subscriptions.find_one({
        "user_id": user["user_id"],
        "endpoint": subscription.endpoint
    })
    
    if existing:
        # Update existing subscription
        await db.push_subscriptions.update_one(
            {"subscription_id": existing["subscription_id"]},
            {"$set": {
                "keys": subscription.keys,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        return {"message": "Subscription updated", "subscription_id": existing["subscription_id"]}
    
    # Create new subscription
    doc = {
        "subscription_id": subscription_id,
        "user_id": user["user_id"],
        "endpoint": subscription.endpoint,
        "keys": subscription.keys,
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.push_subscriptions.insert_one(doc)
    
    # Send welcome notification
    try:
        await send_push_to_subscription(
            subscription.model_dump(),
            NotificationPayload(
                title="Уведомления включены!",
                body="Вы будете получать уведомления о важных событиях",
                url="/dashboard"
            )
        )
    except Exception as e:
        print(f"Welcome notification failed: {e}")
    
    return {"message": "Subscribed successfully", "subscription_id": subscription_id}


@router.delete("/unsubscribe")
async def unsubscribe_push(user: dict = Depends(get_current_user)):
    """Unsubscribe from push notifications"""
    result = await db.push_subscriptions.update_many(
        {"user_id": user["user_id"]},
        {"$set": {"active": False}}
    )
    
    return {"message": "Unsubscribed", "count": result.modified_count}


@router.get("/status")
async def get_notification_status(user: dict = Depends(get_current_user)):
    """Get push notification status for user"""
    subscriptions = await db.push_subscriptions.count_documents({
        "user_id": user["user_id"],
        "active": True
    })
    
    return {
        "subscribed": subscriptions > 0,
        "subscription_count": subscriptions
    }


# ==================== SEND NOTIFICATIONS ====================

async def send_push_to_subscription(subscription: dict, payload: NotificationPayload):
    """Send push notification to a single subscription"""
    try:
        webpush(
            subscription_info={
                "endpoint": subscription["endpoint"],
                "keys": subscription["keys"]
            },
            data=json.dumps({
                "title": payload.title,
                "body": payload.body,
                "icon": payload.icon,
                "badge": payload.badge,
                "url": payload.url,
                "tag": payload.tag or str(uuid.uuid4())[:8]
            }),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims={"sub": VAPID_MAILTO}
        )
        return True
    except WebPushException as e:
        print(f"WebPush error: {e}")
        # If subscription expired, mark as inactive
        if e.response and e.response.status_code in [404, 410]:
            await db.push_subscriptions.update_one(
                {"endpoint": subscription["endpoint"]},
                {"$set": {"active": False}}
            )
        return False


async def send_push_to_user(user_id: str, payload: NotificationPayload):
    """Send push notification to all user's active subscriptions"""
    subscriptions = await db.push_subscriptions.find({
        "user_id": user_id,
        "active": True
    }, {"_id": 0}).to_list(10)
    
    results = []
    for sub in subscriptions:
        success = await send_push_to_subscription(sub, payload)
        results.append({"subscription_id": sub["subscription_id"], "success": success})
    
    return results


# ==================== NOTIFICATION TRIGGERS ====================

async def send_email_notification(user_id: str, subject: str, html_content: str):
    """Send email notification to user"""
    try:
        from services.email_service import EmailService
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        if user and user.get('email'):
            await EmailService.send_email(
                to_email=user['email'],
                subject=subject,
                html_content=html_content,
                to_name=user.get('name')
            )
    except Exception as e:
        print(f"Email notification failed: {e}")


async def notify_profit_accrued(user_id: str, amount: float, currency: str, portfolio_name: str):
    """Notify user about profit accrual"""
    await send_push_to_user(user_id, NotificationPayload(
        title="Начислена прибыль!",
        body=f"+{amount:.2f} {currency} от портфеля «{portfolio_name}»",
        url="/history",
        tag="profit"
    ))


async def notify_deposit_approved(user_id: str, amount: float, currency: str):
    """Notify user about deposit approval"""
    await send_push_to_user(user_id, NotificationPayload(
        title="Депозит одобрен",
        body=f"Ваш депозит на {amount:.2f} {currency} зачислен",
        url="/wallet",
        tag="deposit"
    ))
    
    # Send email notification
    await send_email_notification(
        user_id,
        f"Депозит {amount:.2f} {currency} зачислен",
        f"""
        <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: #0d6e56;">Депозит зачислен</h2>
            <p>Ваш депозит на сумму <strong>{amount:,.2f} {currency}</strong> успешно зачислен на ваш счёт.</p>
            <p>Вы можете использовать эти средства для инвестирования.</p>
            <p style="color: #666; font-size: 12px; margin-top: 20px;">Команда AltynContract</p>
        </div>
        """
    )


async def notify_withdrawal_processed(user_id: str, amount: float, currency: str, status: str):
    """Notify user about withdrawal status"""
    if status == "approved":
        title = "Вывод одобрен"
        body = f"Вывод {amount:.2f} {currency} обрабатывается"
        email_subject = f"Вывод {amount:.2f} {currency} одобрен"
        email_body = f"""
        <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: #0d6e56;">Вывод средств одобрен</h2>
            <p>Ваша заявка на вывод <strong>{amount:,.2f} {currency}</strong> одобрена и обрабатывается.</p>
            <p>Средства будут переведены в ближайшее время.</p>
            <p style="color: #666; font-size: 12px; margin-top: 20px;">Команда AltynContract</p>
        </div>
        """
    else:
        title = "Вывод отклонён"
        body = f"Вывод {amount:.2f} {currency} отклонён"
        email_subject = f"Вывод {amount:.2f} {currency} отклонён"
        email_body = f"""
        <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: #c53030;">Вывод средств отклонён</h2>
            <p>Ваша заявка на вывод <strong>{amount:,.2f} {currency}</strong> была отклонена.</p>
            <p>Средства возвращены на ваш баланс. Для уточнения деталей обратитесь в поддержку.</p>
            <p style="color: #666; font-size: 12px; margin-top: 20px;">Команда AltynContract</p>
        </div>
        """
    
    await send_push_to_user(user_id, NotificationPayload(
        title=title,
        body=body,
        url="/wallet",
        tag="withdrawal"
    ))
    
    # Send email notification
    await send_email_notification(user_id, email_subject, email_body)


async def notify_contract_signed(user_id: str, portfolio_name: str, amount: float, currency: str):
    """Notify user about new contract"""
    await send_push_to_user(user_id, NotificationPayload(
        title="Контракт подписан",
        body=f"Инвестиция {amount:.2f} {currency} в «{portfolio_name}» активирована",
        url="/history",
        tag="contract"
    ))


# ==================== ADMIN: BROADCAST ====================

@router.post("/broadcast")
async def broadcast_notification(payload: NotificationPayload, background_tasks: BackgroundTasks):
    """Admin: Send notification to all subscribed users"""
    # Note: In production, add admin authentication
    
    subscriptions = await db.push_subscriptions.find(
        {"active": True},
        {"_id": 0}
    ).to_list(1000)
    
    async def send_all():
        success = 0
        failed = 0
        for sub in subscriptions:
            result = await send_push_to_subscription(sub, payload)
            if result:
                success += 1
            else:
                failed += 1
        print(f"Broadcast complete: {success} success, {failed} failed")
    
    background_tasks.add_task(send_all)
    
    return {"message": "Broadcast started", "total_subscriptions": len(subscriptions)}


# ==================== TEST ====================

@router.post("/test")
async def test_notification(user: dict = Depends(get_current_user)):
    """Send test notification to current user"""
    results = await send_push_to_user(user["user_id"], NotificationPayload(
        title="Тестовое уведомление",
        body="Push-уведомления работают!",
        url="/dashboard"
    ))
    
    return {"message": "Test notification sent", "results": results}
