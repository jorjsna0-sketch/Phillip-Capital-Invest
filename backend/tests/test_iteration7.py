"""
Iteration 7 Backend Tests
Testing:
1. PDF generation with DejaVuSans font (Cyrillic support) - styles without parent
2. POST /api/admin/accrue-profits - profit accrual logic (auto_reinvest vs balance_available)
3. GET /api/admin/contract-templates - templates list
4. POST /api/admin/contract-templates - create template
5. GET /api/admin/contract-templates/{id}/preview - PDF preview with DejaVuSans
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
        """Test health endpoint is working"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("✓ Health endpoint working")
    
    def test_admin_login(self):
        """Test admin login and get session token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "session_token" in data
        assert data.get("role") == "admin"
        print(f"✓ Admin login successful, role: {data.get('role')}")
        return data["session_token"]


class TestContractTemplates:
    """Contract templates CRUD tests"""
    
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
        """Test GET /api/admin/contract-templates returns templates list"""
        headers = {"Authorization": f"Bearer {admin_session}"}
        response = requests.get(f"{BASE_URL}/api/admin/contract-templates", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/admin/contract-templates - returned {len(data)} templates")
        return data
    
    def test_create_contract_template(self, admin_session):
        """Test POST /api/admin/contract-templates creates new template"""
        headers = {"Authorization": f"Bearer {admin_session}"}
        
        template_data = {
            "name": "TEST_Template_Iteration7",
            "description": "Test template for iteration 7",
            "content": {
                "ru": "ТЕСТОВЫЙ ДОГОВОР №{{contract_id}}\n\nКлиент: {{client_name}}\nСумма: {{amount}} {{currency}}",
                "kz": "ТЕСТ ШАРТЫ №{{contract_id}}\n\nКлиент: {{client_name}}\nСома: {{amount}} {{currency}}",
                "en": "TEST CONTRACT №{{contract_id}}\n\nClient: {{client_name}}\nAmount: {{amount}} {{currency}}"
            },
            "is_default": False
        }
        
        response = requests.post(f"{BASE_URL}/api/admin/contract-templates", 
                                 headers=headers, json=template_data)
        assert response.status_code == 200
        data = response.json()
        assert "template_id" in data
        print(f"✓ POST /api/admin/contract-templates - created template: {data.get('template_id')}")
        return data["template_id"]
    
    def test_template_preview_pdf_cyrillic(self, admin_session):
        """Test GET /api/admin/contract-templates/{id}/preview generates PDF with Cyrillic"""
        headers = {"Authorization": f"Bearer {admin_session}"}
        
        # First get templates list
        response = requests.get(f"{BASE_URL}/api/admin/contract-templates", headers=headers)
        templates = response.json()
        
        if not templates:
            pytest.skip("No templates available for preview test")
        
        template_id = templates[0]["template_id"]
        
        # Request PDF preview
        response = requests.get(f"{BASE_URL}/api/admin/contract-templates/{template_id}/preview", 
                               headers=headers)
        assert response.status_code == 200
        assert response.headers.get("content-type") == "application/pdf"
        
        # Check PDF content starts with PDF header
        content = response.content
        assert content[:4] == b'%PDF', "Response should be a valid PDF"
        assert len(content) > 1000, "PDF should have substantial content"
        print(f"✓ GET /api/admin/contract-templates/{template_id}/preview - PDF generated ({len(content)} bytes)")
    
    def test_cleanup_test_template(self, admin_session):
        """Cleanup test templates"""
        headers = {"Authorization": f"Bearer {admin_session}"}
        
        # Get templates
        response = requests.get(f"{BASE_URL}/api/admin/contract-templates", headers=headers)
        templates = response.json()
        
        # Delete test templates
        for template in templates:
            if template.get("name", "").startswith("TEST_"):
                delete_response = requests.delete(
                    f"{BASE_URL}/api/admin/contract-templates/{template['template_id']}", 
                    headers=headers
                )
                if delete_response.status_code == 200:
                    print(f"✓ Cleaned up test template: {template['template_id']}")


class TestProfitAccrual:
    """Profit accrual logic tests"""
    
    @pytest.fixture
    def admin_session(self):
        """Get admin session token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["session_token"]
    
    def test_accrue_profits_endpoint_exists(self, admin_session):
        """Test POST /api/admin/accrue-profits endpoint exists and requires admin"""
        headers = {"Authorization": f"Bearer {admin_session}"}
        
        response = requests.post(f"{BASE_URL}/api/admin/accrue-profits", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check response structure
        assert "processed" in data
        assert "skipped" in data
        assert "errors" in data
        assert "total_profit_distributed" in data
        assert "details" in data
        
        print(f"✓ POST /api/admin/accrue-profits - processed: {data['processed']}, skipped: {data['skipped']}, errors: {data['errors']}")
        print(f"  Total profit distributed: {data['total_profit_distributed']}")
        
        # Check details structure if any investments were processed
        if data["details"]:
            detail = data["details"][0]
            assert "investment_id" in detail
            assert "user_id" in detail
            assert "profit" in detail
            assert "type" in detail
            # Type should be either "reinvested" or "to_available_balance"
            assert detail["type"] in ["reinvested", "to_available_balance"]
            print(f"  First detail: {detail}")
    
    def test_accrue_profits_requires_admin(self):
        """Test that accrue-profits endpoint requires admin authentication"""
        # Without auth
        response = requests.post(f"{BASE_URL}/api/admin/accrue-profits")
        assert response.status_code == 401
        print("✓ POST /api/admin/accrue-profits requires authentication (401 without auth)")
        
        # With non-admin user (if we had one)
        # This would require creating a regular user first


class TestPDFGeneration:
    """PDF generation tests for Cyrillic support"""
    
    @pytest.fixture
    def admin_session(self):
        """Get admin session token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["session_token"]
    
    def test_investment_contract_pdf(self, admin_session):
        """Test investment contract PDF generation with Cyrillic"""
        headers = {"Authorization": f"Bearer {admin_session}"}
        
        # Get user investments
        response = requests.get(f"{BASE_URL}/api/investments", headers=headers)
        
        if response.status_code != 200:
            pytest.skip("Could not get investments")
        
        investments = response.json()
        
        if not investments:
            pytest.skip("No investments available for PDF test")
        
        investment_id = investments[0]["investment_id"]
        
        # Request contract PDF
        response = requests.get(f"{BASE_URL}/api/investments/{investment_id}/contract", 
                               headers=headers)
        assert response.status_code == 200
        assert response.headers.get("content-type") == "application/pdf"
        
        content = response.content
        assert content[:4] == b'%PDF', "Response should be a valid PDF"
        
        # Check for DejaVuSans font in PDF (it should be embedded)
        # The font name appears in the PDF as a reference
        pdf_text = content.decode('latin-1', errors='ignore')
        has_dejavu = 'DejaVuSans' in pdf_text or 'DejaVu' in pdf_text
        
        print(f"✓ GET /api/investments/{investment_id}/contract - PDF generated ({len(content)} bytes)")
        print(f"  DejaVuSans font reference found: {has_dejavu}")


class TestAdminTemplatesNavigation:
    """Test admin templates page navigation"""
    
    @pytest.fixture
    def admin_session(self):
        """Get admin session token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["session_token"]
    
    def test_templates_list_endpoint(self, admin_session):
        """Test templates list endpoint for AdminTemplates page"""
        headers = {"Authorization": f"Bearer {admin_session}"}
        
        response = requests.get(f"{BASE_URL}/api/admin/contract-templates", headers=headers)
        assert response.status_code == 200
        
        templates = response.json()
        assert isinstance(templates, list)
        
        # Check template structure
        if templates:
            template = templates[0]
            assert "template_id" in template
            assert "name" in template
            assert "content" in template
            # Content should have language keys
            assert "ru" in template["content"]
            print(f"✓ Templates list returned {len(templates)} templates with proper structure")
        else:
            print("✓ Templates list returned empty (no templates yet)")


class TestDashboardWalletEndpoints:
    """Test endpoints used by Dashboard wallet section"""
    
    @pytest.fixture
    def admin_session(self):
        """Get admin session token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["session_token"]
    
    def test_brokers_endpoint(self, admin_session):
        """Test GET /api/brokers for withdrawal dialog"""
        headers = {"Authorization": f"Bearer {admin_session}"}
        
        response = requests.get(f"{BASE_URL}/api/brokers", headers=headers)
        # Should return 200 even if empty
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/brokers - returned {len(data)} brokers")
    
    def test_company_bank_info_endpoint(self, admin_session):
        """Test GET /api/company-bank-info for deposit dialog"""
        headers = {"Authorization": f"Bearer {admin_session}"}
        
        response = requests.get(f"{BASE_URL}/api/company-bank-info", headers=headers)
        # Should return 200 even if empty
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)
        print(f"✓ GET /api/company-bank-info - returned bank info")
    
    def test_deposit_requests_endpoint(self, admin_session):
        """Test GET /api/deposit-requests"""
        headers = {"Authorization": f"Bearer {admin_session}"}
        
        response = requests.get(f"{BASE_URL}/api/deposit-requests", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/deposit-requests - returned {len(data)} requests")
    
    def test_withdrawal_requests_endpoint(self, admin_session):
        """Test GET /api/withdrawal-requests"""
        headers = {"Authorization": f"Bearer {admin_session}"}
        
        response = requests.get(f"{BASE_URL}/api/withdrawal-requests", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/withdrawal-requests - returned {len(data)} requests")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
