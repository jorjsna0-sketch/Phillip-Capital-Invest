"""
Test suite for Deposit/Withdrawal Request System
Tests the full flow: user creates request -> admin approves/rejects -> balance updates

Features tested:
1. GET /api/brokers - list of active brokers
2. POST /api/deposit-requests - user creates deposit request
3. GET /api/deposit-requests - user views their deposit requests
4. POST /api/withdrawal-requests - user creates withdrawal request with broker
5. GET /api/withdrawal-requests - user views their withdrawal requests
6. GET /api/admin/deposit-requests - admin views all deposit requests
7. PUT /api/admin/deposit-requests/{id} - admin approves/rejects deposit
8. GET /api/admin/withdrawal-requests - admin views all withdrawal requests
9. PUT /api/admin/withdrawal-requests/{id} - admin approves/rejects withdrawal
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://portfix.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@altyncontract.kz"
ADMIN_PASSWORD = "abc123"
TEST_USER_EMAIL = f"test_wallet_{uuid.uuid4().hex[:8]}@test.com"
TEST_USER_PASSWORD = "testpass123"
TEST_USER_NAME = "Test Wallet User"


class TestBrokersAPI:
    """Test brokers endpoint for withdrawal broker selection"""
    
    def test_get_brokers_returns_list(self):
        """GET /api/brokers should return list of active brokers"""
        response = requests.get(f"{BASE_URL}/api/brokers")
        assert response.status_code == 200
        
        brokers = response.json()
        assert isinstance(brokers, list)
        assert len(brokers) >= 1, "Should have at least 1 broker"
        
        # Verify broker structure
        broker = brokers[0]
        assert "broker_id" in broker
        assert "name" in broker
        print(f"✓ Found {len(brokers)} broker(s): {[b['name'] for b in brokers]}")
    
    def test_broker_has_required_fields(self):
        """Broker should have broker_id, name, and instructions"""
        response = requests.get(f"{BASE_URL}/api/brokers")
        assert response.status_code == 200
        
        brokers = response.json()
        for broker in brokers:
            assert "broker_id" in broker, "Broker must have broker_id"
            assert "name" in broker, "Broker must have name"
            # instructions is optional but should be dict if present
            if "instructions" in broker:
                assert isinstance(broker["instructions"], dict)
        print("✓ All brokers have required fields")


class TestCompanyBankInfo:
    """Test company bank info for deposit instructions"""
    
    def test_get_company_bank_info(self):
        """GET /api/company-bank-info should return company bank details"""
        response = requests.get(f"{BASE_URL}/api/company-bank-info")
        assert response.status_code == 200
        
        info = response.json()
        assert "company_name" in info
        print(f"✓ Company bank info: {info.get('company_name')}")


class TestDepositWithdrawalFlow:
    """Test full deposit/withdrawal flow with admin approval"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Login as admin and return session token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert data.get("role") == "admin", "User is not admin"
        print(f"✓ Admin logged in: {data['email']}")
        return data["session_token"]
    
    @pytest.fixture(scope="class")
    def test_user_session(self):
        """Register test user and return session token"""
        # Register new user
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD,
            "name": TEST_USER_NAME
        })
        
        if response.status_code == 400 and "already registered" in response.text:
            # User exists, login instead
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": TEST_USER_EMAIL,
                "password": TEST_USER_PASSWORD
            })
        
        assert response.status_code == 200, f"User registration/login failed: {response.text}"
        data = response.json()
        print(f"✓ Test user ready: {data['email']}")
        return data["session_token"]
    
    def test_user_create_deposit_request(self, test_user_session):
        """User can create a deposit request"""
        response = requests.post(
            f"{BASE_URL}/api/deposit-requests",
            headers={"Authorization": f"Bearer {test_user_session}"},
            json={"amount": 1000, "currency": "USD"}
        )
        assert response.status_code == 200, f"Failed to create deposit: {response.text}"
        
        data = response.json()
        assert "request_id" in data
        assert data["request_id"].startswith("dep_")
        print(f"✓ Deposit request created: {data['request_id']}")
        return data["request_id"]
    
    def test_user_view_deposit_requests(self, test_user_session):
        """User can view their deposit requests"""
        response = requests.get(
            f"{BASE_URL}/api/deposit-requests",
            headers={"Authorization": f"Bearer {test_user_session}"}
        )
        assert response.status_code == 200
        
        requests_list = response.json()
        assert isinstance(requests_list, list)
        print(f"✓ User has {len(requests_list)} deposit request(s)")
    
    def test_admin_view_deposit_requests(self, admin_session):
        """Admin can view all deposit requests"""
        response = requests.get(
            f"{BASE_URL}/api/admin/deposit-requests",
            headers={"Authorization": f"Bearer {admin_session}"}
        )
        assert response.status_code == 200
        
        requests_list = response.json()
        assert isinstance(requests_list, list)
        print(f"✓ Admin sees {len(requests_list)} deposit request(s)")
    
    def test_admin_view_pending_deposit_requests(self, admin_session):
        """Admin can filter pending deposit requests"""
        response = requests.get(
            f"{BASE_URL}/api/admin/deposit-requests?status=pending",
            headers={"Authorization": f"Bearer {admin_session}"}
        )
        assert response.status_code == 200
        
        requests_list = response.json()
        for req in requests_list:
            assert req["status"] == "pending"
        print(f"✓ Admin sees {len(requests_list)} pending deposit request(s)")
    
    def test_admin_approve_deposit_request(self, admin_session, test_user_session):
        """Admin can approve deposit request and user balance increases"""
        # First create a new deposit request
        create_resp = requests.post(
            f"{BASE_URL}/api/deposit-requests",
            headers={"Authorization": f"Bearer {test_user_session}"},
            json={"amount": 500, "currency": "USD"}
        )
        assert create_resp.status_code == 200
        request_id = create_resp.json()["request_id"]
        
        # Get user balance before
        me_resp = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {test_user_session}"}
        )
        balance_before = me_resp.json().get("available_balance", {}).get("USD", 0)
        
        # Admin approves
        approve_resp = requests.put(
            f"{BASE_URL}/api/admin/deposit-requests/{request_id}",
            headers={"Authorization": f"Bearer {admin_session}"},
            json={"action": "approve", "notes": "Test approval"}
        )
        assert approve_resp.status_code == 200, f"Approve failed: {approve_resp.text}"
        
        # Verify balance increased
        me_resp = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {test_user_session}"}
        )
        balance_after = me_resp.json().get("available_balance", {}).get("USD", 0)
        
        assert balance_after == balance_before + 500, f"Balance should increase by 500. Before: {balance_before}, After: {balance_after}"
        print(f"✓ Deposit approved. Balance: {balance_before} -> {balance_after}")
    
    def test_admin_reject_deposit_request(self, admin_session, test_user_session):
        """Admin can reject deposit request"""
        # Create deposit request
        create_resp = requests.post(
            f"{BASE_URL}/api/deposit-requests",
            headers={"Authorization": f"Bearer {test_user_session}"},
            json={"amount": 200, "currency": "USD"}
        )
        assert create_resp.status_code == 200
        request_id = create_resp.json()["request_id"]
        
        # Get balance before
        me_resp = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {test_user_session}"}
        )
        balance_before = me_resp.json().get("available_balance", {}).get("USD", 0)
        
        # Admin rejects
        reject_resp = requests.put(
            f"{BASE_URL}/api/admin/deposit-requests/{request_id}",
            headers={"Authorization": f"Bearer {admin_session}"},
            json={"action": "reject", "notes": "Test rejection"}
        )
        assert reject_resp.status_code == 200
        
        # Verify balance unchanged
        me_resp = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {test_user_session}"}
        )
        balance_after = me_resp.json().get("available_balance", {}).get("USD", 0)
        
        assert balance_after == balance_before, "Balance should not change on rejection"
        print(f"✓ Deposit rejected. Balance unchanged: {balance_after}")


class TestWithdrawalFlow:
    """Test withdrawal request flow"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Login as admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["session_token"]
    
    @pytest.fixture(scope="class")
    def funded_user_session(self, admin_session):
        """Create user with balance for withdrawal testing"""
        user_email = f"test_wd_{uuid.uuid4().hex[:8]}@test.com"
        
        # Register user
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": user_email,
            "password": "testpass123",
            "name": "Withdrawal Test User"
        })
        assert response.status_code == 200
        user_token = response.json()["session_token"]
        
        # Create and approve deposit to fund the account
        dep_resp = requests.post(
            f"{BASE_URL}/api/deposit-requests",
            headers={"Authorization": f"Bearer {user_token}"},
            json={"amount": 2000, "currency": "USD"}
        )
        assert dep_resp.status_code == 200
        request_id = dep_resp.json()["request_id"]
        
        # Admin approves
        approve_resp = requests.put(
            f"{BASE_URL}/api/admin/deposit-requests/{request_id}",
            headers={"Authorization": f"Bearer {admin_session}"},
            json={"action": "approve", "notes": "Fund for withdrawal test"}
        )
        assert approve_resp.status_code == 200
        
        print(f"✓ Funded user created with $2000 balance")
        return user_token
    
    @pytest.fixture(scope="class")
    def broker_id(self):
        """Get first available broker ID"""
        response = requests.get(f"{BASE_URL}/api/brokers")
        assert response.status_code == 200
        brokers = response.json()
        assert len(brokers) > 0, "No brokers available"
        return brokers[0]["broker_id"], brokers[0]["name"]
    
    def test_user_create_withdrawal_request(self, funded_user_session, broker_id):
        """User can create withdrawal request with broker selection"""
        broker_id_val, broker_name = broker_id
        
        response = requests.post(
            f"{BASE_URL}/api/withdrawal-requests",
            headers={"Authorization": f"Bearer {funded_user_session}"},
            json={
                "amount": 500,
                "currency": "USD",
                "broker_id": broker_id_val,
                "broker_name": broker_name,
                "broker_account": "TEST123456"
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "request_id" in data
        assert data["request_id"].startswith("wd_")
        print(f"✓ Withdrawal request created: {data['request_id']}")
    
    def test_withdrawal_insufficient_balance(self, funded_user_session, broker_id):
        """Withdrawal should fail if amount exceeds balance"""
        broker_id_val, broker_name = broker_id
        
        response = requests.post(
            f"{BASE_URL}/api/withdrawal-requests",
            headers={"Authorization": f"Bearer {funded_user_session}"},
            json={
                "amount": 999999,  # More than balance
                "currency": "USD",
                "broker_id": broker_id_val,
                "broker_name": broker_name,
                "broker_account": "TEST123456"
            }
        )
        assert response.status_code == 400
        assert "Insufficient" in response.json().get("detail", "")
        print("✓ Insufficient balance check works")
    
    def test_user_view_withdrawal_requests(self, funded_user_session):
        """User can view their withdrawal requests"""
        response = requests.get(
            f"{BASE_URL}/api/withdrawal-requests",
            headers={"Authorization": f"Bearer {funded_user_session}"}
        )
        assert response.status_code == 200
        
        requests_list = response.json()
        assert isinstance(requests_list, list)
        print(f"✓ User has {len(requests_list)} withdrawal request(s)")
    
    def test_admin_view_withdrawal_requests(self, admin_session):
        """Admin can view all withdrawal requests"""
        response = requests.get(
            f"{BASE_URL}/api/admin/withdrawal-requests",
            headers={"Authorization": f"Bearer {admin_session}"}
        )
        assert response.status_code == 200
        
        requests_list = response.json()
        assert isinstance(requests_list, list)
        print(f"✓ Admin sees {len(requests_list)} withdrawal request(s)")
    
    def test_admin_approve_withdrawal_request(self, admin_session, funded_user_session, broker_id):
        """Admin can approve withdrawal and user balance decreases"""
        broker_id_val, broker_name = broker_id
        
        # Get balance before
        me_resp = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {funded_user_session}"}
        )
        balance_before = me_resp.json().get("available_balance", {}).get("USD", 0)
        
        # Create withdrawal request
        create_resp = requests.post(
            f"{BASE_URL}/api/withdrawal-requests",
            headers={"Authorization": f"Bearer {funded_user_session}"},
            json={
                "amount": 300,
                "currency": "USD",
                "broker_id": broker_id_val,
                "broker_name": broker_name,
                "broker_account": "APPROVE_TEST"
            }
        )
        assert create_resp.status_code == 200
        request_id = create_resp.json()["request_id"]
        
        # Admin approves
        approve_resp = requests.put(
            f"{BASE_URL}/api/admin/withdrawal-requests/{request_id}",
            headers={"Authorization": f"Bearer {admin_session}"},
            json={"action": "approve", "notes": "Test withdrawal approval"}
        )
        assert approve_resp.status_code == 200, f"Approve failed: {approve_resp.text}"
        
        # Verify balance decreased
        me_resp = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {funded_user_session}"}
        )
        balance_after = me_resp.json().get("available_balance", {}).get("USD", 0)
        
        assert balance_after == balance_before - 300, f"Balance should decrease by 300. Before: {balance_before}, After: {balance_after}"
        print(f"✓ Withdrawal approved. Balance: {balance_before} -> {balance_after}")


class TestExistingPendingRequest:
    """Test the existing pending deposit request mentioned in context"""
    
    def test_existing_pending_deposit_exists(self):
        """Verify the existing $5000 pending deposit request"""
        # Login as admin
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert login_resp.status_code == 200
        admin_token = login_resp.json()["session_token"]
        
        # Get pending deposits
        response = requests.get(
            f"{BASE_URL}/api/admin/deposit-requests?status=pending",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        
        pending = response.json()
        # Check if there's a $5000 pending request
        large_deposits = [r for r in pending if r["amount"] >= 5000]
        print(f"✓ Found {len(pending)} pending deposit(s), {len(large_deposits)} >= $5000")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
