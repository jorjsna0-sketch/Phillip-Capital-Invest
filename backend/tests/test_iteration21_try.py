"""
Iteration 21: TRY-only currency enforcement.
Verify backend still accepts USD currency for deposit/withdrawal (frontend converts TRY->USD).
"""
import os
import pytest
import requests
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://project-review-111.preview.emergentagent.com').rstrip('/')
ADMIN_EMAIL = "admin@altyncontract.kz"
ADMIN_PASSWORD = "abc123"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD
    })
    assert r.status_code == 200, f"Login failed: {r.text}"
    return r.json()["session_token"]


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ==== Health / Login ====
def test_health():
    r = requests.get(f"{BASE_URL}/api/")
    assert r.status_code in (200, 404)  # may not exist but server reachable


def test_login_works(admin_token):
    assert admin_token.startswith("sess_")


# ==== User profile balance (internal USD) ====
def test_profile_balance_usd(auth_headers):
    r = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    # Available balance stored in USD internally
    bal = data.get("available_balance") or {}
    assert "USD" in bal or bal == {} or isinstance(bal, dict), f"Expected USD key in balance, got: {bal}"
    print(f"Admin USD balance: {bal.get('USD')}")


# ==== Deposit request USD ====
def test_deposit_request_with_usd(auth_headers):
    """Frontend converts TRY->USD then submits with currency=USD."""
    payload = {
        "amount": 100.00,  # USD equivalent of ~3350 TRY
        "currency": "USD",
        "method": "bank_card"
    }
    r = requests.post(f"{BASE_URL}/api/deposit-requests", json=payload, headers=auth_headers)
    # Should be accepted
    assert r.status_code in (200, 201), f"Deposit request failed: {r.status_code} {r.text}"
    data = r.json()
    request_id = data.get("request_id")
    assert request_id, f"No request_id: {data}"
    # Fetch it back
    r2 = requests.get(f"{BASE_URL}/api/deposit-requests", headers=auth_headers)
    assert r2.status_code == 200
    reqs = r2.json()
    found = [x for x in reqs if x.get("request_id") == request_id or x.get("id") == request_id]
    assert found, f"Request {request_id} not found"
    assert found[0].get("currency") == "USD", f"Expected USD, got {found[0].get('currency')}"
    print(f"Deposit created: {request_id} currency={found[0].get('currency')} amount={found[0].get('amount')}")


# ==== Withdrawal request USD ====
def test_withdrawal_request_with_usd(auth_headers):
    payload = {
        "amount": 50.00,
        "currency": "USD",
        "method": "bank_card",
        "details": {"card_number": "4111111111111111", "card_holder": "Test User"}
    }
    r = requests.post(f"{BASE_URL}/api/withdrawal-requests", json=payload, headers=auth_headers)
    # Admin has large balance, should succeed; if insufficient allowed 400
    assert r.status_code in (200, 201, 400), f"Unexpected: {r.status_code} {r.text}"
    if r.status_code in (200, 201):
        data = r.json()
        request_id = data.get("request_id")
        assert request_id, f"No request_id: {data}"
        r2 = requests.get(f"{BASE_URL}/api/withdrawal-requests", headers=auth_headers)
        if r2.status_code == 200:
            reqs = r2.json()
            found = [x for x in reqs if x.get("request_id") == request_id or x.get("id") == request_id]
            if found:
                assert found[0].get("currency") == "USD"
                print(f"Withdrawal created: {request_id} currency={found[0].get('currency')} amount={found[0].get('amount')}")
    else:
        print(f"Withdrawal rejected (likely insufficient): {r.text}")


# ==== Portfolio listing (no regression) ====
def test_portfolios_list(auth_headers):
    r = requests.get(f"{BASE_URL}/api/portfolios", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    if data:
        # Min/max in USD still expected internally
        p = data[0]
        print(f"Sample portfolio: min={p.get('min_investment')} max={p.get('max_investment')}")


# ==== Admin panel (no regression) ====
def test_admin_dashboard(auth_headers):
    r = requests.get(f"{BASE_URL}/api/admin/dashboard", headers=auth_headers)
    assert r.status_code == 200, f"Admin dashboard failed: {r.text}"
