"""
Iteration 9 Tests - APScheduler and Profit Analytics
Tests for:
1. APScheduler status endpoint GET /api/scheduler/status
2. Manual profit accrual trigger POST /api/scheduler/run-now
3. Profit analytics API GET /api/user/profit-analytics
4. Previous features: account_number in deposit modal, transaction types show 'Доход'
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthAndAuth:
    """Basic health and authentication tests"""
    
    def test_health_endpoint(self):
        """Test health endpoint is working"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("✓ Health endpoint working")
    
    def test_admin_login(self):
        """Test admin login returns session token and account_number"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@altyncontract.kz",
            "password": "abc123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "session_token" in data
        assert "user_id" in data
        assert data.get("role") == "admin"
        # Verify account_number is returned (previous feature)
        assert "account_number" in data, "account_number should be returned on login"
        print(f"✓ Admin login successful, account_number: {data.get('account_number')}")
        return data


class TestSchedulerEndpoints:
    """Tests for APScheduler endpoints (admin only)"""
    
    @pytest.fixture
    def admin_session(self):
        """Get admin session token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@altyncontract.kz",
            "password": "abc123"
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json().get("session_token")
    
    def test_scheduler_status_requires_auth(self):
        """Test scheduler status endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/scheduler/status")
        assert response.status_code == 401
        print("✓ Scheduler status requires authentication")
    
    def test_scheduler_status_returns_running(self, admin_session):
        """Test GET /api/scheduler/status returns running=true and job info"""
        headers = {"Authorization": f"Bearer {admin_session}"}
        response = requests.get(f"{BASE_URL}/api/scheduler/status", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify running status
        assert "running" in data, "Response should contain 'running' field"
        assert data["running"] == True, "Scheduler should be running"
        
        # Verify jobs info
        assert "jobs" in data, "Response should contain 'jobs' field"
        assert isinstance(data["jobs"], list), "Jobs should be a list"
        
        if len(data["jobs"]) > 0:
            job = data["jobs"][0]
            assert "id" in job, "Job should have 'id'"
            assert "name" in job, "Job should have 'name'"
            assert "next_run" in job, "Job should have 'next_run'"
            assert "trigger" in job, "Job should have 'trigger'"
            print(f"✓ Scheduler status: running={data['running']}, jobs={len(data['jobs'])}")
            print(f"  Job: {job['name']}, next_run: {job['next_run']}")
        else:
            print(f"✓ Scheduler status: running={data['running']}, no jobs scheduled")
    
    def test_scheduler_run_now_requires_auth(self):
        """Test scheduler run-now endpoint requires authentication"""
        response = requests.post(f"{BASE_URL}/api/scheduler/run-now")
        assert response.status_code == 401
        print("✓ Scheduler run-now requires authentication")
    
    def test_scheduler_run_now_works(self, admin_session):
        """Test POST /api/scheduler/run-now triggers profit accrual"""
        headers = {"Authorization": f"Bearer {admin_session}"}
        response = requests.post(f"{BASE_URL}/api/scheduler/run-now", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "message" in data, "Response should contain 'message'"
        assert "status" in data, "Response should contain 'status'"
        assert data["status"] == "running", "Status should be 'running'"
        print(f"✓ Scheduler run-now triggered: {data['message']}")


class TestProfitAnalytics:
    """Tests for profit analytics API"""
    
    @pytest.fixture
    def user_session(self):
        """Get user session token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@altyncontract.kz",
            "password": "abc123"
        })
        if response.status_code != 200:
            pytest.skip("Login failed")
        return response.json().get("session_token")
    
    def test_profit_analytics_requires_auth(self):
        """Test profit analytics endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/user/profit-analytics")
        assert response.status_code == 401
        print("✓ Profit analytics requires authentication")
    
    def test_profit_analytics_returns_monthly_data(self, user_session):
        """Test GET /api/user/profit-analytics returns monthly data"""
        headers = {"Authorization": f"Bearer {user_session}"}
        response = requests.get(f"{BASE_URL}/api/user/profit-analytics", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "monthly" in data, "Response should contain 'monthly' field"
        assert "total_profit" in data, "Response should contain 'total_profit' field"
        assert "currency" in data, "Response should contain 'currency' field"
        
        # Verify monthly data structure
        assert isinstance(data["monthly"], list), "Monthly should be a list"
        assert len(data["monthly"]) >= 1, "Should have at least 1 month of data"
        
        # Check first month structure
        month = data["monthly"][0]
        assert "month" in month, "Month should have 'month' field"
        assert "month_name" in month, "Month should have 'month_name' field"
        assert "profit" in month, "Month should have 'profit' field"
        assert "cumulative" in month, "Month should have 'cumulative' field"
        
        print(f"✓ Profit analytics: {len(data['monthly'])} months, total_profit={data['total_profit']}")
        for m in data["monthly"]:
            print(f"  {m['month_name']}: profit={m['profit']}, cumulative={m['cumulative']}")


class TestPreviousFeatures:
    """Tests for previous features that should still work"""
    
    @pytest.fixture
    def user_session(self):
        """Get user session token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@altyncontract.kz",
            "password": "abc123"
        })
        if response.status_code != 200:
            pytest.skip("Login failed")
        return response.json()
    
    def test_login_returns_account_number(self, user_session):
        """Test that login returns account_number"""
        assert "account_number" in user_session, "Login should return account_number"
        assert user_session["account_number"].startswith("AC"), "Account number should start with AC"
        print(f"✓ Login returns account_number: {user_session['account_number']}")
    
    def test_get_me_returns_account_number(self, user_session):
        """Test that /api/auth/me returns account_number"""
        headers = {"Authorization": f"Bearer {user_session['session_token']}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "account_number" in data, "User profile should contain account_number"
        print(f"✓ Get me returns account_number: {data.get('account_number')}")
    
    def test_transactions_have_type_field(self, user_session):
        """Test that transactions have type field for 'Доход' display"""
        headers = {"Authorization": f"Bearer {user_session['session_token']}"}
        response = requests.get(f"{BASE_URL}/api/user/transactions", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        if len(data) > 0:
            tx = data[0]
            assert "type" in tx, "Transaction should have 'type' field"
            assert "amount" in tx, "Transaction should have 'amount' field"
            assert "status" in tx, "Transaction should have 'status' field"
            print(f"✓ Transactions have type field, first tx type: {tx.get('type')}")
        else:
            print("✓ No transactions found, but endpoint works")
    
    def test_portfolios_have_expected_return(self, user_session):
        """Test that portfolios have expected_return for yield display"""
        response = requests.get(f"{BASE_URL}/api/portfolios")
        assert response.status_code == 200
        data = response.json()
        
        if len(data) > 0:
            portfolio = data[0]
            assert "expected_return" in portfolio, "Portfolio should have 'expected_return'"
            assert "duration_months" in portfolio, "Portfolio should have 'duration_months'"
            print(f"✓ Portfolios have expected_return: {portfolio.get('expected_return')}%")
        else:
            print("✓ No portfolios found, but endpoint works")


class TestAdminDashboard:
    """Tests for admin dashboard endpoint"""
    
    @pytest.fixture
    def admin_session(self):
        """Get admin session token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@altyncontract.kz",
            "password": "abc123"
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json().get("session_token")
    
    def test_admin_dashboard_endpoint(self, admin_session):
        """Test admin dashboard returns stats"""
        headers = {"Authorization": f"Bearer {admin_session}"}
        response = requests.get(f"{BASE_URL}/api/admin/dashboard", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify expected fields
        expected_fields = ["total_users", "total_investments", "pending_kyc", "pending_withdrawals", "open_tickets"]
        for field in expected_fields:
            assert field in data, f"Dashboard should contain '{field}'"
        
        print(f"✓ Admin dashboard: users={data.get('total_users')}, investments={data.get('total_investments')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
