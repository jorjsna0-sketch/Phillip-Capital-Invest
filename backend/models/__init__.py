"""
Models package for Phillip Capital Invest
"""
from .schemas import (
    # User models
    UserBase,
    UserCreate,
    UserLogin,
    User,
    
    # Portfolio models
    PortfolioAsset,
    PortfolioNews,
    Portfolio,
    PortfolioCreate,
    
    # Investment models
    Investment,
    InvestmentCreate,
    
    # Transaction models
    Transaction,
    
    # KYC models
    KYCDocument,
    
    # Support models
    SupportTicket,
    TicketCreate,
    TicketResponse,
    
    # Audit models
    AuditLog,
    
    # Email models
    EmailCampaign,
    EmailTemplate,
    
    # Request models
    DepositRequestModel,
    WithdrawalRequestModel,
    DepositRequest,
    WithdrawalRequest,
    
    # Admin models
    AdminSettings,
    Broker,
    ContractTemplate,
)

__all__ = [
    "UserBase",
    "UserCreate", 
    "UserLogin",
    "User",
    "PortfolioAsset",
    "PortfolioNews",
    "Portfolio",
    "PortfolioCreate",
    "Investment",
    "InvestmentCreate",
    "Transaction",
    "KYCDocument",
    "SupportTicket",
    "TicketCreate",
    "TicketResponse",
    "AuditLog",
    "EmailCampaign",
    "EmailTemplate",
    "DepositRequestModel",
    "WithdrawalRequestModel",
    "DepositRequest",
    "WithdrawalRequest",
    "AdminSettings",
    "Broker",
    "ContractTemplate",
]
