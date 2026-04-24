"""
Iteration 8 Backend Tests
Testing features:
1. Login endpoint returns account_number
2. Get_me endpoint returns account_number
3. Portfolios endpoint returns expected_return and duration_unit
4. Transactions endpoint returns income/profit types
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://portfix.preview.emergentagent.com')

class TestAccountNumber:
    """Test account_number is returned in auth endpoints"""
    
    def test_login_returns_account_number(self):
        """Login should return account_number for user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@altyncontract.kz",
            "password": "abc123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "account_number" in data, "account_number not in login response"
        assert data["account_number"] is not None, "account_number is None"
        assert data["account_number"].startswith("AC"), f"account_number should start with AC, got: {data['account_number']}"
        print(f"PASS: Login returns account_number: {data['account_number']}")
    
    def test_get_me_returns_account_number(self):
        """Get_me should return account_number for authenticated user"""
        # First login to get session token
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@altyncontract.kz",
            "password": "abc123"
        })
        assert login_response.status_code == 200
        session_token = login_response.json().get("session_token")
        
        # Get user info
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            cookies={"session_token": session_token}
        )
        assert response.status_code == 200, f"Get_me failed: {response.text}"
        
        data = response.json()
        assert "account_number" in data, "account_number not in get_me response"
        assert data["account_number"] is not None, "account_number is None"
        assert data["account_number"].startswith("AC"), f"account_number should start with AC"
        print(f"PASS: Get_me returns account_number: {data['account_number']}")


class TestPortfolios:
    """Test portfolio endpoints return yield information"""
    
    def test_portfolios_return_expected_return(self):
        """Portfolios should return expected_return (annual yield)"""
        response = requests.get(f"{BASE_URL}/api/portfolios")
        assert response.status_code == 200, f"Portfolios failed: {response.text}"
        
        data = response.json()
        assert len(data) > 0, "No portfolios returned"
        
        for portfolio in data:
            assert "expected_return" in portfolio, f"expected_return not in portfolio: {portfolio.get('name')}"
            assert portfolio["expected_return"] > 0, "expected_return should be positive"
        
        print(f"PASS: All {len(data)} portfolios have expected_return")
    
    def test_portfolios_have_duration_info(self):
        """Portfolios should have duration_months for period yield calculation"""
        response = requests.get(f"{BASE_URL}/api/portfolios")
        assert response.status_code == 200
        
        data = response.json()
        for portfolio in data:
            assert "duration_months" in portfolio, f"duration_months not in portfolio: {portfolio.get('name')}"
            assert isinstance(portfolio["duration_months"], list), "duration_months should be a list"
        
        print(f"PASS: All portfolios have duration_months")


class TestTransactions:
    """Test transaction endpoints"""
    
    def test_user_transactions_endpoint(self):
        """User transactions endpoint should work"""
        # First login
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@altyncontract.kz",
            "password": "abc123"
        })
        assert login_response.status_code == 200
        session_token = login_response.json().get("session_token")
        
        # Get transactions
        response = requests.get(
            f"{BASE_URL}/api/user/transactions",
            cookies={"session_token": session_token}
        )
        assert response.status_code == 200, f"Transactions failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Transactions should be a list"
        print(f"PASS: User transactions endpoint returns {len(data)} transactions")
    
    def test_transactions_have_type_field(self):
        """Transactions should have type field for income/profit display"""
        # First login
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@altyncontract.kz",
            "password": "abc123"
        })
        session_token = login_response.json().get("session_token")
        
        # Get transactions
        response = requests.get(
            f"{BASE_URL}/api/user/transactions",
            cookies={"session_token": session_token}
        )
        assert response.status_code == 200
        
        data = response.json()
        if len(data) > 0:
            for tx in data[:5]:  # Check first 5
                assert "type" in tx, f"type not in transaction: {tx}"
                assert tx["type"] in ["deposit", "withdrawal", "investment", "return", "profit", "income", "reinvested", "to_available_balance"], f"Unknown transaction type: {tx['type']}"
            print(f"PASS: Transactions have valid type field")
        else:
            print("INFO: No transactions to check")


class TestCompanyBankInfo:
    """Test company bank info for deposit modal"""
    
    def test_company_bank_info_endpoint(self):
        """Company bank info should be available for deposit modal"""
        response = requests.get(f"{BASE_URL}/api/company-bank-info")
        assert response.status_code == 200, f"Company bank info failed: {response.text}"
        
        data = response.json()
        # Check for bank info fields
        assert "bank_name" in data or "company_name" in data, "Bank info should have bank_name or company_name"
        print(f"PASS: Company bank info endpoint works")


class TestBrokers:
    """Test brokers endpoint for withdrawal"""
    
    def test_brokers_endpoint(self):
        """Brokers endpoint should return list of brokers"""
        response = requests.get(f"{BASE_URL}/api/brokers")
        assert response.status_code == 200, f"Brokers failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Brokers should be a list"
        print(f"PASS: Brokers endpoint returns {len(data)} brokers")


class TestHealthCheck:
    """Basic health check"""
    
    def test_health_endpoint(self):
        """Health endpoint should return healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("status") == "healthy"
        print("PASS: Health endpoint working")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
