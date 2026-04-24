"""
Routers package for AltynContract API
"""
from fastapi import APIRouter

from .auth import router as auth_router
from .user import router as user_router
from .portfolios import router as portfolios_router
from .investments import router as investments_router
from .kyc import router as kyc_router
from .support import router as support_router
from .deposits import router as deposits_router
from .admin import router as admin_router
from .scheduler import router as scheduler_router
from .utilities import router as utilities_router
from .contracts import router as contracts_router
from .email import router as email_router
from .security import router as security_router
from .notifications import router as notifications_router

# Create main API router and include sub-routers
api_router = APIRouter()

# Include all routers
api_router.include_router(auth_router)
api_router.include_router(user_router)
api_router.include_router(portfolios_router)
api_router.include_router(investments_router)
api_router.include_router(kyc_router)
api_router.include_router(support_router)
api_router.include_router(deposits_router)
api_router.include_router(admin_router)
api_router.include_router(scheduler_router)
api_router.include_router(utilities_router)
api_router.include_router(contracts_router)
api_router.include_router(email_router)
api_router.include_router(security_router)
api_router.include_router(notifications_router)

__all__ = [
    "api_router",
    "auth_router",
    "user_router",
    "portfolios_router",
    "investments_router",
    "kyc_router",
    "support_router",
    "deposits_router",
    "admin_router",
    "scheduler_router",
    "utilities_router",
    "contracts_router",
    "email_router",
    "security_router",
    "notifications_router"
]

