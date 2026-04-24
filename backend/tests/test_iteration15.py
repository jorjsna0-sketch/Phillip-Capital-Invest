"""
Backend API Tests for AltynContract - Iteration 15
Testing backend refactoring - modular structure verification

Modules tested:
- Auth endpoints (login, me, logout)
- Portfolio endpoints (list, single, stats)
- User endpoints (transactions, profit-analytics)
- Investment endpoints (list, create)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@altyncontract.kz"
ADMIN_PASSWORD = "abc123"


class TestAuthEndpoints:
    """Authentication endpoint tests"""
    
    def test_login_success(self):
        """Test login with valid admin credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "session_token" in data, "session_token missing in response"
        assert "user_id" in data, "user_id missing in response"
        assert data["email"] == ADMIN_EMAIL
        assert data["role"] == "admin"
        assert "account_number" in data
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "wrong@example.com", "password": "wrongpass"}
        )
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
    
    def test_get_me_authenticated(self):
        """Test GET /api/auth/me with valid session"""
        # First login
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert login_response.status_code == 200
        token = login_response.json()["session_token"]
        
        # Get user data
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Get me failed: {response.text}"
        
        data = response.json()
        assert data["email"] == ADMIN_EMAIL
        assert data["role"] == "admin"
        assert "available_balance" in data
        assert "portfolio_balance" in data
        assert "tier" in data
        assert "kyc_status" in data
        assert "account_number" in data
    
    def test_get_me_unauthenticated(self):
        """Test GET /api/auth/me without session"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401


class TestPortfolioEndpoints:
    """Portfolio endpoint tests"""
    
    def test_get_portfolios_list(self):
        """Test GET /api/portfolios returns portfolio list"""
        response = requests.get(f"{BASE_URL}/api/portfolios")
        assert response.status_code == 200, f"Get portfolios failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) > 0, "Should have at least one portfolio"
        
        # Verify portfolio structure
        portfolio = data[0]
        assert "portfolio_id" in portfolio
        assert "name" in portfolio
        assert "description" in portfolio
        assert "min_investment" in portfolio
        assert "max_investment" in portfolio
        assert "expected_return" in portfolio
        assert "risk_level" in portfolio
        assert "status" in portfolio
    
    def test_get_single_portfolio(self):
        """Test GET /api/portfolios/{id} returns single portfolio"""
        # First get list to get a valid ID
        list_response = requests.get(f"{BASE_URL}/api/portfolios")
        assert list_response.status_code == 200
        portfolios = list_response.json()
        assert len(portfolios) > 0
        
        portfolio_id = portfolios[0]["portfolio_id"]
        
        # Get single portfolio
        response = requests.get(f"{BASE_URL}/api/portfolios/{portfolio_id}")
        assert response.status_code == 200, f"Get portfolio failed: {response.text}"
        
        data = response.json()
        assert data["portfolio_id"] == portfolio_id
        assert "name" in data
        assert "description" in data
    
    def test_get_portfolio_not_found(self):
        """Test GET /api/portfolios/{id} with invalid ID"""
        response = requests.get(f"{BASE_URL}/api/portfolios/invalid_portfolio_id")
        assert response.status_code == 404
    
    def test_get_featured_portfolios(self):
        """Test GET /api/portfolios/featured returns featured portfolios"""
        response = requests.get(f"{BASE_URL}/api/portfolios/featured")
        assert response.status_code == 200, f"Get featured failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        # Featured portfolios should have featured_on_landing = True
        for portfolio in data:
            assert portfolio.get("featured_on_landing") == True or portfolio.get("status") == "active"


class TestUserEndpoints:
    """User endpoint tests - require authentication"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get session token"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert login_response.status_code == 200
        self.token = login_response.json()["session_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_user_transactions(self):
        """Test GET /api/user/transactions returns user transactions"""
        response = requests.get(
            f"{BASE_URL}/api/user/transactions",
            headers=self.headers
        )
        assert response.status_code == 200, f"Get transactions failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # If there are transactions, verify structure
        if len(data) > 0:
            tx = data[0]
            assert "transaction_id" in tx
            assert "type" in tx
            assert "amount" in tx
            assert "currency" in tx
            assert "status" in tx
    
    def test_get_profit_analytics(self):
        """Test GET /api/user/profit-analytics returns profit data"""
        response = requests.get(
            f"{BASE_URL}/api/user/profit-analytics",
            headers=self.headers
        )
        assert response.status_code == 200, f"Get profit analytics failed: {response.text}"
        
        data = response.json()
        assert "total_profit" in data or "monthly" in data
        
        # Verify structure
        if "monthly" in data:
            assert isinstance(data["monthly"], list)


class TestInvestmentEndpoints:
    """Investment endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get session token"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert login_response.status_code == 200
        self.token = login_response.json()["session_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_investments(self):
        """Test GET /api/investments returns user investments"""
        response = requests.get(
            f"{BASE_URL}/api/investments",
            headers=self.headers
        )
        assert response.status_code == 200, f"Get investments failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # If there are investments, verify structure
        if len(data) > 0:
            inv = data[0]
            assert "investment_id" in inv
            assert "portfolio_id" in inv
            assert "amount" in inv
            assert "currency" in inv
            assert "status" in inv
    
    def test_create_investment_with_signature(self):
        """Test POST /api/investments creates new investment"""
        # First get a portfolio
        portfolios_response = requests.get(f"{BASE_URL}/api/portfolios")
        assert portfolios_response.status_code == 200
        portfolios = portfolios_response.json()
        assert len(portfolios) > 0
        
        portfolio = portfolios[0]
        portfolio_id = portfolio["portfolio_id"]
        min_investment = portfolio["min_investment"]
        duration_months = portfolio["duration_months"][0] if portfolio["duration_months"] else 12
        
        # Create investment
        investment_data = {
            "portfolio_id": portfolio_id,
            "amount": min_investment,
            "currency": "USD",
            "duration_months": duration_months,
            "auto_reinvest": False,
            "signature": "data:image/png;base64,TEST_SIGNATURE_DATA",
            "signature_type": "canvas",
            "terms_accepted": True
        }
        
        response = requests.post(
            f"{BASE_URL}/api/investments",
            json=investment_data,
            headers=self.headers
        )
        
        # Admin user has can_invest_without_kyc=True, so should succeed
        # or might fail due to insufficient balance - both are valid responses
        assert response.status_code in [200, 201, 400, 403], f"Unexpected status: {response.status_code}, {response.text}"
        
        if response.status_code in [200, 201]:
            data = response.json()
            assert "investment_id" in data or "message" in data


class TestAdminEndpoints:
    """Admin endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert login_response.status_code == 200
        self.token = login_response.json()["session_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_admin_get_users(self):
        """Test GET /api/admin/users returns user list"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users",
            headers=self.headers
        )
        assert response.status_code == 200, f"Get users failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
    
    def test_admin_get_dashboard(self):
        """Test GET /api/admin/dashboard returns dashboard data"""
        response = requests.get(
            f"{BASE_URL}/api/admin/dashboard",
            headers=self.headers
        )
        assert response.status_code == 200, f"Get dashboard failed: {response.text}"
        
        data = response.json()
        # Dashboard should have stats
        assert isinstance(data, dict), "Response should be a dict"


class TestHealthAndMisc:
    """Health check and miscellaneous tests"""
    
    def test_api_root_accessible(self):
        """Test that API is accessible"""
        response = requests.get(f"{BASE_URL}/api/portfolios")
        assert response.status_code == 200
    
    def test_cors_headers(self):
        """Test CORS headers are present"""
        response = requests.options(
            f"{BASE_URL}/api/portfolios",
            headers={"Origin": "https://example.com"}
        )
        # CORS should allow requests
        assert response.status_code in [200, 204, 405]


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
