"""
Support router for AltynContract - Tickets and help
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Request, HTTPException

from database import db
from models import SupportTicket, TicketCreate, TicketResponse

router = APIRouter(prefix="/support", tags=["support"])


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


@router.get("/tickets")
async def get_user_tickets(request: Request):
    """Get user's support tickets"""
    user = await get_current_user(request)
    
    tickets = await db.support_tickets.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return tickets


@router.post("/tickets")
async def create_ticket(request: Request, data: TicketCreate):
    """Create new support ticket"""
    user = await get_current_user(request)
    
    ticket = SupportTicket(
        user_id=user["user_id"],
        subject=data.subject,
        message=data.message
    )
    
    ticket_doc = ticket.model_dump()
    ticket_doc['created_at'] = ticket_doc['created_at'].isoformat()
    ticket_doc['updated_at'] = ticket_doc['updated_at'].isoformat()
    
    await db.support_tickets.insert_one(ticket_doc)
    
    return {"message": "Ticket created", "ticket_id": ticket.ticket_id}


@router.get("/tickets/{ticket_id}")
async def get_ticket(ticket_id: str, request: Request):
    """Get single ticket details"""
    user = await get_current_user(request)
    
    ticket = await db.support_tickets.find_one(
        {"ticket_id": ticket_id, "user_id": user["user_id"]},
        {"_id": 0}
    )
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    return ticket


@router.post("/tickets/{ticket_id}/respond")
async def respond_to_ticket(ticket_id: str, request: Request, data: TicketResponse):
    """Add user response to ticket"""
    user = await get_current_user(request)
    
    ticket = await db.support_tickets.find_one(
        {"ticket_id": ticket_id, "user_id": user["user_id"]},
        {"_id": 0}
    )
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    response = {
        "message": data.message,
        "from": "user",
        "user_name": user.get("name", "User"),
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
