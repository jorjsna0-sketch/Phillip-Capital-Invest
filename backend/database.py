"""
Database configuration and connection for Phillip Capital Invest
"""
import os
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "altyncontract")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# Collections shortcuts
users_collection = db.users
portfolios_collection = db.portfolios
investments_collection = db.investments
transactions_collection = db.transactions
kyc_documents_collection = db.kyc_documents
support_tickets_collection = db.support_tickets
audit_logs_collection = db.audit_logs
admin_settings_collection = db.admin_settings
contract_templates_collection = db.contract_templates
email_campaigns_collection = db.email_campaigns
email_templates_collection = db.email_templates
deposit_requests_collection = db.deposit_requests
withdrawal_requests_collection = db.withdrawal_requests
sessions_collection = db.sessions
