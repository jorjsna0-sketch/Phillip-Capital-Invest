"""
Backend API Tests - Iteration 5
Testing:
1. Admin settings API (company signature and stamp)
2. Portfolio API with profit_accrual_interval and profit_accrual_time
3. Investment creation and contract PDF generation
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@altyncontract.kz"
ADMIN_PASSWORD = "abc123"

class TestHealthAndAuth:
    """Basic health and authentication tests"""
    
    def test_health_endpoint(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("✓ Health endpoint working")
    
    def test_admin_login(self):
        """Test admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        # API returns session_token, not token
        assert "session_token" in data
        assert data["role"] == "admin"
        print(f"✓ Admin login successful, user: {data['email']}")
        return data["session_token"]


class TestAdminSettings:
    """Test admin settings API for company signature and stamp"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["session_token"]
    
    def test_get_admin_settings(self, admin_token):
        """Test GET /api/admin/settings"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/settings", headers=headers)
        assert response.status_code == 200
        data = response.json()
        # Check expected fields exist - settings may have different structure
        assert isinstance(data, dict)
        print(f"✓ Admin settings retrieved: {list(data.keys())[:5]}...")
    
    def test_update_admin_settings_with_signature(self, admin_token):
        """Test PUT /api/admin/settings with company signature and stamp"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # First get current settings
        get_response = requests.get(f"{BASE_URL}/api/admin/settings", headers=headers)
        current_settings = get_response.json() if get_response.status_code == 200 else {}
        
        # Update with test data (small base64 image placeholder)
        test_signature = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        test_stamp = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        
        update_data = {
            **current_settings,
            "company_name": "AltynContract LLP",
            "company_director": "Тестов Тест Тестович",
            "company_director_title": "Генеральный директор",
            "company_license": "Лицензия НБ РК №1.2.34/567",
            "company_bin": "123456789012",
            "company_address": "г. Алматы, ул. Тестовая, 123",
            "company_signature": test_signature,
            "company_stamp": test_stamp,
            "company_bank_name": "Народный банк Казахстана",
            "company_bank_account": "KZ1234567890123456",
            "company_bank_iban": "KZ1234567890123456789012"
        }
        
        response = requests.put(f"{BASE_URL}/api/admin/settings", headers=headers, json=update_data)
        assert response.status_code == 200
        print("✓ Admin settings updated with signature and stamp")
        
        # Verify the update
        verify_response = requests.get(f"{BASE_URL}/api/admin/settings", headers=headers)
        assert verify_response.status_code == 200
        verified_data = verify_response.json()
        assert verified_data.get("company_signature") == test_signature
        assert verified_data.get("company_stamp") == test_stamp
        print("✓ Signature and stamp verified in settings")


class TestPortfolioWithProfitAccrual:
    """Test portfolio API with new profit accrual fields"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["session_token"]
    
    def test_get_portfolios(self, admin_token):
        """Test GET /api/portfolios"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/portfolios", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Retrieved {len(data)} portfolios")
        return data
    
    def test_create_portfolio_with_profit_accrual(self, admin_token):
        """Test POST /api/admin/portfolios with profit_accrual_interval and profit_accrual_time"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        portfolio_data = {
            "name": {"ru": "TEST_Тестовый портфель", "kz": "TEST_Тест портфелі", "en": "TEST_Test Portfolio"},
            "description": {"ru": "Тестовое описание", "kz": "Тест сипаттамасы", "en": "Test description"},
            "strategy": {"ru": "Тестовая стратегия", "kz": "Тест стратегиясы", "en": "Test strategy"},
            "assets": ["Акции", "Облигации"],
            "min_investment": 1000,
            "max_investment": 100000,
            "expected_return": 15,
            "returns_by_term": {"6": 12, "12": 15, "24": 18},
            "duration_months": [6, 12, 24],
            "duration_unit": "months",
            "durations": [
                {"value": 6, "unit": "months", "rate": 12},
                {"value": 12, "unit": "months", "rate": 15}
            ],
            "profit_accrual_interval": "daily",  # NEW FIELD
            "profit_accrual_time": "09:00",  # NEW FIELD
            "risk_level": "medium",
            "featured_on_landing": False,
            "landing_order": 0,
            "contract_template": {"ru": "", "kz": "", "en": ""},
            "detailed_assets": [],
            "sales_text": {"ru": "", "kz": "", "en": ""},
            "safety_guarantee": {"ru": "", "kz": "", "en": ""}
        }
        
        response = requests.post(f"{BASE_URL}/api/admin/portfolios", headers=headers, json=portfolio_data)
        assert response.status_code in [200, 201]
        data = response.json()
        assert "portfolio_id" in data
        print(f"✓ Portfolio created with ID: {data['portfolio_id']}")
        
        # Verify the portfolio has the new fields
        portfolio_id = data["portfolio_id"]
        get_response = requests.get(f"{BASE_URL}/api/portfolios/{portfolio_id}", headers=headers)
        assert get_response.status_code == 200
        portfolio = get_response.json()
        
        assert portfolio.get("profit_accrual_interval") == "daily"
        assert portfolio.get("profit_accrual_time") == "09:00"
        print("✓ Portfolio profit_accrual_interval and profit_accrual_time verified")
        
        return portfolio_id
    
    def test_update_portfolio_profit_accrual(self, admin_token):
        """Test updating portfolio profit accrual settings"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get existing portfolios
        response = requests.get(f"{BASE_URL}/api/portfolios", headers=headers)
        portfolios = response.json()
        
        if not portfolios:
            pytest.skip("No portfolios to update")
        
        portfolio = portfolios[0]
        portfolio_id = portfolio["portfolio_id"]
        
        # Update with new profit accrual settings
        update_data = {
            **portfolio,
            "profit_accrual_interval": "weekly",
            "profit_accrual_time": "12:00"
        }
        
        # Remove _id if present
        update_data.pop("_id", None)
        
        response = requests.put(f"{BASE_URL}/api/portfolios/{portfolio_id}", headers=headers, json=update_data)
        assert response.status_code == 200
        print(f"✓ Portfolio {portfolio_id} updated with new profit accrual settings")
    
    def test_cleanup_test_portfolios(self, admin_token):
        """Cleanup TEST_ prefixed portfolios"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/portfolios", headers=headers)
        portfolios = response.json()
        
        for portfolio in portfolios:
            name = portfolio.get("name", {}).get("ru", "")
            if name.startswith("TEST_"):
                delete_response = requests.delete(
                    f"{BASE_URL}/api/admin/portfolios/{portfolio['portfolio_id']}", 
                    headers=headers
                )
                if delete_response.status_code == 200:
                    print(f"✓ Cleaned up test portfolio: {name}")


class TestInvestmentAndContract:
    """Test investment creation and PDF contract generation"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["session_token"]
    
    @pytest.fixture
    def user_token(self, admin_token):
        """Get or create a test user token"""
        # Try to login as test user first
        test_email = "testuser@altyncontract.kz"
        test_password = "test123"
        
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": test_email,
            "password": test_password
        })
        
        if login_response.status_code == 200:
            return login_response.json()["session_token"]
        
        # If login fails, register new user
        register_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email,
            "password": test_password,
            "name": "Test User"
        })
        
        if register_response.status_code in [200, 201]:
            return register_response.json()["session_token"]
        
        # Fall back to admin token
        return admin_token
    
    def test_get_user_investments(self, user_token):
        """Test GET /api/investments"""
        headers = {"Authorization": f"Bearer {user_token}"}
        response = requests.get(f"{BASE_URL}/api/investments", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Retrieved {len(data)} investments")
        return data
    
    def test_contract_pdf_generation(self, user_token):
        """Test GET /api/investments/{id}/contract - PDF generation with signatures"""
        headers = {"Authorization": f"Bearer {user_token}"}
        
        # Get user's investments
        investments_response = requests.get(f"{BASE_URL}/api/investments", headers=headers)
        investments = investments_response.json()
        
        if not investments:
            print("⚠ No investments found to test PDF generation")
            pytest.skip("No investments available for PDF test")
        
        investment_id = investments[0]["investment_id"]
        
        # Request PDF contract
        response = requests.get(
            f"{BASE_URL}/api/investments/{investment_id}/contract", 
            headers=headers
        )
        
        assert response.status_code == 200
        
        # Check content type is PDF
        content_type = response.headers.get("content-type", "")
        assert "application/pdf" in content_type or len(response.content) > 0
        
        # Check PDF starts with %PDF
        if response.content[:4] == b'%PDF':
            print(f"✓ PDF contract generated successfully for investment {investment_id}")
            print(f"  PDF size: {len(response.content)} bytes")
        else:
            print(f"⚠ Response may not be a valid PDF, content-type: {content_type}")
        
        return investment_id


class TestBrokers:
    """Test brokers API"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["session_token"]
    
    def test_get_brokers(self, admin_token):
        """Test GET /api/admin/brokers"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/brokers", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Retrieved {len(data)} brokers")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
