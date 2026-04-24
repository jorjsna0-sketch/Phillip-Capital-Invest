"""
Backend API Tests - Iteration 16
Testing modular routers after backend refactoring
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@altyncontract.kz"
ADMIN_PASSWORD = "abc123"


class TestHealthEndpoint:
    """Health check endpoint tests"""
    
    def test_health_check(self):
        """Test /api/health returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("✓ Health check passed")


class TestAuthEndpoints:
    """Authentication endpoint tests"""
    
    def test_login_success(self):
        """Test /api/auth/login with valid admin credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "session_token" in data
        assert "user_id" in data
        assert data["role"] == "admin"
        assert "account_number" in data
        print(f"✓ Login successful - user_id: {data['user_id']}, role: {data['role']}")
    
    def test_login_invalid_credentials(self):
        """Test /api/auth/login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✓ Invalid login correctly rejected with 401")


class TestAdminDashboard:
    """Admin dashboard endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin session token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            self.session_token = response.json()["session_token"]
        else:
            pytest.skip("Could not authenticate as admin")
    
    def test_admin_dashboard_returns_stats(self):
        """Test /api/admin/dashboard returns dashboard statistics"""
        response = requests.get(
            f"{BASE_URL}/api/admin/dashboard",
            headers={"Authorization": f"Bearer {self.session_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify expected fields exist (server.py implementation)
        expected_fields = ["total_users", "total_investments", "pending_kyc", 
                          "pending_withdrawals", "open_tickets"]
        for field in expected_fields:
            assert field in data, f"Missing field: {field}"
        
        print(f"✓ Admin dashboard stats: users={data.get('total_users')}, investments={data.get('total_investments')}")
    
    def test_admin_dashboard_requires_auth(self):
        """Test /api/admin/dashboard requires authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/dashboard")
        assert response.status_code == 401
        print("✓ Admin dashboard correctly requires authentication")


class TestSchedulerEndpoint:
    """Scheduler status endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin session token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            self.session_token = response.json()["session_token"]
        else:
            pytest.skip("Could not authenticate as admin")
    
    def test_scheduler_status_returns_info(self):
        """Test /api/scheduler/status returns scheduler information"""
        response = requests.get(
            f"{BASE_URL}/api/scheduler/status",
            headers={"Authorization": f"Bearer {self.session_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify expected fields
        assert "running" in data
        assert "jobs" in data
        assert isinstance(data["jobs"], list)
        
        # Check if scheduler is running
        if data["running"]:
            print(f"✓ Scheduler running with {len(data['jobs'])} jobs")
            for job in data["jobs"]:
                print(f"  - Job: {job.get('name')}, next_run: {job.get('next_run')}")
        else:
            print("✓ Scheduler status returned (not running)")
    
    def test_scheduler_status_requires_admin(self):
        """Test /api/scheduler/status requires admin authentication"""
        response = requests.get(f"{BASE_URL}/api/scheduler/status")
        assert response.status_code == 401
        print("✓ Scheduler status correctly requires authentication")


class TestExchangeRatesEndpoint:
    """Exchange rates endpoint tests"""
    
    def test_exchange_rates_returns_rates(self):
        """Test /api/exchange-rates returns currency rates"""
        response = requests.get(f"{BASE_URL}/api/exchange-rates")
        assert response.status_code == 200
        data = response.json()
        
        # Verify expected fields
        assert "base" in data
        assert "rates" in data
        assert "updated_at" in data
        
        # Verify some common currencies exist
        rates = data["rates"]
        assert "USD" in rates
        assert "EUR" in rates
        assert "KZT" in rates
        
        print(f"✓ Exchange rates returned - base: {data['base']}, currencies: {len(rates)}")
        print(f"  - USD: {rates.get('USD')}, EUR: {rates.get('EUR')}, KZT: {rates.get('KZT')}")
    
    def test_exchange_rates_with_base_currency(self):
        """Test /api/exchange-rates with different base currency"""
        response = requests.get(f"{BASE_URL}/api/exchange-rates?base=EUR")
        assert response.status_code == 200
        data = response.json()
        assert data["base"] == "EUR"
        print(f"✓ Exchange rates with EUR base returned")


class TestPortfoliosEndpoint:
    """Portfolios endpoint tests"""
    
    def test_portfolios_returns_list(self):
        """Test /api/portfolios returns portfolio list"""
        response = requests.get(f"{BASE_URL}/api/portfolios")
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        assert len(data) > 0
        
        # Verify portfolio structure
        portfolio = data[0]
        expected_fields = ["portfolio_id", "name", "description", "min_investment", 
                          "max_investment", "expected_return", "risk_level", "status"]
        for field in expected_fields:
            assert field in portfolio, f"Missing field: {field}"
        
        print(f"✓ Portfolios returned: {len(data)} portfolios")
        for p in data[:3]:
            name = p.get("name", {}).get("en", p.get("name", {}).get("ru", "Unknown"))
            print(f"  - {p['portfolio_id']}: {name} ({p['risk_level']} risk)")
    
    def test_portfolios_featured(self):
        """Test /api/portfolios/featured returns featured portfolios"""
        response = requests.get(f"{BASE_URL}/api/portfolios/featured")
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        # Featured portfolios should be max 3
        assert len(data) <= 3
        
        print(f"✓ Featured portfolios returned: {len(data)}")
    
    def test_portfolio_by_id(self):
        """Test /api/portfolios/{id} returns single portfolio"""
        # First get list to get a valid ID
        list_response = requests.get(f"{BASE_URL}/api/portfolios")
        portfolios = list_response.json()
        
        if portfolios:
            portfolio_id = portfolios[0]["portfolio_id"]
            response = requests.get(f"{BASE_URL}/api/portfolios/{portfolio_id}")
            assert response.status_code == 200
            data = response.json()
            assert data["portfolio_id"] == portfolio_id
            print(f"✓ Single portfolio retrieved: {portfolio_id}")
    
    def test_portfolio_not_found(self):
        """Test /api/portfolios/{id} returns 404 for invalid ID"""
        response = requests.get(f"{BASE_URL}/api/portfolios/invalid_portfolio_id")
        assert response.status_code == 404
        print("✓ Invalid portfolio ID correctly returns 404")


class TestAdminUsersEndpoint:
    """Admin users management endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin session token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            self.session_token = response.json()["session_token"]
        else:
            pytest.skip("Could not authenticate as admin")
    
    def test_admin_users_list(self):
        """Test /api/admin/users returns user list"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users",
            headers={"Authorization": f"Bearer {self.session_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        print(f"✓ Admin users list returned: {len(data)} users")
    
    def test_admin_users_requires_auth(self):
        """Test /api/admin/users requires admin authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/users")
        assert response.status_code == 401
        print("✓ Admin users endpoint correctly requires authentication")


class TestAdminPortfoliosEndpoint:
    """Admin portfolios management endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin session token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            self.session_token = response.json()["session_token"]
        else:
            pytest.skip("Could not authenticate as admin")
    
    def test_admin_portfolios_list(self):
        """Test /api/admin/portfolios returns all portfolios including inactive"""
        response = requests.get(
            f"{BASE_URL}/api/admin/portfolios",
            headers={"Authorization": f"Bearer {self.session_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        print(f"✓ Admin portfolios list returned: {len(data)} portfolios")


class TestUserEndpoints:
    """User-related endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin session token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            self.session_token = response.json()["session_token"]
        else:
            pytest.skip("Could not authenticate")
    
    def test_auth_me(self):
        """Test /api/auth/me returns current user data"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {self.session_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        expected_fields = ["user_id", "email", "name", "role", "tier", 
                          "available_balance", "portfolio_balance", "kyc_status"]
        for field in expected_fields:
            assert field in data, f"Missing field: {field}"
        
        print(f"✓ User data returned: {data['email']}, role: {data['role']}, tier: {data['tier']}")
    
    def test_user_transactions(self):
        """Test /api/user/transactions returns transaction history"""
        response = requests.get(
            f"{BASE_URL}/api/user/transactions",
            headers={"Authorization": f"Bearer {self.session_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        print(f"✓ User transactions returned: {len(data)} transactions")
    
    def test_user_investments(self):
        """Test /api/investments returns user investments"""
        response = requests.get(
            f"{BASE_URL}/api/investments",
            headers={"Authorization": f"Bearer {self.session_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        print(f"✓ User investments returned: {len(data)} investments")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
