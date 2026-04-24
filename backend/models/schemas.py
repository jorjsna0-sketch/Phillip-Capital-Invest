"""
Pydantic models for Phillip Capital Invest
"""
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr, Field, ConfigDict
import uuid


# ================== USER MODELS ==================

class UserBase(BaseModel):
    email: EmailStr
    name: str
    picture: Optional[str] = None

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    account_number: str = Field(default_factory=lambda: f"AC{uuid.uuid4().hex[:8].upper()}")
    picture: Optional[str] = None
    role: str = "user"  # user, admin
    tier: str = "silver"  # silver, gold, platinum
    available_balance: Dict[str, float] = Field(default_factory=lambda: {"USD": 0, "TRY": 0, "EUR": 0, "USDT": 0})
    portfolio_balance: Dict[str, float] = Field(default_factory=lambda: {"USD": 0, "TRY": 0, "EUR": 0, "USDT": 0})
    total_invested: float = 0
    kyc_status: str = "none"  # none, pending, approved, rejected
    preferred_language: str = "ru"
    preferred_currency: str = "USD"
    phone: Optional[str] = None
    phone_verified: bool = False
    phone_verification_code: Optional[str] = None
    phone_verification_expires: Optional[str] = None
    can_invest_without_kyc: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ================== PORTFOLIO MODELS ==================

class PortfolioAsset(BaseModel):
    """Individual asset within a portfolio"""
    symbol: str
    name: Dict[str, str]
    allocation_percent: float
    asset_type: str  # stock, crypto, commodity, bond, real_estate
    description: Dict[str, str] = Field(default_factory=lambda: {"ru": "", "tr": "", "en": ""})
    current_price: float = 0
    price_change_24h: float = 0
    price_history: List[Dict[str, Any]] = Field(default_factory=list)

class PortfolioNews(BaseModel):
    """News item for portfolio"""
    news_id: str = Field(default_factory=lambda: f"news_{uuid.uuid4().hex[:8]}")
    title: Dict[str, str]
    content: Dict[str, str]
    published_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    source: Optional[str] = None

class Portfolio(BaseModel):
    model_config = ConfigDict(extra="ignore")
    portfolio_id: str = Field(default_factory=lambda: f"pf_{uuid.uuid4().hex[:12]}")
    name: Dict[str, str]
    description: Dict[str, str]
    strategy: Dict[str, str]
    assets: List[str]
    min_investment: float
    max_investment: float
    expected_return: float
    returns_by_term: Dict[str, float] = Field(default_factory=dict)
    duration_months: List[int]
    duration_unit: str = "months"
    durations: List[Dict[str, Any]] = Field(default_factory=list)
    profit_accrual_interval: str = "monthly"
    profit_accrual_time: str = "00:00"
    risk_level: str
    status: str = "active"
    featured_on_landing: bool = False
    landing_order: int = 0
    banner_url: Optional[str] = None
    contract_template_id: Optional[str] = None
    contract_template: Dict[str, str] = Field(default_factory=lambda: {"ru": "", "tr": "", "en": ""})
    detailed_assets: List[Dict[str, Any]] = Field(default_factory=list)
    sales_text: Dict[str, str] = Field(default_factory=lambda: {"ru": "", "tr": "", "en": ""})
    safety_guarantee: Dict[str, str] = Field(default_factory=lambda: {"ru": "", "tr": "", "en": ""})
    price_history: List[Dict[str, Any]] = Field(default_factory=list)
    news: List[Dict[str, Any]] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PortfolioCreate(BaseModel):
    name: Dict[str, str]
    description: Dict[str, str]
    strategy: Dict[str, str]
    assets: List[str]
    min_investment: float
    max_investment: float
    expected_return: float
    returns_by_term: Dict[str, float] = Field(default_factory=dict)
    duration_months: List[int]
    duration_unit: str = "months"
    durations: List[Dict[str, Any]] = Field(default_factory=list)
    profit_accrual_interval: str = "monthly"
    profit_accrual_time: str = "00:00"
    risk_level: str
    featured_on_landing: bool = False
    landing_order: int = 0
    banner_url: Optional[str] = None
    contract_template_id: Optional[str] = None
    contract_template: Dict[str, str] = Field(default_factory=lambda: {"ru": "", "tr": "", "en": ""})
    detailed_assets: List[Dict[str, Any]] = Field(default_factory=list)
    sales_text: Dict[str, str] = Field(default_factory=lambda: {"ru": "", "tr": "", "en": ""})
    safety_guarantee: Dict[str, str] = Field(default_factory=lambda: {"ru": "", "tr": "", "en": ""})
    price_history: List[Dict[str, Any]] = Field(default_factory=list)
    news: List[Dict[str, Any]] = Field(default_factory=list)


# ================== INVESTMENT MODELS ==================

class Investment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    investment_id: str = Field(default_factory=lambda: f"inv_{uuid.uuid4().hex[:12]}")
    user_id: str
    portfolio_id: str
    amount: float
    current_balance: float = 0.0
    currency: str
    duration_months: int
    expected_return: float
    accrued_profit: float = 0.0
    last_accrual_date: Optional[datetime] = None
    start_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    end_date: datetime
    status: str = "active"
    auto_reinvest: bool = False
    signature: str
    signature_type: str
    contract_pdf_url: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class InvestmentCreate(BaseModel):
    portfolio_id: str
    amount: float
    currency: str
    duration_months: int
    auto_reinvest: bool = False
    signature: str
    signature_type: str
    terms_accepted: bool


# ================== TRANSACTION MODELS ==================

class Transaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    transaction_id: str = Field(default_factory=lambda: f"tx_{uuid.uuid4().hex[:12]}")
    user_id: str
    type: str  # deposit, withdrawal, investment, return, profit
    amount: float
    currency: str
    status: str = "pending"
    description: str
    reference_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ================== KYC MODELS ==================

class KYCDocument(BaseModel):
    model_config = ConfigDict(extra="ignore")
    kyc_id: str = Field(default_factory=lambda: f"kyc_{uuid.uuid4().hex[:12]}")
    user_id: str
    document_type: str
    document_url: str
    status: str = "pending"
    rejection_reason: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ================== SUPPORT MODELS ==================

class SupportTicket(BaseModel):
    model_config = ConfigDict(extra="ignore")
    ticket_id: str = Field(default_factory=lambda: f"tkt_{uuid.uuid4().hex[:12]}")
    user_id: str
    subject: str
    message: str
    status: str = "open"
    priority: str = "normal"
    responses: List[Dict] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TicketCreate(BaseModel):
    subject: str
    message: str

class TicketResponse(BaseModel):
    message: str


# ================== AUDIT MODELS ==================

class AuditLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    log_id: str = Field(default_factory=lambda: f"log_{uuid.uuid4().hex[:12]}")
    admin_id: str
    action: str
    target_type: str
    target_id: str
    details: Dict[str, Any]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ================== EMAIL MODELS ==================

class EmailCampaign(BaseModel):
    model_config = ConfigDict(extra="ignore")
    campaign_id: str = Field(default_factory=lambda: f"camp_{uuid.uuid4().hex[:12]}")
    subject: Dict[str, str]
    content: Dict[str, str]
    filters: Dict[str, Any]
    status: str = "draft"
    recipients_count: int = 0
    sent_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class EmailTemplate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    template_id: str = Field(default_factory=lambda: f"etmpl_{uuid.uuid4().hex[:12]}")
    name: str
    subject: Dict[str, str]
    content: Dict[str, str]
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ================== REQUEST MODELS ==================

class DepositRequestModel(BaseModel):
    """User deposit request requiring admin approval"""
    model_config = ConfigDict(extra="ignore")
    request_id: str = Field(default_factory=lambda: f"dep_{uuid.uuid4().hex[:12]}")
    user_id: str
    amount: float
    currency: str = "USD"
    status: str = "pending"
    admin_notes: Optional[str] = None
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WithdrawalRequestModel(BaseModel):
    """User withdrawal request requiring admin approval"""
    model_config = ConfigDict(extra="ignore")
    request_id: str = Field(default_factory=lambda: f"wd_{uuid.uuid4().hex[:12]}")
    user_id: str
    amount: float
    currency: str = "USD"
    broker_id: str
    broker_name: str
    broker_account: str
    status: str = "pending"
    admin_notes: Optional[str] = None
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DepositRequest(BaseModel):
    amount: float
    currency: str

class WithdrawalRequest(BaseModel):
    amount: float
    currency: str


# ================== ADMIN SETTINGS MODELS ==================

class AdminSettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    setting_id: str = "admin_settings"
    # Email settings
    email_enabled: bool = False
    email_provider: str = "sendgrid"
    sendgrid_api_key: Optional[str] = None
    smtp_host: Optional[str] = None
    smtp_port: Optional[str] = "587"
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    email_from: Optional[str] = None
    email_from_name: Optional[str] = "Phillip Capital Invest"
    sender_email: Optional[str] = None
    sender_name: Optional[str] = "Phillip Capital Invest"
    smtp_username: Optional[str] = None
    use_smtp: bool = False
    # Telegram
    telegram_bot_token: Optional[str] = None
    # Company details
    company_name: Optional[str] = "Phillip Capital Invest LLP"
    company_director: Optional[str] = "Иванов И.И."
    company_director_title: Optional[str] = "Генеральный директор"
    company_license: Optional[str] = "Лицензия НБ РК №1.2.34/567"
    company_bin: Optional[str] = "123456789012"
    company_address: Optional[str] = "г. Алматы"
    company_signature: Optional[str] = None
    company_stamp: Optional[str] = None
    brokers: List[Dict[str, Any]] = Field(default_factory=list)
    company_bank_account: Optional[str] = None
    company_bank_name: Optional[str] = None
    company_bank_iban: Optional[str] = None

class Broker(BaseModel):
    """Broker for deposits/withdrawals"""
    broker_id: str = Field(default_factory=lambda: f"broker_{uuid.uuid4().hex[:8]}")
    name: str
    account_template: Optional[str] = None
    instructions: Dict[str, str] = Field(default_factory=lambda: {"ru": "", "en": ""})
    is_active: bool = True

class ContractTemplate(BaseModel):
    """Reusable contract template"""
    model_config = ConfigDict(extra="ignore")
    template_id: str = Field(default_factory=lambda: f"tmpl_{uuid.uuid4().hex[:8]}")
    name: str
    description: Optional[str] = None
    content: Dict[str, str]
    is_default: bool = False
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
