"""
Investments router for Phillip Capital Invest
"""
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse
import io
import base64

from database import db
from models import Investment, InvestmentCreate, Transaction

router = APIRouter(prefix="/investments", tags=["investments"])


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


def calculate_tier(total_invested: float) -> str:
    """Calculate user tier based on total invested"""
    if total_invested >= 100000:
        return "platinum"
    elif total_invested >= 50000:
        return "gold"
    return "silver"


@router.get("")
async def get_investments(request: Request):
    """Get user investments with remaining profit info"""
    user = await get_current_user(request)
    investments = await db.investments.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    if not investments:
        return investments
    
    # Get portfolio names and duration_unit
    portfolio_ids = list(set(inv.get("portfolio_id") for inv in investments if inv.get("portfolio_id")))
    portfolios = await db.portfolios.find(
        {"portfolio_id": {"$in": portfolio_ids}},
        {"_id": 0, "portfolio_id": 1, "name": 1, "duration_unit": 1}
    ).to_list(None)
    portfolio_map = {p["portfolio_id"]: p for p in portfolios}
    
    # Batch query: Get all investment IDs and fetch profit transactions in one query
    investment_ids = [inv.get("investment_id") for inv in investments]
    
    # Use aggregation to sum paid profits per investment
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
    
    # Enrich investments with paid and remaining profit + portfolio name
    for inv in investments:
        investment_id = inv.get("investment_id")
        paid_profit = paid_by_investment.get(investment_id, 0)
        expected_return = inv.get("expected_return", 0)
        remaining_profit = max(0, expected_return - paid_profit)
        
        inv["paid_profit"] = paid_profit
        inv["remaining_profit"] = remaining_profit
        
        # Calculate current balance
        # For auto_reinvest: use current_balance (includes reinvested profits)
        # For non-auto_reinvest: principal + paid_profit
        if inv.get("auto_reinvest"):
            inv["current_balance"] = inv.get("current_balance", inv.get("amount", 0))
            inv["accrued_profit"] = inv.get("accrued_profit", 0)
        else:
            inv["current_balance"] = inv.get("amount", 0) + paid_profit
            inv["accrued_profit"] = paid_profit
        
        # Add portfolio name and duration_unit
        portfolio_data = portfolio_map.get(inv.get("portfolio_id"), {})
        portfolio_name_obj = portfolio_data.get("name", {})
        inv["portfolio_name"] = portfolio_name_obj.get("ru", portfolio_name_obj.get("en", inv.get("portfolio_id", "")))
        inv["duration_unit"] = portfolio_data.get("duration_unit", "months")
    
    return investments


@router.post("")
async def create_investment(request: Request, data: InvestmentCreate):
    """Create new investment"""
    user = await get_current_user(request)
    
    # Check KYC/phone verification (unless admin allowed without KYC)
    if not user.get("can_invest_without_kyc", False):
        if user.get("kyc_status", "none") != "approved":
            raise HTTPException(
                status_code=403, 
                detail="Для инвестирования необходимо пройти верификацию (KYC)"
            )
        if not user.get("phone_verified", False):
            raise HTTPException(
                status_code=403, 
                detail="Для инвестирования необходимо подтвердить номер телефона"
            )
    
    if not data.terms_accepted:
        raise HTTPException(status_code=400, detail="Terms must be accepted")
    
    portfolio = await db.portfolios.find_one({"portfolio_id": data.portfolio_id}, {"_id": 0})
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    if data.amount < portfolio["min_investment"] or data.amount > portfolio["max_investment"]:
        raise HTTPException(status_code=400, detail="Invalid investment amount")
    
    if data.duration_months not in portfolio["duration_months"]:
        raise HTTPException(status_code=400, detail="Invalid duration")
    
    # Check balance
    current_balance = user.get("available_balance", {}).get(data.currency, 0)
    if current_balance < data.amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    # Calculate expected return
    # Note: return_rate is for the FULL TERM (not annual)
    # E.g., 25% for 10 days means 25% total profit over the entire 10-day period
    returns_by_term = portfolio.get("returns_by_term", {})
    term_key = str(data.duration_months)
    return_rate = returns_by_term.get(term_key, portfolio["expected_return"])
    
    # Get duration unit and accrual interval for compound calculation
    duration_unit = portfolio.get("duration_unit", "months")
    accrual_interval = portfolio.get("profit_accrual_interval", "monthly")
    
    if data.auto_reinvest:
        # Compound interest calculation
        # Calculate total accrual periods based on duration_unit and accrual_interval
        duration_value = data.duration_months
        
        if duration_unit == "days":
            if accrual_interval == "hourly":
                total_periods = duration_value * 24
            elif accrual_interval == "daily":
                total_periods = duration_value
            elif accrual_interval == "weekly":
                total_periods = max(1, duration_value // 7)
            elif accrual_interval == "monthly":
                total_periods = max(1, duration_value // 30)
            else:
                total_periods = max(1, duration_value // 365)
        elif duration_unit == "hours":
            if accrual_interval == "hourly":
                total_periods = duration_value
            elif accrual_interval == "daily":
                total_periods = max(1, duration_value // 24)
            else:
                total_periods = max(1, duration_value // 720)
        elif duration_unit == "years":
            if accrual_interval == "hourly":
                total_periods = duration_value * 8760
            elif accrual_interval == "daily":
                total_periods = duration_value * 365
            elif accrual_interval == "weekly":
                total_periods = duration_value * 52
            elif accrual_interval == "monthly":
                total_periods = duration_value * 12
            else:
                total_periods = duration_value
        else:
            # months
            if accrual_interval == "hourly":
                total_periods = duration_value * 720
            elif accrual_interval == "daily":
                total_periods = duration_value * 30
            elif accrual_interval == "weekly":
                total_periods = duration_value * 4
            elif accrual_interval == "monthly":
                total_periods = duration_value
            else:
                total_periods = max(1, duration_value // 12)
        
        total_periods = max(1, total_periods)
        
        # Per-period rate
        period_rate = return_rate / total_periods / 100
        
        # Compound formula: A = P * (1 + r)^n
        final_amount = data.amount * ((1 + period_rate) ** total_periods)
        expected_return = final_amount - data.amount
    else:
        # Simple interest: expected_return = amount * (term_rate / 100)
        expected_return = data.amount * (return_rate / 100)
    
    # Calculate end date based on duration unit
    if duration_unit == "days":
        end_date = datetime.now(timezone.utc) + timedelta(days=data.duration_months)
    elif duration_unit == "hours":
        end_date = datetime.now(timezone.utc) + timedelta(hours=data.duration_months)
    elif duration_unit == "years":
        end_date = datetime.now(timezone.utc) + timedelta(days=data.duration_months * 365)
    else:
        # Default: months
        end_date = datetime.now(timezone.utc) + timedelta(days=data.duration_months * 30)
    
    # Create investment
    investment = Investment(
        user_id=user["user_id"],
        portfolio_id=data.portfolio_id,
        amount=data.amount,
        current_balance=data.amount,
        currency=data.currency,
        duration_months=data.duration_months,
        expected_return=expected_return,
        end_date=end_date,
        auto_reinvest=data.auto_reinvest,
        signature=data.signature,
        signature_type=data.signature_type,
        last_accrual_date=datetime.now(timezone.utc)
    )
    
    inv_doc = investment.model_dump()
    inv_doc['start_date'] = inv_doc['start_date'].isoformat()
    inv_doc['end_date'] = inv_doc['end_date'].isoformat()
    inv_doc['created_at'] = inv_doc['created_at'].isoformat()
    if inv_doc.get('last_accrual_date'):
        inv_doc['last_accrual_date'] = inv_doc['last_accrual_date'].isoformat()
    
    await db.investments.insert_one(inv_doc)
    
    # Update user balances
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {
            "$inc": {
                f"available_balance.{data.currency}": -data.amount,
                f"portfolio_balance.{data.currency}": data.amount,
                "total_invested": data.amount
            }
        }
    )
    
    # Update tier
    updated_user = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    new_tier = calculate_tier(updated_user.get("total_invested", 0))
    if new_tier != updated_user.get("tier"):
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": {"tier": new_tier}}
        )
    
    # Create transaction record with portfolio name
    portfolio_name_for_tx = portfolio['name'].get('ru', portfolio['name'].get('en', 'Портфель'))
    tx = Transaction(
        user_id=user["user_id"],
        type="investment",
        amount=data.amount,
        currency=data.currency,
        status="completed",
        description=f"Инвестиция в «{portfolio_name_for_tx}»",
        reference_id=investment.investment_id
    )
    tx_doc = tx.model_dump()
    tx_doc['created_at'] = tx_doc['created_at'].isoformat()
    await db.transactions.insert_one(tx_doc)
    
    # Send push notification
    try:
        from routers.notifications import notify_contract_signed
        portfolio_name = portfolio['name'].get('ru', portfolio['name'].get('en', 'Портфель'))
        await notify_contract_signed(user["user_id"], portfolio_name, data.amount, data.currency)
    except Exception as notify_err:
        print(f"Push notification failed: {notify_err}")
    
    # Send contract email with PDF attachment
    try:
        from services.email_service import EmailService
        from services.contract_generator import generate_contract_pdf
        
        # Get support email from site settings
        site_settings = await db.site_settings.find_one({"setting_id": "contact_info"}, {"_id": 0})
        support_email = "support@altyncontrac.help"
        if site_settings and site_settings.get("email"):
            support_email = site_settings.get("email")
        
        # Get duration label based on portfolio's duration_unit
        if duration_unit == 'hours':
            duration_label = f"{data.duration_months} ч."
        elif duration_unit == 'days':
            duration_label = f"{data.duration_months} дн."
        elif duration_unit == 'years':
            duration_label = f"{data.duration_months} г."
        else:
            duration_label = f"{data.duration_months} мес."
        
        # Determine if compound interest
        interest_note = " (сложный %)" if data.auto_reinvest else ""
        
        contract_email_html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #064e3b; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 24px;">Phillip Capital Invest</h1>
            </div>
            <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
                <h2 style="color: #064e3b; margin-top: 0;">Контракт успешно оформлен ✓</h2>
                <p>Уважаемый(ая) <strong>{user.get('name', user.get('email', 'Клиент'))}</strong>,</p>
                <p>Ваш инвестиционный контракт успешно подписан и вступил в силу.</p>
                
                <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin: 20px 0;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;"><strong>Номер контракта</strong></td>
                            <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">{investment.investment_id}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;"><strong>Портфель</strong></td>
                            <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">{portfolio['name'].get('ru', portfolio['name'].get('en', 'Portfolio'))}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;"><strong>Сумма инвестиции</strong></td>
                            <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold;">{data.amount:,.2f} {data.currency}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;"><strong>Срок</strong></td>
                            <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">{duration_label}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;"><strong>Ставка за срок</strong></td>
                            <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">{return_rate}%</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0;"><strong>Ожидаемая прибыль{interest_note}</strong></td>
                            <td style="padding: 10px 0; text-align: right; color: #059669; font-weight: bold; font-size: 18px;">+{expected_return:,.2f} {data.currency}</td>
                        </tr>
                    </table>
                </div>
                
                <p style="background: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b;">
                    📎 <strong>PDF-версия контракта прикреплена к этому письму.</strong>
                </p>
                
                <p>Дата окончания контракта: <strong>{end_date.strftime('%d.%m.%Y')}</strong></p>
                
                <p style="color: #6b7280; font-size: 13px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    С уважением,<br>
                    <strong>Команда Phillip Capital Invest</strong><br>
                    {support_email}
                </p>
            </div>
        </div>
        """
        
        # Generate PDF contract
        pdf_attachment = None
        try:
            pdf_bytes = await generate_contract_pdf(investment.investment_id, user["user_id"])
            if pdf_bytes:
                pdf_attachment = [{
                    "filename": f"contract_{investment.investment_id}.pdf",
                    "content": base64.b64encode(pdf_bytes).decode('utf-8'),
                    "type": "application/pdf"
                }]
        except Exception as pdf_err:
            print(f"PDF generation failed: {pdf_err}")
        
        await EmailService.send_email(
            to_email=user['email'],
            subject=f"✓ Контракт #{investment.investment_id} успешно оформлен | Phillip Capital Invest",
            html_content=contract_email_html,
            to_name=user.get('name'),
            attachments=pdf_attachment
        )
    except Exception as email_err:
        print(f"Contract email failed: {email_err}")
    
    return {"investment_id": investment.investment_id, "message": "Investment created successfully"}


@router.get("/{investment_id}")
async def get_investment(investment_id: str, request: Request):
    """Get single investment details"""
    user = await get_current_user(request)
    
    investment = await db.investments.find_one(
        {"investment_id": investment_id, "user_id": user["user_id"]},
        {"_id": 0}
    )
    
    if not investment:
        raise HTTPException(status_code=404, detail="Investment not found")
    
    return investment
