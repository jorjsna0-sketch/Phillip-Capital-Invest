"""
KYC router for Phillip Capital Invest - Document verification
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Request, HTTPException, UploadFile, File, Form
import os
import uuid

from database import db

router = APIRouter(prefix="/kyc", tags=["kyc"])

UPLOAD_DIR = "/app/backend/uploads"


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


@router.get("/status")
async def get_kyc_status(request: Request):
    """Get user's KYC verification status"""
    user = await get_current_user(request)
    
    documents = await db.kyc_documents.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).to_list(10)
    
    return {
        "status": user.get("kyc_status", "none"),
        "documents": documents
    }


@router.post("/upload")
async def upload_kyc_document(
    request: Request,
    file: UploadFile = File(...),
    document_type: str = Form(...)
):
    """Upload KYC document"""
    user = await get_current_user(request)
    
    if document_type not in ["passport", "address", "selfie"]:
        raise HTTPException(status_code=400, detail="Invalid document type")
    
    # Ensure upload directory exists
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    
    # Generate unique filename
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    filename = f"kyc_{user['user_id']}_{document_type}_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    
    # Save file
    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)
    
    # Check if document of this type already exists
    existing = await db.kyc_documents.find_one({
        "user_id": user["user_id"],
        "document_type": document_type
    })
    
    if existing:
        # Update existing document
        await db.kyc_documents.update_one(
            {"kyc_id": existing["kyc_id"]},
            {
                "$set": {
                    "document_url": f"/uploads/{filename}",
                    "status": "pending",
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        kyc_id = existing["kyc_id"]
    else:
        # Create new document record
        kyc_id = f"kyc_{uuid.uuid4().hex[:12]}"
        doc = {
            "kyc_id": kyc_id,
            "user_id": user["user_id"],
            "document_type": document_type,
            "document_url": f"/uploads/{filename}",
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.kyc_documents.insert_one(doc)
    
    # Update user's KYC status to pending if not already approved
    if user.get("kyc_status") != "approved":
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": {"kyc_status": "pending"}}
        )
    
    return {"message": "Document uploaded", "kyc_id": kyc_id, "document_type": document_type}
