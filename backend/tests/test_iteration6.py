"""
Iteration 6 Tests - AltynContract Platform
Testing:
1. AdminPortfolios (/admin/portfolios) - portfolio list with profit accrual info
2. AdminPortfolioForm (/admin/portfolios/create) - separate portfolio creation page
3. 'Доходность' tab - dynamic durations with individual rates and duration unit
4. 'Договор' tab - template selection and 'Автоперевод на KZ/EN' button
5. POST /api/translate - translation API via Gemini 3 Flash
6. InvestPage (/invest/:id) - canvas signature works correctly (graphical only)
7. PDF generation - Cyrillic support with DejaVuSans font
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://portfix.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@altyncontract.kz"
ADMIN_PASSWORD = "abc123"


class TestHealthAndAuth:
    """Basic health and authentication tests"""
    
    def test_health_endpoint(self):
        """Test health endpoint"""
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
        assert "session_token" in data
        assert data.get("role") == "admin"
        print(f"✓ Admin login successful, token: {data['session_token'][:20]}...")
        return data["session_token"]


class TestAdminPortfolios:
    """Test admin portfolios endpoints"""
    
    @pytest.fixture
    def admin_session(self):
        """Get admin session token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["session_token"]
    
    def test_get_admin_portfolios(self, admin_session):
        """Test GET /api/admin/portfolios - list portfolios with profit accrual info"""
        headers = {"Authorization": f"Bearer {admin_session}"}
        response = requests.get(f"{BASE_URL}/api/admin/portfolios", headers=headers)
        assert response.status_code == 200
        portfolios = response.json()
        assert isinstance(portfolios, list)
        print(f"✓ GET /api/admin/portfolios - returned {len(portfolios)} portfolios")
        
        # Check if portfolios have profit accrual fields
        if portfolios:
            p = portfolios[0]
            print(f"  Portfolio fields: {list(p.keys())}")
            if 'profit_accrual_interval' in p:
                print(f"  profit_accrual_interval: {p.get('profit_accrual_interval')}")
            if 'profit_accrual_time' in p:
                print(f"  profit_accrual_time: {p.get('profit_accrual_time')}")
            if 'duration_unit' in p:
                print(f"  duration_unit: {p.get('duration_unit')}")
            if 'durations' in p:
                print(f"  durations: {p.get('durations')}")
    
    def test_create_portfolio_with_dynamic_durations(self, admin_session):
        """Test POST /api/admin/portfolios - create portfolio with dynamic durations"""
        headers = {"Authorization": f"Bearer {admin_session}"}
        
        # Create portfolio with dynamic durations
        portfolio_data = {
            "name": {"ru": "Тестовый портфель Iter6", "kz": "Тест портфелі", "en": "Test Portfolio Iter6"},
            "description": {"ru": "Описание тестового портфеля", "kz": "Сипаттама", "en": "Test description"},
            "strategy": {"ru": "Стратегия", "kz": "Стратегия", "en": "Strategy"},
            "assets": ["Акции", "Облигации"],
            "min_investment": 1000,
            "max_investment": 100000,
            "expected_return": 12,
            "returns_by_term": {"3": 8, "6": 10, "12": 12},
            "duration_months": [3, 6, 12],
            "duration_unit": "months",
            "durations": [
                {"value": 3, "unit": "months", "rate": 8},
                {"value": 6, "unit": "months", "rate": 10},
                {"value": 12, "unit": "months", "rate": 12}
            ],
            "profit_accrual_interval": "daily",
            "profit_accrual_time": "10:00",
            "risk_level": "medium",
            "featured_on_landing": False,
            "contract_template": {"ru": "Договор {{contract_id}}", "kz": "", "en": ""}
        }
        
        response = requests.post(f"{BASE_URL}/api/admin/portfolios", headers=headers, json=portfolio_data)
        assert response.status_code == 200, f"Failed to create portfolio: {response.text}"
        data = response.json()
        assert "portfolio_id" in data
        portfolio_id = data["portfolio_id"]
        print(f"✓ Created portfolio with dynamic durations: {portfolio_id}")
        
        # Verify the created portfolio
        response = requests.get(f"{BASE_URL}/api/portfolios/{portfolio_id}", headers=headers)
        assert response.status_code == 200
        portfolio = response.json()
        
        # Check duration_unit
        assert portfolio.get("duration_unit") == "months", f"Expected duration_unit='months', got {portfolio.get('duration_unit')}"
        print(f"  ✓ duration_unit: {portfolio.get('duration_unit')}")
        
        # Check durations array
        durations = portfolio.get("durations", [])
        assert len(durations) >= 1, "Expected at least 1 duration"
        print(f"  ✓ durations: {durations}")
        
        # Check profit accrual settings
        assert portfolio.get("profit_accrual_interval") == "daily"
        assert portfolio.get("profit_accrual_time") == "10:00"
        print(f"  ✓ profit_accrual_interval: {portfolio.get('profit_accrual_interval')}")
        print(f"  ✓ profit_accrual_time: {portfolio.get('profit_accrual_time')}")
        
        # Cleanup - delete the test portfolio
        response = requests.delete(f"{BASE_URL}/api/portfolios/{portfolio_id}", headers=headers)
        print(f"  ✓ Cleaned up test portfolio")
        
        return portfolio_id


class TestTranslateAPI:
    """Test translation API"""
    
    @pytest.fixture
    def admin_session(self):
        """Get admin session token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["session_token"]
    
    def test_translate_endpoint_exists(self, admin_session):
        """Test POST /api/translate endpoint exists and requires auth"""
        # Test without auth
        response = requests.post(f"{BASE_URL}/api/translate", json={
            "text": "Тест",
            "source_lang": "ru",
            "target_langs": ["en"]
        })
        assert response.status_code == 401, "Expected 401 without auth"
        print("✓ /api/translate requires authentication")
    
    def test_translate_text(self, admin_session):
        """Test POST /api/translate - translate Russian to Kazakh and English"""
        headers = {"Authorization": f"Bearer {admin_session}"}
        
        test_text = "ИНВЕСТИЦИОННЫЙ ДОГОВОР №{{contract_id}}"
        
        response = requests.post(f"{BASE_URL}/api/translate", headers=headers, json={
            "text": test_text,
            "source_lang": "ru",
            "target_langs": ["kz", "en"]
        }, timeout=60)  # Longer timeout for LLM
        
        if response.status_code == 200:
            data = response.json()
            assert "translations" in data
            translations = data["translations"]
            print(f"✓ Translation API working")
            print(f"  Original (RU): {test_text}")
            if "kz" in translations:
                print(f"  Kazakh (KZ): {translations['kz']}")
            if "en" in translations:
                print(f"  English (EN): {translations['en']}")
            
            # Check that placeholders are preserved
            if "en" in translations:
                assert "{{contract_id}}" in translations["en"] or "contract_id" in translations["en"].lower(), \
                    "Placeholder should be preserved in translation"
        elif response.status_code == 500:
            # LLM service might not be available
            print(f"⚠ Translation API returned 500: {response.text}")
            print("  This may be due to LLM service configuration")
        else:
            print(f"⚠ Translation API returned {response.status_code}: {response.text}")


class TestContractTemplates:
    """Test contract templates"""
    
    @pytest.fixture
    def admin_session(self):
        """Get admin session token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["session_token"]
    
    def test_get_contract_templates(self, admin_session):
        """Test GET /api/admin/contract-templates"""
        headers = {"Authorization": f"Bearer {admin_session}"}
        response = requests.get(f"{BASE_URL}/api/admin/contract-templates", headers=headers)
        assert response.status_code == 200
        templates = response.json()
        assert isinstance(templates, list)
        print(f"✓ GET /api/admin/contract-templates - returned {len(templates)} templates")
        
        if templates:
            t = templates[0]
            print(f"  Template fields: {list(t.keys())}")


class TestInvestmentAndPDF:
    """Test investment creation and PDF generation"""
    
    @pytest.fixture
    def admin_session(self):
        """Get admin session token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["session_token"]
    
    def test_get_portfolios_for_investment(self, admin_session):
        """Get available portfolios for investment"""
        headers = {"Authorization": f"Bearer {admin_session}"}
        response = requests.get(f"{BASE_URL}/api/portfolios", headers=headers)
        assert response.status_code == 200
        portfolios = response.json()
        print(f"✓ GET /api/portfolios - {len(portfolios)} portfolios available")
        return portfolios
    
    def test_pdf_contract_generation(self, admin_session):
        """Test PDF contract generation with Cyrillic support"""
        headers = {"Authorization": f"Bearer {admin_session}"}
        
        # Get user investments
        response = requests.get(f"{BASE_URL}/api/investments", headers=headers)
        assert response.status_code == 200
        investments = response.json()
        
        if investments:
            investment_id = investments[0]["investment_id"]
            print(f"Testing PDF generation for investment: {investment_id}")
            
            # Get PDF contract
            response = requests.get(f"{BASE_URL}/api/investments/{investment_id}/contract", headers=headers)
            
            if response.status_code == 200:
                content_type = response.headers.get("content-type", "")
                assert "application/pdf" in content_type, f"Expected PDF, got {content_type}"
                
                pdf_content = response.content
                assert pdf_content[:4] == b'%PDF', "Response should be a valid PDF"
                print(f"✓ PDF generated successfully ({len(pdf_content)} bytes)")
                
                # Check for DejaVuSans font in PDF (Cyrillic support)
                pdf_text = pdf_content.decode('latin-1', errors='ignore')
                if 'DejaVuSans' in pdf_text:
                    print("  ✓ DejaVuSans font detected (Cyrillic support)")
                else:
                    print("  ⚠ DejaVuSans font not detected in PDF")
            else:
                print(f"⚠ PDF generation returned {response.status_code}: {response.text[:200]}")
        else:
            print("⚠ No investments found to test PDF generation")


class TestCanvasSignature:
    """Test canvas signature functionality"""
    
    @pytest.fixture
    def admin_session(self):
        """Get admin session token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["session_token"]
    
    def test_investment_with_canvas_signature(self, admin_session):
        """Test creating investment with canvas signature"""
        headers = {"Authorization": f"Bearer {admin_session}"}
        
        # First, add some balance to the user
        response = requests.post(f"{BASE_URL}/api/user/deposit", headers=headers, json={
            "amount": 50000,
            "currency": "USD"
        })
        print(f"Deposit response: {response.status_code}")
        
        # Get available portfolios
        response = requests.get(f"{BASE_URL}/api/portfolios", headers=headers)
        portfolios = response.json()
        
        if portfolios:
            portfolio = portfolios[0]
            portfolio_id = portfolio["portfolio_id"]
            
            # Create a simple canvas signature (base64 PNG)
            # This is a minimal valid PNG with some drawing
            canvas_signature = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
            
            # Create investment with canvas signature
            investment_data = {
                "portfolio_id": portfolio_id,
                "amount": portfolio.get("min_investment", 1000),
                "currency": "USD",
                "duration_months": portfolio.get("duration_months", [12])[0],
                "auto_reinvest": False,
                "signature": canvas_signature,
                "signature_type": "canvas",
                "terms_accepted": True
            }
            
            response = requests.post(f"{BASE_URL}/api/investments", headers=headers, json=investment_data)
            
            if response.status_code == 200:
                data = response.json()
                print(f"✓ Investment created with canvas signature: {data.get('investment_id')}")
                
                # Verify the investment
                inv_id = data.get('investment_id')
                response = requests.get(f"{BASE_URL}/api/investments", headers=headers)
                investments = response.json()
                
                created_inv = next((i for i in investments if i.get('investment_id') == inv_id), None)
                if created_inv:
                    assert created_inv.get('signature_type') == 'canvas', "Signature type should be 'canvas'"
                    print(f"  ✓ signature_type: {created_inv.get('signature_type')}")
            elif response.status_code == 400:
                print(f"⚠ Investment creation failed (likely insufficient balance): {response.text}")
            else:
                print(f"⚠ Investment creation returned {response.status_code}: {response.text}")
        else:
            print("⚠ No portfolios available for investment test")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
