"""
Portfolios router for AltynContract
"""
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Request, HTTPException, Query
import uuid

from database import db
from models import Portfolio, PortfolioCreate

router = APIRouter(prefix="/portfolios", tags=["portfolios"])


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
        return None
    
    session = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session:
        return None
    
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    return user


async def require_admin(request: Request) -> dict:
    """Require admin user"""
    user = await get_current_user(request)
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


@router.get("")
async def get_portfolios(
    featured: Optional[bool] = Query(None),
    status: Optional[str] = Query(None)
):
    """Get all portfolios, optionally filtered"""
    query = {}
    
    if featured is not None:
        query["featured_on_landing"] = featured
    
    if status:
        query["status"] = status
    else:
        query["status"] = "active"
    
    portfolios = await db.portfolios.find(query, {"_id": 0}).to_list(100)
    
    # Sort featured portfolios by landing_order
    if featured:
        portfolios.sort(key=lambda x: x.get("landing_order", 0))
    
    return portfolios


@router.get("/featured")
async def get_featured_portfolios():
    """Get featured portfolios for landing page"""
    portfolios = await db.portfolios.find(
        {"featured_on_landing": True, "status": "active"}, 
        {"_id": 0}
    ).to_list(10)
    portfolios.sort(key=lambda x: x.get("landing_order", 0))
    return portfolios


@router.get("/{portfolio_id}")
async def get_portfolio(portfolio_id: str):
    """Get single portfolio by ID"""
    portfolio = await db.portfolios.find_one({"portfolio_id": portfolio_id}, {"_id": 0})
    
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    return portfolio


@router.get("/{portfolio_id}/stats")
async def get_portfolio_stats(portfolio_id: str):
    """Get portfolio statistics
    
    Returns both actual calculated stats and display stats (if set).
    Display stats are used for marketing and can be manually edited by admin.
    """
    portfolio = await db.portfolios.find_one({"portfolio_id": portfolio_id}, {"_id": 0})
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    # Count active investments
    active_investments = await db.investments.count_documents({
        "portfolio_id": portfolio_id,
        "status": "active"
    })
    
    # Count unique investors
    pipeline = [
        {"$match": {"portfolio_id": portfolio_id}},
        {"$group": {"_id": "$user_id"}},
        {"$count": "count"}
    ]
    result = await db.investments.aggregate(pipeline).to_list(1)
    actual_investor_count = result[0]["count"] if result else 0
    
    # Total invested amount
    pipeline = [
        {"$match": {"portfolio_id": portfolio_id, "status": "active"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    result = await db.investments.aggregate(pipeline).to_list(1)
    actual_total_invested = result[0]["total"] if result else 0
    
    # Total profit paid out
    pipeline = [
        {"$match": {"portfolio_id": portfolio_id}},
        {"$lookup": {
            "from": "transactions",
            "localField": "investment_id",
            "foreignField": "reference_id",
            "as": "txs"
        }},
        {"$unwind": {"path": "$txs", "preserveNullAndEmptyArrays": True}},
        {"$match": {"txs.type": {"$in": ["income", "profit"]}, "txs.status": "completed"}},
        {"$group": {"_id": None, "total": {"$sum": "$txs.amount"}}}
    ]
    result = await db.investments.aggregate(pipeline).to_list(1)
    actual_total_profit = result[0]["total"] if result else 0
    
    # Use display values if set, otherwise use actual values
    return {
        "portfolio_id": portfolio_id,
        "active_investments": active_investments,
        "investor_count": portfolio.get("display_investor_count", actual_investor_count),
        "total_invested": portfolio.get("display_total_invested", actual_total_invested),
        "total_profit": portfolio.get("display_total_profit", actual_total_profit),
        # Also return actual values for admin reference
        "actual_investor_count": actual_investor_count,
        "actual_total_invested": actual_total_invested,
        "actual_total_profit": actual_total_profit
    }


@router.post("")
async def create_portfolio(request: Request, data: PortfolioCreate):
    """Create new portfolio (admin only)"""
    await require_admin(request)
    
    portfolio = Portfolio(**data.model_dump())
    portfolio_doc = portfolio.model_dump()
    portfolio_doc['created_at'] = portfolio_doc['created_at'].isoformat()
    
    await db.portfolios.insert_one(portfolio_doc)
    
    return {"message": "Portfolio created", "portfolio_id": portfolio.portfolio_id}


@router.put("/{portfolio_id}")
async def update_portfolio(portfolio_id: str, request: Request):
    """Update portfolio (admin only)"""
    await require_admin(request)
    
    data = await request.json()
    
    # Remove fields that shouldn't be updated directly
    data.pop("portfolio_id", None)
    data.pop("created_at", None)
    data.pop("_id", None)
    
    result = await db.portfolios.update_one(
        {"portfolio_id": portfolio_id},
        {"$set": data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    return {"message": "Portfolio updated", "portfolio_id": portfolio_id}


@router.delete("/{portfolio_id}")
async def delete_portfolio(portfolio_id: str, request: Request):
    """Delete portfolio (admin only) - actually sets status to inactive"""
    await require_admin(request)
    
    # Check if there are active investments
    active_count = await db.investments.count_documents({
        "portfolio_id": portfolio_id,
        "status": "active"
    })
    
    if active_count > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot delete portfolio with {active_count} active investments"
        )
    
    result = await db.portfolios.update_one(
        {"portfolio_id": portfolio_id},
        {"$set": {"status": "inactive"}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    return {"message": "Portfolio deleted", "portfolio_id": portfolio_id}


@router.post("/{portfolio_id}/featured")
async def toggle_featured(portfolio_id: str, request: Request):
    """Toggle portfolio featured status (admin only)"""
    await require_admin(request)
    
    data = await request.json()
    featured = data.get("featured", False)
    landing_order = data.get("landing_order", 0)
    
    # If enabling featured, check if already 3 featured
    if featured:
        featured_count = await db.portfolios.count_documents({"featured_on_landing": True})
        current = await db.portfolios.find_one({"portfolio_id": portfolio_id}, {"_id": 0})
        if featured_count >= 3 and not current.get("featured_on_landing"):
            raise HTTPException(status_code=400, detail="Maximum 3 portfolios can be featured")
    
    await db.portfolios.update_one(
        {"portfolio_id": portfolio_id},
        {"$set": {"featured_on_landing": featured, "landing_order": landing_order}}
    )
    
    return {"message": "Featured status updated", "portfolio_id": portfolio_id, "featured": featured}


@router.post("/{portfolio_id}/news")
async def add_portfolio_news(portfolio_id: str, request: Request):
    """Add news to portfolio (admin only)"""
    await require_admin(request)
    
    data = await request.json()
    
    news_item = {
        "news_id": f"news_{uuid.uuid4().hex[:8]}",
        "title": data.get("title", {"ru": "", "kz": "", "en": ""}),
        "content": data.get("content", {"ru": "", "kz": "", "en": ""}),
        "published_at": datetime.now(timezone.utc).isoformat(),
        "source": data.get("source")
    }
    
    await db.portfolios.update_one(
        {"portfolio_id": portfolio_id},
        {"$push": {"news": {"$each": [news_item], "$position": 0}}}
    )
    
    return {"message": "News added", "news_id": news_item["news_id"]}


@router.delete("/{portfolio_id}/news/{news_id}")
async def delete_portfolio_news(portfolio_id: str, news_id: str, request: Request):
    """Delete news from portfolio (admin only)"""
    await require_admin(request)
    
    await db.portfolios.update_one(
        {"portfolio_id": portfolio_id},
        {"$pull": {"news": {"news_id": news_id}}}
    )
    
    return {"message": "News deleted"}
