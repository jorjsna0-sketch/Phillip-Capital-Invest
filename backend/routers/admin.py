"""
Admin router for Phillip Capital Invest - Admin panel endpoints
"""
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Request, HTTPException
import uuid
import logging

from database import db

router = APIRouter(prefix="/admin", tags=["admin"])


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


# ==================== DASHBOARD ====================

@router.get("/dashboard")
async def get_dashboard(request: Request):
    """Get admin dashboard stats"""
    await get_admin_user(request)
    
    users_count = await db.users.count_documents({})
    portfolios_count = await db.portfolios.count_documents({"status": "active"})
    pending_kyc = await db.kyc_documents.count_documents({"status": "pending"})
    pending_withdrawals = await db.transactions.count_documents({"type": "withdrawal", "status": "pending"})
    pending_deposits = await db.deposit_requests.count_documents({"status": "pending"})
    pending_withdrawal_requests = await db.withdrawal_requests.count_documents({"status": "pending"})
    
    return {
        "users_count": users_count,
        "portfolios_count": portfolios_count,
        "pending_kyc": pending_kyc,
        "pending_withdrawals": pending_withdrawals,
        "pending_deposits": pending_deposits,
        "pending_withdrawal_requests": pending_withdrawal_requests
    }


# ==================== USERS MANAGEMENT ====================

@router.get("/users")
async def get_users(request: Request):
    """Get all users"""
    await get_admin_user(request)
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return users


@router.get("/users/{user_id}")
async def get_user(user_id: str, request: Request):
    """Get user details"""
    await get_admin_user(request)
    
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get user's investments
    investments = await db.investments.find(
        {"user_id": user_id}, 
        {"_id": 0}
    ).to_list(100)
    
    # Batch query: Get portfolio names and enrich investments
    if investments:
        # Get all portfolio IDs
        portfolio_ids = list(set(inv.get("portfolio_id") for inv in investments if inv.get("portfolio_id")))
        
        # Fetch portfolios
        portfolios = await db.portfolios.find(
            {"portfolio_id": {"$in": portfolio_ids}},
            {"_id": 0, "portfolio_id": 1, "name": 1}
        ).to_list(None)
        portfolio_map = {p["portfolio_id"]: p.get("name", {}).get("ru", p.get("name", {}).get("en", "")) for p in portfolios}
        
        # Get profit info
        investment_ids = [inv.get("investment_id") for inv in investments]
        
        profit_pipeline = [
            {
                "$match": {
                    "reference_id": {"$in": investment_ids},
                    "type": {"$in": ["income", "profit"]},
                    "status": "completed"
                }
            },
            {
                "$group": {
                    "_id": "$reference_id",
                    "total_paid": {"$sum": "$amount"}
                }
            }
        ]
        
        profit_results = await db.transactions.aggregate(profit_pipeline).to_list(None)
        paid_by_investment = {r["_id"]: r["total_paid"] for r in profit_results}
        
        for inv in investments:
            investment_id = inv.get("investment_id")
            paid_profit = paid_by_investment.get(investment_id, 0)
            expected_return = inv.get("expected_return", 0)
            remaining_profit = max(0, expected_return - paid_profit)
            
            inv["paid_profit"] = paid_profit
            inv["remaining_profit"] = remaining_profit
            inv["portfolio_name"] = portfolio_map.get(inv.get("portfolio_id"), inv.get("portfolio_id"))
    
    # Get user's transactions
    transactions = await db.transactions.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    # Get user's KYC documents
    kyc_docs = await db.kyc_documents.find(
        {"user_id": user_id},
        {"_id": 0}
    ).to_list(10)
    
    return {
        **user,
        "investments": investments,
        "transactions": transactions,
        "kyc_documents": kyc_docs
    }


@router.put("/users/{user_id}")
async def update_user(user_id: str, request: Request):
    """Update user (admin only)"""
    admin = await get_admin_user(request)
    body = await request.json()
    
    # Fields that can be updated
    allowed_fields = ["name", "role", "tier", "kyc_status", "preferred_language", 
                      "preferred_currency", "phone", "phone_verified", "can_invest_without_kyc"]
    
    update_data = {k: v for k, v in body.items() if k in allowed_fields}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    result = await db.users.update_one(
        {"user_id": user_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    await log_admin_action(admin["user_id"], "update_user", "user", user_id, update_data)
    
    return {"message": "User updated", "user_id": user_id}


@router.put("/users/{user_id}/balance")
async def update_user_balance(user_id: str, request: Request):
    """Update user balance (admin only)"""
    admin = await get_admin_user(request)
    body = await request.json()
    
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    balance_type = body.get("balance_type", "available_balance")
    currency = body.get("currency", "USD")
    amount = body.get("amount", 0)
    operation = body.get("operation", "set")  # set, add, subtract
    
    if balance_type not in ["available_balance", "portfolio_balance"]:
        raise HTTPException(status_code=400, detail="Invalid balance type")
    
    current = user.get(balance_type, {}).get(currency, 0)
    new_value = amount  # default (set operation)
    
    if operation == "add":
        new_value = current + amount
    elif operation == "subtract":
        new_value = current - amount
    
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {f"{balance_type}.{currency}": new_value}}
    )
    
    await log_admin_action(admin["user_id"], "update_balance", "user", user_id, {
        "balance_type": balance_type,
        "currency": currency,
        "operation": operation,
        "old_value": current,
        "new_value": new_value
    })
    
    return {"message": "Balance updated", "new_balance": new_value}


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, request: Request, with_payout: bool = False, force: bool = False):
    """Delete user (admin only) - soft delete
    
    Args:
        with_payout: If True, terminate investments with payout
        force: If True, terminate all active investments before deleting
    """
    admin = await get_admin_user(request)
    
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get("role") == "admin":
        raise HTTPException(status_code=400, detail="Cannot delete admin users")
    
    # Check for active investments
    active_investments = await db.investments.find({
        "user_id": user_id,
        "status": "active"
    }).to_list(1000)
    
    active_count = len(active_investments)
    
    if active_count > 0 and not force:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot delete user with {active_count} active investments. Use force=true to terminate them."
        )
    
    # If force delete, terminate all active investments
    if active_count > 0 and force:
        for inv in active_investments:
            if with_payout:
                # Calculate payout: principal + remaining profit
                payout = inv.get("amount", 0) + inv.get("remaining_profit", inv.get("expected_return", 0))
                
                # Update user balance
                await db.users.update_one(
                    {"user_id": user_id},
                    {"$inc": {"balance": payout}}
                )
                
                # Record transaction
                await db.transactions.insert_one({
                    "transaction_id": f"txn_{uuid.uuid4().hex[:16]}",
                    "user_id": user_id,
                    "type": "investment_payout",
                    "amount": payout,
                    "currency": inv.get("currency", "USD"),
                    "status": "completed",
                    "description": f"Выплата по инвестиции (пользователь удалён)",
                    "investment_id": inv["investment_id"],
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
            
            # Terminate investment
            await db.investments.update_one(
                {"investment_id": inv["investment_id"]},
                {"$set": {
                    "status": "terminated",
                    "terminated_at": datetime.now(timezone.utc).isoformat(),
                    "termination_reason": "user_deleted",
                    "with_payout": with_payout
                }}
            )
        
        await log_admin_action(admin["user_id"], "terminate_investments_batch", "user", user_id, {
            "count": active_count,
            "with_payout": with_payout
        })
    
    # Soft delete - mark as deleted
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "deleted": True,
            "deleted_at": datetime.now(timezone.utc).isoformat(),
            "deleted_by": admin["user_id"]
        }}
    )
    
    # Delete sessions
    await db.user_sessions.delete_many({"user_id": user_id})
    
    await log_admin_action(admin["user_id"], "delete_user", "user", user_id, {
        "email": user.get("email"),
        "name": user.get("name"),
        "terminated_investments": active_count,
        "with_payout": with_payout
    })
    
    return {
        "message": "User deleted", 
        "user_id": user_id,
        "terminated_investments": active_count,
        "with_payout": with_payout
    }


@router.post("/users/{user_id}/disable-2fa")
async def disable_user_2fa(user_id: str, request: Request):
    """Admin: Disable 2FA for a user (TOTP and/or Email)"""
    admin = await get_admin_user(request)
    data = await request.json()
    
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    method = data.get("method", "all")  # 'totp', 'email', or 'all'
    
    update_fields = {}
    unset_fields = {}
    
    if method in ["totp", "all"] and user.get("totp_enabled"):
        update_fields["totp_enabled"] = False
        unset_fields["totp_secret"] = ""
        unset_fields["totp_secret_pending"] = ""
    
    if method in ["email", "all"] and user.get("email_2fa_enabled"):
        update_fields["email_2fa_enabled"] = False
        unset_fields["email_2fa_setup_code"] = ""
        unset_fields["email_2fa_setup_expires"] = ""
        unset_fields["login_2fa_code"] = ""
        unset_fields["login_2fa_expires"] = ""
    
    if update_fields or unset_fields:
        update_query = {}
        if update_fields:
            update_query["$set"] = update_fields
        if unset_fields:
            update_query["$unset"] = unset_fields
        
        await db.users.update_one({"user_id": user_id}, update_query)
        
        await log_admin_action(admin["user_id"], "disable_2fa", "user", user_id, {
            "method": method,
            "email": user.get("email")
        })
        
        return {
            "message": "2FA disabled for user",
            "method": method,
            "totp_disabled": method in ["totp", "all"] and user.get("totp_enabled"),
            "email_2fa_disabled": method in ["email", "all"] and user.get("email_2fa_enabled")
        }
    
    return {"message": "No 2FA was enabled for this user"}


# ==================== INVESTMENT/CONTRACT MANAGEMENT ====================

@router.post("/investments/{investment_id}/terminate")
async def terminate_investment(investment_id: str, request: Request):
    """
    Admin: Terminate investment early
    - with_payout=True: Return principal + remaining unpaid profit to user's free balance
    - with_payout=False: Close contract without returning funds (for policy violations)
    
    Calculation:
    - total_expected_profit = investment.expected_return (full profit for the contract term)
    - already_paid_profit = sum of all 'income'/'profit' transactions for this investment
    - remaining_profit = total_expected_profit - already_paid_profit
    - payout = principal + remaining_profit (for non-auto_reinvest)
    - payout = current_balance (for auto_reinvest, as profit is already included)
    """
    admin = await get_admin_user(request)
    data = await request.json()
    
    with_payout = data.get("with_payout", True)
    reason = data.get("reason", "")
    
    # Get investment
    investment = await db.investments.find_one({"investment_id": investment_id}, {"_id": 0})
    if not investment:
        raise HTTPException(status_code=404, detail="Investment not found")
    
    if investment.get("status") != "active":
        raise HTTPException(status_code=400, detail="Investment is not active")
    
    user_id = investment["user_id"]
    amount = investment.get("amount", 0)  # Principal
    currency = investment.get("currency", "USD")
    expected_return = investment.get("expected_return", 0)  # Total expected profit
    
    # For auto_reinvest contracts, current_balance includes reinvested profits
    auto_reinvest = investment.get("auto_reinvest", False)
    current_balance = investment.get("current_balance", amount)
    
    # Calculate already paid profit from transactions
    profit_transactions = await db.transactions.find({
        "reference_id": investment_id,
        "type": {"$in": ["income", "profit"]},
        "status": "completed"
    }, {"_id": 0}).to_list(1000)
    
    already_paid_profit = sum(tx.get("amount", 0) for tx in profit_transactions)
    remaining_profit = max(0, expected_return - already_paid_profit)
    
    # Get portfolio name for notification
    portfolio = await db.portfolios.find_one({"portfolio_id": investment.get("portfolio_id")}, {"_id": 0})
    portfolio_name = portfolio.get("name", {}).get("ru", "Портфель") if portfolio else "Портфель"
    
    now = datetime.now(timezone.utc)
    
    if with_payout:
        if auto_reinvest:
            # For auto_reinvest: return current_balance (principal + all reinvested profits)
            return_amount = current_balance
        else:
            # For non-auto_reinvest: return principal + remaining unpaid profit
            return_amount = amount + remaining_profit
        
        # Update user balance
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        if user:
            # Add to available balance
            current_available = user.get("available_balance", {}).get(currency, 0)
            await db.users.update_one(
                {"user_id": user_id},
                {"$set": {f"available_balance.{currency}": current_available + return_amount}}
            )
            
            # Subtract from portfolio balance
            if auto_reinvest:
                current_portfolio = user.get("portfolio_balance", {}).get(currency, 0)
                await db.users.update_one(
                    {"user_id": user_id},
                    {"$set": {f"portfolio_balance.{currency}": max(0, current_portfolio - current_balance)}}
                )
        
        # Create transaction record
        tx_id = f"tx_{uuid.uuid4().hex[:12]}"
        await db.transactions.insert_one({
            "transaction_id": tx_id,
            "user_id": user_id,
            "type": "contract_termination",
            "amount": return_amount,
            "currency": currency,
            "status": "completed",
            "description": f"Досрочное завершение контракта «{portfolio_name}» с выплатой (основная сумма + оставшаяся прибыль)",
            "reference_id": investment_id,
            "created_at": now.isoformat()
        })
        
        # Send push notification
        try:
            from routers.notifications import send_push_to_user, NotificationPayload
            await send_push_to_user(user_id, NotificationPayload(
                title="Контракт завершён",
                body=f"Вам возвращено {return_amount:.2f} {currency}",
                url="/history"
            ))
        except Exception as e:
            print(f"Push notification failed: {e}")
    else:
        # Close without payout
        return_amount = 0
        
        # Still need to update portfolio_balance for accounting
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        if user and auto_reinvest:
            current_portfolio = user.get("portfolio_balance", {}).get(currency, 0)
            await db.users.update_one(
                {"user_id": user_id},
                {"$set": {f"portfolio_balance.{currency}": max(0, current_portfolio - current_balance)}}
            )
        
        tx_id = f"tx_{uuid.uuid4().hex[:12]}"
        await db.transactions.insert_one({
            "transaction_id": tx_id,
            "user_id": user_id,
            "type": "contract_termination",
            "amount": 0,
            "currency": currency,
            "status": "completed",
            "description": f"Досрочное завершение контракта «{portfolio_name}» без выплаты. Причина: {reason}",
            "reference_id": investment_id,
            "created_at": now.isoformat()
        })
        
        # Send push notification
        try:
            from routers.notifications import send_push_to_user, NotificationPayload
            await send_push_to_user(user_id, NotificationPayload(
                title="Контракт аннулирован",
                body="Ваш контракт был аннулирован администрацией",
                url="/history"
            ))
        except Exception as e:
            print(f"Push notification failed: {e}")
    
    # Update investment status
    await db.investments.update_one(
        {"investment_id": investment_id},
        {"$set": {
            "status": "terminated",
            "terminated_at": now.isoformat(),
            "terminated_by": admin["user_id"],
            "termination_type": "with_payout" if with_payout else "without_payout",
            "termination_reason": reason,
            "final_payout": return_amount
        }}
    )
    
    # Log admin action
    await log_admin_action(admin["user_id"], "terminate_investment", "investment", investment_id, {
        "with_payout": with_payout,
        "principal": amount,
        "expected_return": expected_return,
        "already_paid_profit": already_paid_profit,
        "remaining_profit": remaining_profit,
        "return_amount": return_amount,
        "auto_reinvest": auto_reinvest,
        "reason": reason
    })
    
    return {
        "message": f"Investment terminated {'with' if with_payout else 'without'} payout",
        "investment_id": investment_id,
        "principal": amount,
        "expected_return": expected_return,
        "already_paid_profit": already_paid_profit,
        "remaining_profit": remaining_profit,
        "returned_amount": return_amount,
        "auto_reinvest": auto_reinvest
    }


@router.get("/investments")
async def get_all_investments(request: Request):
    """Get all investments for admin"""
    await get_admin_user(request)
    
    investments = await db.investments.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    # Enrich with user info
    for inv in investments:
        user = await db.users.find_one({"user_id": inv.get("user_id")}, {"_id": 0, "name": 1, "email": 1})
        if user:
            inv["user_name"] = user.get("name", "Unknown")
            inv["user_email"] = user.get("email", "")
    
    return investments


# ==================== PORTFOLIOS MANAGEMENT ====================

@router.get("/portfolios")
async def get_all_portfolios(request: Request):
    """Get all portfolios including inactive"""
    await get_admin_user(request)
    portfolios = await db.portfolios.find({}, {"_id": 0}).to_list(100)
    return portfolios


@router.post("/portfolios")
async def create_portfolio(request: Request):
    """Create new portfolio"""
    admin = await get_admin_user(request)
    data = await request.json()
    
    portfolio_id = f"pf_{uuid.uuid4().hex[:12]}"
    portfolio_doc = {
        "portfolio_id": portfolio_id,
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
        **data
    }
    
    await db.portfolios.insert_one(portfolio_doc)
    
    await log_admin_action(admin["user_id"], "create_portfolio", "portfolio", portfolio_id, data)
    
    return {"message": "Portfolio created", "portfolio_id": portfolio_id}


@router.put("/portfolios/{portfolio_id}")
async def update_portfolio(portfolio_id: str, request: Request):
    """Update portfolio"""
    admin = await get_admin_user(request)
    data = await request.json()
    
    # Remove protected fields
    data.pop("portfolio_id", None)
    data.pop("created_at", None)
    data.pop("_id", None)
    
    result = await db.portfolios.update_one(
        {"portfolio_id": portfolio_id},
        {"$set": data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    await log_admin_action(admin["user_id"], "update_portfolio", "portfolio", portfolio_id, data)
    
    return {"message": "Portfolio updated", "portfolio_id": portfolio_id}


@router.put("/portfolios/{portfolio_id}/stats")
async def update_portfolio_stats(portfolio_id: str, request: Request):
    """Update portfolio display statistics (admin only)
    
    This updates the display stats shown on the portfolio card:
    - display_investor_count: Number of investors to display
    - display_total_invested: Total invested amount to display
    - display_total_profit: Total profit to display
    
    These are separate from actual calculated stats and are for marketing purposes.
    """
    admin = await get_admin_user(request)
    data = await request.json()
    
    # Validate portfolio exists
    portfolio = await db.portfolios.find_one({"portfolio_id": portfolio_id}, {"_id": 0})
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    # Only allow updating specific display fields
    allowed_fields = ["display_investor_count", "display_total_invested", "display_total_profit"]
    update_data = {k: v for k, v in data.items() if k in allowed_fields}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update. Allowed: display_investor_count, display_total_invested, display_total_profit")
    
    # Ensure values are numbers
    for key in update_data:
        try:
            update_data[key] = float(update_data[key])
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail=f"Field {key} must be a number")
    
    await db.portfolios.update_one(
        {"portfolio_id": portfolio_id},
        {"$set": update_data}
    )
    
    await log_admin_action(admin["user_id"], "update_portfolio_stats", "portfolio", portfolio_id, update_data)
    
    return {"message": "Portfolio stats updated", "portfolio_id": portfolio_id, "updated": update_data}


@router.delete("/portfolios/{portfolio_id}")
async def delete_portfolio(portfolio_id: str, request: Request, with_payout: bool = False, force: bool = False):
    """Delete portfolio (set status to inactive)
    
    Args:
        with_payout: If True, terminate investments with payout (principal + remaining profit)
        force: If True, terminate all active investments before deleting
    """
    admin = await get_admin_user(request)
    
    # Check for active investments
    active_investments = await db.investments.find({
        "portfolio_id": portfolio_id,
        "status": "active"
    }).to_list(1000)
    
    active_count = len(active_investments)
    
    if active_count > 0 and not force:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete portfolio with {active_count} active investments. Use force=true to terminate them."
        )
    
    # If force delete, terminate all active investments
    if active_count > 0 and force:
        for inv in active_investments:
            if with_payout:
                # Calculate payout: principal + remaining profit
                payout = inv.get("amount", 0) + inv.get("remaining_profit", inv.get("expected_return", 0))
                
                # Update user balance
                await db.users.update_one(
                    {"user_id": inv["user_id"]},
                    {"$inc": {"balance": payout}}
                )
                
                # Record transaction
                await db.transactions.insert_one({
                    "transaction_id": f"txn_{uuid.uuid4().hex[:16]}",
                    "user_id": inv["user_id"],
                    "type": "investment_payout",
                    "amount": payout,
                    "currency": inv.get("currency", "USD"),
                    "status": "completed",
                    "description": f"Выплата по инвестиции (портфель удалён)",
                    "investment_id": inv["investment_id"],
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
            
            # Terminate investment
            await db.investments.update_one(
                {"investment_id": inv["investment_id"]},
                {"$set": {
                    "status": "terminated",
                    "terminated_at": datetime.now(timezone.utc).isoformat(),
                    "termination_reason": "portfolio_deleted",
                    "with_payout": with_payout
                }}
            )
        
        await log_admin_action(admin["user_id"], "terminate_investments_batch", "portfolio", portfolio_id, {
            "count": active_count,
            "with_payout": with_payout
        })
    
    result = await db.portfolios.update_one(
        {"portfolio_id": portfolio_id},
        {"$set": {"status": "inactive"}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    await log_admin_action(admin["user_id"], "delete_portfolio", "portfolio", portfolio_id, {
        "terminated_investments": active_count,
        "with_payout": with_payout
    })
    
    return {
        "message": "Portfolio deleted", 
        "portfolio_id": portfolio_id,
        "terminated_investments": active_count,
        "with_payout": with_payout
    }


# ==================== KYC MANAGEMENT ====================

@router.get("/kyc/pending")
async def get_pending_kyc(request: Request):
    """Get all pending KYC documents"""
    await get_admin_user(request)
    docs = await db.kyc_documents.find({"status": "pending"}, {"_id": 0}).to_list(100)
    
    # Enrich with user email and name
    if docs:
        user_ids = list(set(doc.get("user_id") for doc in docs if doc.get("user_id")))
        users = await db.users.find(
            {"user_id": {"$in": user_ids}},
            {"_id": 0, "user_id": 1, "email": 1, "name": 1}
        ).to_list(None)
        user_map = {u["user_id"]: u for u in users}
        
        for doc in docs:
            user = user_map.get(doc.get("user_id"), {})
            doc["user_email"] = user.get("email", "")
            doc["user_name"] = user.get("name", "")
    
    return docs


@router.put("/kyc/{kyc_id}")
async def review_kyc(kyc_id: str, request: Request):
    """Approve or reject KYC document"""
    admin = await get_admin_user(request)
    body = await request.json()
    
    status = body.get("status")
    rejection_reason = body.get("rejection_reason")
    
    if status not in ["approved", "rejected"]:
        raise HTTPException(status_code=400, detail="Status must be approved or rejected")
    
    kyc_doc = await db.kyc_documents.find_one({"kyc_id": kyc_id}, {"_id": 0})
    if not kyc_doc:
        raise HTTPException(status_code=404, detail="KYC document not found")
    
    update_data = {
        "status": status,
        "reviewed_by": admin["user_id"],
        "reviewed_at": datetime.now(timezone.utc).isoformat()
    }
    
    if status == "rejected" and rejection_reason:
        update_data["rejection_reason"] = rejection_reason
    
    await db.kyc_documents.update_one(
        {"kyc_id": kyc_id},
        {"$set": update_data}
    )
    
    # If approved, check if all required documents are approved
    if status == "approved":
        user_docs = await db.kyc_documents.find(
            {"user_id": kyc_doc["user_id"]},
            {"_id": 0}
        ).to_list(10)
        
        doc_types = {d["document_type"]: d["status"] for d in user_docs}
        
        # If passport and address are both approved, update user KYC status
        if doc_types.get("passport") == "approved" and doc_types.get("address") == "approved":
            await db.users.update_one(
                {"user_id": kyc_doc["user_id"]},
                {"$set": {"kyc_status": "approved"}}
            )
    
    await log_admin_action(admin["user_id"], f"kyc_{status}", "kyc", kyc_id, {
        "user_id": kyc_doc["user_id"],
        "document_type": kyc_doc.get("document_type")
    })
    
    return {"message": f"KYC document {status}", "kyc_id": kyc_id}


# ==================== WITHDRAWALS MANAGEMENT ====================

@router.get("/withdrawals/pending")
async def get_pending_withdrawals(request: Request):
    """Get all pending withdrawal transactions"""
    await get_admin_user(request)
    withdrawals = await db.transactions.find(
        {"type": "withdrawal", "status": "pending"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return withdrawals


@router.put("/withdrawals/{transaction_id}")
async def process_withdrawal(transaction_id: str, request: Request):
    """Process withdrawal request"""
    admin = await get_admin_user(request)
    body = await request.json()
    
    status = body.get("status")
    
    if status not in ["completed", "failed"]:
        raise HTTPException(status_code=400, detail="Status must be completed or failed")
    
    tx = await db.transactions.find_one({"transaction_id": transaction_id}, {"_id": 0})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    await db.transactions.update_one(
        {"transaction_id": transaction_id},
        {"$set": {"status": status}}
    )
    
    # If completed, deduct from user balance
    if status == "completed":
        await db.users.update_one(
            {"user_id": tx["user_id"]},
            {"$inc": {f"available_balance.{tx['currency']}": -tx["amount"]}}
        )
    
    await log_admin_action(admin["user_id"], f"withdrawal_{status}", "transaction", transaction_id, {
        "user_id": tx["user_id"],
        "amount": tx["amount"],
        "currency": tx["currency"]
    })
    
    return {"message": f"Withdrawal {status}", "transaction_id": transaction_id}


# ==================== TICKETS MANAGEMENT ====================

@router.get("/tickets")
async def get_all_tickets(request: Request):
    """Get all support tickets"""
    await get_admin_user(request)
    tickets = await db.support_tickets.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Enrich with user email and name
    if tickets:
        user_ids = list(set(t.get("user_id") for t in tickets if t.get("user_id")))
        users = await db.users.find(
            {"user_id": {"$in": user_ids}},
            {"_id": 0, "user_id": 1, "email": 1, "name": 1}
        ).to_list(None)
        user_map = {u["user_id"]: u for u in users}
        
        for ticket in tickets:
            user = user_map.get(ticket.get("user_id"), {})
            ticket["user_email"] = user.get("email", "")
            ticket["user_name"] = user.get("name", "")
    
    return tickets


@router.put("/tickets/{ticket_id}")
async def update_ticket(ticket_id: str, request: Request):
    """Update ticket status"""
    admin = await get_admin_user(request)
    body = await request.json()
    
    update_data = {}
    if "status" in body:
        update_data["status"] = body["status"]
    if "priority" in body:
        update_data["priority"] = body["priority"]
    
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.support_tickets.update_one(
            {"ticket_id": ticket_id},
            {"$set": update_data}
        )
    
    return {"message": "Ticket updated", "ticket_id": ticket_id}


@router.post("/tickets/{ticket_id}/respond")
async def respond_to_ticket(ticket_id: str, request: Request):
    """Add admin response to ticket"""
    admin = await get_admin_user(request)
    body = await request.json()
    
    response = {
        "message": body.get("message", ""),
        "from": "admin",
        "admin_name": admin.get("name", "Admin"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.support_tickets.update_one(
        {"ticket_id": ticket_id},
        {
            "$push": {"responses": response},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    return {"message": "Response added"}


# ==================== AUDIT LOGS ====================

@router.get("/audit-logs")
async def get_audit_logs(request: Request):
    """Get audit logs"""
    await get_admin_user(request)
    logs = await db.audit_logs.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return logs


# ==================== ADMIN SETTINGS ====================

@router.get("/settings")
async def get_settings(request: Request):
    """Get admin settings"""
    await get_admin_user(request)
    
    settings = await db.admin_settings.find_one({"setting_id": "admin_settings"}, {"_id": 0})
    if not settings:
        settings = {
            "setting_id": "admin_settings",
            "email_enabled": False,
            "email_provider": "sendgrid",
            "company_name": "Phillip Capital Invest LLP",
            "brokers": []
        }
        await db.admin_settings.insert_one(settings)
    
    return settings


@router.put("/settings")
async def update_settings(request: Request):
    """Update admin settings"""
    admin = await get_admin_user(request)
    body = await request.json()
    
    body.pop("setting_id", None)
    body.pop("_id", None)
    
    await db.admin_settings.update_one(
        {"setting_id": "admin_settings"},
        {"$set": body},
        upsert=True
    )
    
    await log_admin_action(admin["user_id"], "update_settings", "settings", "admin_settings", {
        "updated_fields": list(body.keys())
    })
    
    return {"message": "Settings updated"}


@router.get("/email-debug")
async def email_debug(request: Request):
    """Debug email configuration - shows merged settings from ENV and DB"""
    await get_admin_user(request)
    
    from services.email_service import EmailService
    import os
    
    settings = await EmailService.get_settings()
    
    # Mask sensitive data
    debug_info = {
        "email_enabled": settings.get("email_enabled"),
        "email_provider": settings.get("email_provider"),
        "smtp_host": settings.get("smtp_host"),
        "smtp_port": settings.get("smtp_port"),
        "smtp_user": settings.get("smtp_user"),
        "smtp_password_set": bool(settings.get("smtp_password")),
        "email_from": settings.get("email_from"),
        "email_from_name": settings.get("email_from_name"),
        "sendgrid_key_set": bool(settings.get("sendgrid_api_key")),
        "env_vars": {
            "EMAIL_ENABLED": os.environ.get("EMAIL_ENABLED", "not set"),
            "EMAIL_PROVIDER": os.environ.get("EMAIL_PROVIDER", "not set"),
            "SMTP_HOST": os.environ.get("SMTP_HOST", "not set"),
            "SMTP_PORT": os.environ.get("SMTP_PORT", "not set"),
            "SMTP_USER": os.environ.get("SMTP_USER", "not set"),
            "SMTP_PASSWORD_SET": "yes" if os.environ.get("SMTP_PASSWORD") else "not set",
            "EMAIL_FROM": os.environ.get("EMAIL_FROM", "not set"),
        }
    }
    
    return debug_info


@router.post("/test-email")
async def test_email(request: Request):
    """Send test email to admin"""
    admin = await get_admin_user(request)
    
    from services.email_service import EmailService
    
    # Get admin's email
    admin_email = admin.get("email")
    if not admin_email:
        raise HTTPException(status_code=400, detail="Admin email not found")
    
    # Get merged settings (ENV + DB)
    settings = await EmailService.get_settings()
    
    if not settings.get("email_enabled"):
        raise HTTPException(status_code=400, detail="Email отключён в настройках")
    
    email_from = settings.get("email_from")
    if not email_from:
        raise HTTPException(status_code=400, detail="Не указан email отправителя")
    
    provider = settings.get("email_provider", "sendgrid")
    if provider == "sendgrid" and not settings.get("sendgrid_api_key"):
        raise HTTPException(status_code=400, detail="Не указан SendGrid API ключ")
    
    if provider == "smtp":
        smtp_host = settings.get("smtp_host")
        smtp_user = settings.get("smtp_user")
        smtp_pass = settings.get("smtp_password")
        if not all([smtp_host, smtp_user, smtp_pass]):
            raise HTTPException(status_code=400, detail=f"Не полностью настроен SMTP: host={bool(smtp_host)}, user={bool(smtp_user)}, pass={bool(smtp_pass)}")
    
    # Send test email
    test_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #064e3b; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0;">Phillip Capital Invest</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <h2 style="color: #064e3b;">✓ Тестовое письмо</h2>
            <p>Это тестовое письмо подтверждает, что настройки email работают корректно.</p>
            <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0;"><strong>Провайдер:</strong> {provider.upper()}</p>
                <p style="margin: 5px 0 0;"><strong>Отправитель:</strong> {email_from}</p>
                <p style="margin: 5px 0 0;"><strong>SMTP Host:</strong> {settings.get('smtp_host', 'N/A')}</p>
                <p style="margin: 5px 0 0;"><strong>SMTP Port:</strong> {settings.get('smtp_port', 'N/A')}</p>
            </div>
            <p style="color: #6b7280; font-size: 13px;">Отправлено из админ-панели Phillip Capital Invest</p>
        </div>
    </div>
    """
    
    success = await EmailService.send_email(
        to_email=admin_email,
        subject="✓ Тестовое письмо | Phillip Capital Invest",
        html_content=test_html,
        to_name=admin.get("name")
    )
    
    if success:
        return {"message": f"Тестовое письмо отправлено на {admin_email}"}
    else:
        raise HTTPException(status_code=500, detail="Не удалось отправить письмо. Проверьте настройки и логи.")


# ==================== BROKERS MANAGEMENT ====================

@router.get("/brokers")
async def get_brokers(request: Request):
    """Get all brokers"""
    await get_admin_user(request)
    settings = await db.admin_settings.find_one({"setting_id": "admin_settings"}, {"_id": 0})
    return settings.get("brokers", []) if settings else []


@router.post("/brokers")
async def create_broker(request: Request):
    """Create new broker"""
    admin = await get_admin_user(request)
    body = await request.json()
    
    broker_id = f"broker_{uuid.uuid4().hex[:8]}"
    broker = {
        "broker_id": broker_id,
        "name": body.get("name", ""),
        "account_template": body.get("account_template"),
        "instructions": body.get("instructions", {"ru": "", "en": ""}),
        "is_active": body.get("is_active", True)
    }
    
    await db.admin_settings.update_one(
        {"setting_id": "admin_settings"},
        {"$push": {"brokers": broker}},
        upsert=True
    )
    
    return {"message": "Broker created", "broker_id": broker_id}


@router.put("/brokers/{broker_id}")
async def update_broker(broker_id: str, request: Request):
    """Update broker"""
    admin = await get_admin_user(request)
    body = await request.json()
    
    settings = await db.admin_settings.find_one({"setting_id": "admin_settings"}, {"_id": 0})
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")
    
    brokers = settings.get("brokers", [])
    updated = False
    
    for i, broker in enumerate(brokers):
        if broker.get("broker_id") == broker_id:
            brokers[i] = {**broker, **body, "broker_id": broker_id}
            updated = True
            break
    
    if not updated:
        raise HTTPException(status_code=404, detail="Broker not found")
    
    await db.admin_settings.update_one(
        {"setting_id": "admin_settings"},
        {"$set": {"brokers": brokers}}
    )
    
    return {"message": "Broker updated"}


@router.delete("/brokers/{broker_id}")
async def delete_broker(broker_id: str, request: Request):
    """Delete broker"""
    admin = await get_admin_user(request)
    
    await db.admin_settings.update_one(
        {"setting_id": "admin_settings"},
        {"$pull": {"brokers": {"broker_id": broker_id}}}
    )
    
    return {"message": "Broker deleted"}


# ==================== DEPOSIT/WITHDRAWAL REQUESTS ====================

@router.get("/deposit-requests")
async def get_deposit_requests(request: Request):
    """Get all deposit requests with user info"""
    await get_admin_user(request)
    requests = await db.deposit_requests.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Enrich with user info
    for req in requests:
        user = await db.users.find_one({"user_id": req.get("user_id")}, {"_id": 0, "name": 1, "email": 1})
        if user:
            req["user_name"] = user.get("name", "")
            req["user_email"] = user.get("email", "")
    
    return requests


@router.put("/deposit-requests/{request_id}")
async def process_deposit_request(request_id: str, request: Request):
    """Process deposit request"""
    admin = await get_admin_user(request)
    body = await request.json()
    
    status = body.get("status")
    admin_notes = body.get("admin_notes")
    
    if status not in ["approved", "rejected"]:
        raise HTTPException(status_code=400, detail="Status must be approved or rejected")
    
    dep_request = await db.deposit_requests.find_one({"request_id": request_id}, {"_id": 0})
    if not dep_request:
        raise HTTPException(status_code=404, detail="Deposit request not found")
    
    update_data = {
        "status": status,
        "approved_by": admin["user_id"],
        "approved_at": datetime.now(timezone.utc).isoformat()
    }
    if admin_notes:
        update_data["admin_notes"] = admin_notes
    
    await db.deposit_requests.update_one(
        {"request_id": request_id},
        {"$set": update_data}
    )
    
    # If approved, add to user balance
    if status == "approved":
        user = await db.users.find_one({"user_id": dep_request["user_id"]}, {"_id": 0})
        if user:
            currency = dep_request.get("currency", "USD")
            amount = dep_request.get("amount", 0)
            
            await db.users.update_one(
                {"user_id": user["user_id"]},
                {"$inc": {f"available_balance.{currency}": amount}}
            )
            
            # Create transaction record
            tx_id = f"tx_{uuid.uuid4().hex[:12]}"
            await db.transactions.insert_one({
                "transaction_id": tx_id,
                "user_id": user["user_id"],
                "type": "deposit",
                "amount": amount,
                "currency": currency,
                "status": "completed",
                "description": "Deposit approved by admin",
                "reference_id": request_id,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            
            # Send push notification
            try:
                from routers.notifications import notify_deposit_approved
                await notify_deposit_approved(user["user_id"], amount, currency)
            except Exception as notify_err:
                print(f"Push notification failed: {notify_err}")
    
    await log_admin_action(admin["user_id"], f"deposit_{status}", "deposit_request", request_id, {
        "user_id": dep_request["user_id"],
        "amount": dep_request.get("amount"),
        "currency": dep_request.get("currency")
    })
    
    return {"message": f"Deposit request {status}", "request_id": request_id}


@router.get("/withdrawal-requests")
async def get_withdrawal_requests(request: Request):
    """Get all withdrawal requests with user info"""
    await get_admin_user(request)
    requests = await db.withdrawal_requests.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Enrich with user info
    for req in requests:
        user = await db.users.find_one({"user_id": req.get("user_id")}, {"_id": 0, "name": 1, "email": 1})
        if user:
            req["user_name"] = user.get("name", "")
            req["user_email"] = user.get("email", "")
    
    return requests


@router.put("/withdrawal-requests/{request_id}")
async def process_withdrawal_request(request_id: str, request: Request):
    """Process withdrawal request"""
    admin = await get_admin_user(request)
    body = await request.json()
    
    status = body.get("status")
    admin_notes = body.get("admin_notes")
    
    if status not in ["approved", "rejected"]:
        raise HTTPException(status_code=400, detail="Status must be approved or rejected")
    
    wd_request = await db.withdrawal_requests.find_one({"request_id": request_id}, {"_id": 0})
    if not wd_request:
        raise HTTPException(status_code=404, detail="Withdrawal request not found")
    
    update_data = {
        "status": status,
        "approved_by": admin["user_id"],
        "approved_at": datetime.now(timezone.utc).isoformat()
    }
    if admin_notes:
        update_data["admin_notes"] = admin_notes
    
    await db.withdrawal_requests.update_one(
        {"request_id": request_id},
        {"$set": update_data}
    )
    
    # If approved, deduct from user balance
    if status == "approved":
        user = await db.users.find_one({"user_id": wd_request["user_id"]}, {"_id": 0})
        if user:
            currency = wd_request.get("currency", "USD")
            amount = wd_request.get("amount", 0)
            
            await db.users.update_one(
                {"user_id": user["user_id"]},
                {"$inc": {f"available_balance.{currency}": -amount}}
            )
            
            # Create transaction record
            tx_id = f"tx_{uuid.uuid4().hex[:12]}"
            await db.transactions.insert_one({
                "transaction_id": tx_id,
                "user_id": user["user_id"],
                "type": "withdrawal",
                "amount": amount,
                "currency": currency,
                "status": "completed",
                "description": f"Withdrawal to {wd_request.get('broker_name', 'broker')}",
                "reference_id": request_id,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            
            # Send push notification
            try:
                from routers.notifications import notify_withdrawal_processed
                await notify_withdrawal_processed(user["user_id"], amount, currency, status)
            except Exception as notify_err:
                print(f"Push notification failed: {notify_err}")
    
    # Send notification for rejected withdrawal
    if status == "rejected":
        user = await db.users.find_one({"user_id": wd_request["user_id"]}, {"_id": 0})
        if user:
            try:
                from routers.notifications import notify_withdrawal_processed
                await notify_withdrawal_processed(
                    user["user_id"], 
                    wd_request.get("amount", 0), 
                    wd_request.get("currency", "USD"), 
                    status
                )
            except Exception as notify_err:
                print(f"Push notification failed: {notify_err}")
    
    await log_admin_action(admin["user_id"], f"withdrawal_{status}", "withdrawal_request", request_id, {
        "user_id": wd_request["user_id"],
        "amount": wd_request.get("amount"),
        "currency": wd_request.get("currency")
    })
    
    return {"message": f"Withdrawal request {status}", "request_id": request_id}


# ==================== EMAIL MANAGEMENT ====================

@router.get("/email/templates")
async def get_email_templates(request: Request):
    """Get all email templates"""
    await get_admin_user(request)
    templates = await db.email_templates.find({}, {"_id": 0}).to_list(100)
    return templates


@router.post("/email/templates")
async def create_email_template(request: Request):
    """Create new email template"""
    admin = await get_admin_user(request)
    body = await request.json()
    
    template_id = f"etmpl_{uuid.uuid4().hex[:12]}"
    template = {
        "template_id": template_id,
        "name": body.get("name", ""),
        "subject": body.get("subject", {"ru": "", "en": ""}),
        "content": body.get("content", {"ru": "", "en": ""}),
        "is_active": body.get("is_active", True),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.email_templates.insert_one(template)
    
    return {"message": "Template created", "template_id": template_id}


@router.put("/email/templates/{template_id}")
async def update_email_template(template_id: str, request: Request):
    """Update email template"""
    admin = await get_admin_user(request)
    body = await request.json()
    
    body.pop("template_id", None)
    body.pop("created_at", None)
    body.pop("_id", None)
    
    result = await db.email_templates.update_one(
        {"template_id": template_id},
        {"$set": body}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    
    return {"message": "Template updated"}


@router.delete("/email/templates/{template_id}")
async def delete_email_template(template_id: str, request: Request):
    """Delete email template"""
    admin = await get_admin_user(request)
    
    result = await db.email_templates.delete_one({"template_id": template_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    
    return {"message": "Template deleted"}


@router.get("/email/campaigns")
async def get_email_campaigns(request: Request):
    """Get all email campaigns"""
    await get_admin_user(request)
    campaigns = await db.email_campaigns.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return campaigns


@router.post("/email/campaigns")
async def create_email_campaign(request: Request):
    """Create new email campaign"""
    admin = await get_admin_user(request)
    body = await request.json()
    
    campaign_id = f"camp_{uuid.uuid4().hex[:12]}"
    campaign = {
        "campaign_id": campaign_id,
        "subject": body.get("subject", {"ru": "", "en": ""}),
        "content": body.get("content", {"ru": "", "en": ""}),
        "filters": body.get("filters", {}),
        "status": "draft",
        "recipients_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.email_campaigns.insert_one(campaign)
    
    return {"message": "Campaign created", "campaign_id": campaign_id}


# ==================== SITE DOCUMENTS MANAGEMENT ====================

@router.get("/site-documents")
async def get_site_documents(request: Request):
    """Get all site documents (PDFs)"""
    await get_admin_user(request)
    docs = await db.site_documents.find({}, {"_id": 0}).to_list(100)
    return docs


@router.post("/site-documents")
async def upload_site_document(request: Request):
    """Upload or update a site document"""
    admin = await get_admin_user(request)
    body = await request.json()
    
    doc_type = body.get("doc_type")  # legal_info, privacy_policy, disclosure, fees
    file_url = body.get("file_url")
    title = body.get("title", {})
    
    if not doc_type or not file_url:
        raise HTTPException(status_code=400, detail="doc_type and file_url are required")
    
    valid_types = ["legal_info", "privacy_policy", "disclosure", "fees"]
    if doc_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid doc_type. Must be one of: {valid_types}")
    
    doc = {
        "doc_type": doc_type,
        "file_url": file_url,
        "title": title,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": admin["user_id"]
    }
    
    await db.site_documents.update_one(
        {"doc_type": doc_type},
        {"$set": doc},
        upsert=True
    )
    
    await log_admin_action(admin["user_id"], "update_site_document", "site_document", doc_type, {
        "file_url": file_url
    })
    
    return {"message": "Document updated", "doc_type": doc_type}


@router.delete("/site-documents/{doc_type}")
async def delete_site_document(doc_type: str, request: Request):
    """Delete a site document"""
    admin = await get_admin_user(request)
    
    result = await db.site_documents.delete_one({"doc_type": doc_type})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    
    await log_admin_action(admin["user_id"], "delete_site_document", "site_document", doc_type, {})
    
    return {"message": "Document deleted"}


# ==================== CONTACT INFO MANAGEMENT ====================

@router.get("/contact-info")
async def get_contact_info(request: Request):
    """Get site contact information"""
    await get_admin_user(request)
    
    contact = await db.site_settings.find_one({"setting_id": "contact_info"}, {"_id": 0})
    if not contact:
        contact = {
            "setting_id": "contact_info",
            "phone": "+90 (212) 000-00-00",
            "phone_hours": {"ru": "Пн-Пт: 9:00 - 18:00", "en": "Mon-Fri: 9:00 AM - 6:00 PM", "tr": "Pzt-Cum: 09:00 - 18:00"},
            "email": "info@phillipcapitalinvest.com",
            "address": {
                "ru": "Стамбул, Левент, Финансовый район, Tower A, 34330",
                "en": "Istanbul, Levent Finance District, Tower A, 34330",
                "tr": "İstanbul, Levent Finans Bölgesi, Tower A, 34330"
            }
        }
        await db.site_settings.insert_one(contact)
    
    return contact


@router.put("/contact-info")
async def update_contact_info(request: Request):
    """Update site contact information"""
    admin = await get_admin_user(request)
    body = await request.json()
    
    body.pop("setting_id", None)
    body.pop("_id", None)
    
    await db.site_settings.update_one(
        {"setting_id": "contact_info"},
        {"$set": body},
        upsert=True
    )
    
    await log_admin_action(admin["user_id"], "update_contact_info", "site_settings", "contact_info", {
        "updated_fields": list(body.keys())
    })
    
    return {"message": "Contact info updated"}
