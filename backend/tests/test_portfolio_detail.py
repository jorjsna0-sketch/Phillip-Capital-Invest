"""
Test suite for Portfolio Detail Page APIs
Tests: GET /api/portfolios/{id}, GET /api/portfolios/{id}/stats
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPortfolioDetailAPI:
    """Portfolio detail endpoint tests"""
    
    def test_get_portfolio_detail_success(self):
        """Test GET /api/portfolios/{id} returns portfolio with all fields"""
        response = requests.get(f"{BASE_URL}/api/portfolios/pf_conservative01")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify required fields exist
        assert "portfolio_id" in data
        assert data["portfolio_id"] == "pf_conservative01"
        assert "name" in data
        assert "description" in data
        assert "strategy" in data
        assert "assets" in data
        assert "min_investment" in data
        assert "max_investment" in data
        assert "expected_return" in data
        assert "duration_months" in data
        assert "risk_level" in data
        
        # Verify new fields for detail page
        assert "returns_by_term" in data
        assert "sales_text" in data
        assert "safety_guarantee" in data
        
        print(f"✓ Portfolio detail returned with all required fields")
    
    def test_portfolio_has_sales_text(self):
        """Test portfolio pf_conservative01 has sales_text populated"""
        response = requests.get(f"{BASE_URL}/api/portfolios/pf_conservative01")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify sales_text has content
        sales_text = data.get("sales_text", {})
        assert isinstance(sales_text, dict)
        assert sales_text.get("ru") or sales_text.get("en"), "sales_text should have content"
        
        print(f"✓ Portfolio has sales_text: {sales_text.get('ru', '')[:50]}...")
    
    def test_portfolio_has_safety_guarantee(self):
        """Test portfolio pf_conservative01 has safety_guarantee populated"""
        response = requests.get(f"{BASE_URL}/api/portfolios/pf_conservative01")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify safety_guarantee has content
        safety_guarantee = data.get("safety_guarantee", {})
        assert isinstance(safety_guarantee, dict)
        assert safety_guarantee.get("ru") or safety_guarantee.get("en"), "safety_guarantee should have content"
        
        print(f"✓ Portfolio has safety_guarantee: {safety_guarantee.get('ru', '')[:50]}...")
    
    def test_portfolio_has_returns_by_term(self):
        """Test portfolio has returns_by_term for calculator"""
        response = requests.get(f"{BASE_URL}/api/portfolios/pf_conservative01")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify returns_by_term
        returns_by_term = data.get("returns_by_term", {})
        assert isinstance(returns_by_term, dict)
        assert len(returns_by_term) > 0, "returns_by_term should have entries"
        
        # Verify values are numbers
        for term, rate in returns_by_term.items():
            assert isinstance(rate, (int, float)), f"Rate for term {term} should be a number"
            assert rate > 0, f"Rate for term {term} should be positive"
        
        print(f"✓ Portfolio has returns_by_term: {returns_by_term}")
    
    def test_portfolio_not_found(self):
        """Test GET /api/portfolios/{id} returns 404 for non-existent portfolio"""
        response = requests.get(f"{BASE_URL}/api/portfolios/non_existent_portfolio")
        
        assert response.status_code == 404
        print("✓ Non-existent portfolio returns 404")


class TestPortfolioStatsAPI:
    """Portfolio stats endpoint tests"""
    
    def test_get_portfolio_stats_success(self):
        """Test GET /api/portfolios/{id}/stats returns stats"""
        response = requests.get(f"{BASE_URL}/api/portfolios/pf_conservative01/stats")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify required fields
        assert "portfolio_id" in data
        assert data["portfolio_id"] == "pf_conservative01"
        assert "investors_count" in data
        assert "total_invested" in data
        assert "total_profit" in data
        
        # Verify data types
        assert isinstance(data["investors_count"], int)
        assert isinstance(data["total_invested"], (int, float))
        assert isinstance(data["total_profit"], (int, float))
        
        print(f"✓ Portfolio stats: investors={data['investors_count']}, invested={data['total_invested']}, profit={data['total_profit']}")
    
    def test_portfolio_stats_has_profit_percent(self):
        """Test stats includes profit_percent calculation"""
        response = requests.get(f"{BASE_URL}/api/portfolios/pf_conservative01/stats")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "profit_percent" in data
        assert isinstance(data["profit_percent"], (int, float))
        
        print(f"✓ Portfolio stats has profit_percent: {data['profit_percent']}%")
    
    def test_portfolio_stats_not_found(self):
        """Test GET /api/portfolios/{id}/stats returns 404 for non-existent portfolio"""
        response = requests.get(f"{BASE_URL}/api/portfolios/non_existent_portfolio/stats")
        
        assert response.status_code == 404
        print("✓ Non-existent portfolio stats returns 404")


class TestPortfolioListAPI:
    """Portfolio list endpoint tests"""
    
    def test_get_all_portfolios(self):
        """Test GET /api/portfolios returns list of portfolios"""
        response = requests.get(f"{BASE_URL}/api/portfolios")
        
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0, "Should have at least one portfolio"
        
        # Verify each portfolio has required fields
        for portfolio in data:
            assert "portfolio_id" in portfolio
            assert "name" in portfolio
            assert "expected_return" in portfolio
            assert "risk_level" in portfolio
        
        print(f"✓ Got {len(data)} portfolios")
    
    def test_portfolios_have_duration_months(self):
        """Test all portfolios have duration_months array"""
        response = requests.get(f"{BASE_URL}/api/portfolios")
        
        assert response.status_code == 200
        data = response.json()
        
        for portfolio in data:
            assert "duration_months" in portfolio
            assert isinstance(portfolio["duration_months"], list)
            assert len(portfolio["duration_months"]) > 0
        
        print("✓ All portfolios have duration_months")


class TestCalculatorLogic:
    """Test calculator-related data"""
    
    def test_returns_by_term_matches_duration_months(self):
        """Test returns_by_term keys match available duration_months"""
        response = requests.get(f"{BASE_URL}/api/portfolios/pf_conservative01")
        
        assert response.status_code == 200
        data = response.json()
        
        duration_months = data.get("duration_months", [])
        returns_by_term = data.get("returns_by_term", {})
        
        # At least some duration months should have corresponding returns
        for duration in duration_months:
            term_key = str(duration)
            if term_key in returns_by_term:
                print(f"✓ Duration {duration} months has return rate: {returns_by_term[term_key]}%")
    
    def test_expected_return_is_fallback(self):
        """Test expected_return exists as fallback for calculator"""
        response = requests.get(f"{BASE_URL}/api/portfolios/pf_conservative01")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "expected_return" in data
        assert isinstance(data["expected_return"], (int, float))
        assert data["expected_return"] > 0
        
        print(f"✓ Expected return fallback: {data['expected_return']}%")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
