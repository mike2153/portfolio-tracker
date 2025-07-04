"""
Test Performance API Authentication and CORS behavior
Tests for the 500/CORS bug fix in dashboard performance endpoint
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch
import logging

# Configure logging for debugging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

@pytest.fixture
def client():
    """Create test client for FastAPI app"""
    from main import app
    logger.info("🧪 [test_performance_api_auth] Creating TestClient")
    return TestClient(app)

@pytest.fixture
def mock_jwt_token():
    """Mock JWT token for testing"""
    return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"

@pytest.fixture  
def mock_user_data():
    """Mock authenticated user data"""
    return {
        "id": "test-user-id-123",
        "email": "test@example.com",
        "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
    }

class TestPerformanceAPIAuthentication:
    """Test suite for Performance API authentication behavior"""
    
    def test_performance_authenticated_success(self, client, mock_jwt_token, mock_user_data):
        """Test authenticated request succeeds with proper JWT"""
        logger.info("🧪 [test_performance_authenticated_success] Starting test")
        logger.info("🧪 Mock JWT token: %s", mock_jwt_token[:50] + "...")
        logger.info("🧪 Mock user data: %s", mock_user_data)
        
        url = "/api/dashboard/performance?period=1M&benchmark=SPY"
        headers = {"Authorization": f"Bearer {mock_jwt_token}"}
        
        logger.info("🧪 Making request to: %s", url)
        logger.info("🧪 Request headers: %s", headers)
        
        # Mock the authentication dependency
        with patch('backend_api_routes.backend_api_dashboard.require_authenticated_user') as mock_auth:
            mock_auth.return_value = mock_user_data
            logger.info("🧪 Mocked require_authenticated_user to return: %s", mock_user_data)
            
            # Mock the portfolio and index services to avoid database calls
            with patch('services.portfolio_service.PortfolioTimeSeriesService.get_portfolio_series') as mock_portfolio, \
                 patch('services.index_sim_service.IndexSimulationService.get_index_sim_series') as mock_index:
                
                # Configure mocks to return test data
                mock_portfolio.return_value = [("2024-01-01", 1000.0), ("2024-01-02", 1050.0)]
                mock_index.return_value = [("2024-01-01", 950.0), ("2024-01-02", 980.0)]
                
                logger.info("🧪 Configured service mocks")
                
                # Make the authenticated request
                response = client.get(url, headers=headers)
                
                logger.info("🧪 Response status: %s", response.status_code)
                logger.info("🧪 Response headers: %s", dict(response.headers))
                logger.info("🧪 Response body: %s", response.text[:200] + "..." if len(response.text) > 200 else response.text)
        
        # Verify successful response
        assert response.status_code == 200
        logger.info("✅ [test_performance_authenticated_success] Test passed - got 200 status")
        
        # Verify CORS headers are present
        assert "access-control-allow-origin" in response.headers
        logger.info("✅ [test_performance_authenticated_success] CORS headers present")
        
        # Verify response structure
        response_data = response.json()
        assert "success" in response_data
        assert response_data["success"] is True
        logger.info("✅ [test_performance_authenticated_success] Response structure valid")

    def test_performance_unauthenticated_returns_401(self, client):
        """Test unauthenticated request returns 401 with CORS headers"""
        logger.info("🧪 [test_performance_unauthenticated_returns_401] Starting test")
        
        url = "/api/dashboard/performance?period=1M&benchmark=SPY"
        
        logger.info("🧪 Making unauthenticated request to: %s", url)
        logger.info("🧪 No Authorization header will be sent")
        
        # Mock authentication to simulate no user
        with patch('backend_api_routes.backend_api_dashboard.require_authenticated_user') as mock_auth:
            mock_auth.side_effect = Exception("No authentication provided")
            logger.info("🧪 Mocked require_authenticated_user to raise exception")
            
            # Make the unauthenticated request
            response = client.get(url)
            
            logger.info("🧪 Response status: %s", response.status_code)
            logger.info("🧪 Response headers: %s", dict(response.headers))
            logger.info("🧪 Response body: %s", response.text)
        
        # Verify 401 response (should be caught by early auth validation)
        assert response.status_code == 401
        logger.info("✅ [test_performance_unauthenticated_returns_401] Test passed - got 401 status")
        
        # Verify CORS headers are present even in error response
        assert "access-control-allow-origin" in response.headers
        logger.info("✅ [test_performance_unauthenticated_returns_401] CORS headers present in error response")

    def test_performance_missing_bearer_token_returns_401(self, client):
        """Test request with missing Bearer token returns 401"""
        logger.info("🧪 [test_performance_missing_bearer_token_returns_401] Starting test")
        
        url = "/api/dashboard/performance?period=1M&benchmark=SPY"
        headers = {"Authorization": "InvalidTokenFormat"}
        
        logger.info("🧪 Making request with invalid Authorization header: %s", headers["Authorization"])
        
        # Make request with invalid auth header
        response = client.get(url, headers=headers)
        
        logger.info("🧪 Response status: %s", response.status_code)
        logger.info("🧪 Response headers: %s", dict(response.headers))
        logger.info("🧪 Response body: %s", response.text)
        
        # Verify 401 response
        assert response.status_code == 401
        logger.info("✅ [test_performance_missing_bearer_token_returns_401] Test passed - got 401 status")
        
        # Verify CORS headers
        assert "access-control-allow-origin" in response.headers
        logger.info("✅ [test_performance_missing_bearer_token_returns_401] CORS headers present")

    def test_performance_invalid_benchmark_returns_400(self, client, mock_jwt_token, mock_user_data):
        """Test request with invalid benchmark returns 400"""
        logger.info("🧪 [test_performance_invalid_benchmark_returns_400] Starting test")
        
        url = "/api/dashboard/performance?period=1M&benchmark=INVALID123"
        headers = {"Authorization": f"Bearer {mock_jwt_token}"}
        
        logger.info("🧪 Making request with invalid benchmark: INVALID123")
        
        # Mock authentication
        with patch('backend_api_routes.backend_api_dashboard.require_authenticated_user') as mock_auth:
            mock_auth.return_value = mock_user_data
            
            response = client.get(url, headers=headers)
            
            logger.info("🧪 Response status: %s", response.status_code)
            logger.info("🧪 Response body: %s", response.text)
        
        # Should get 422 due to regex validation or 400 from business logic
        assert response.status_code in [400, 422]
        logger.info("✅ [test_performance_invalid_benchmark_returns_400] Test passed - got expected error status")

if __name__ == "__main__":
    logger.info("🧪 Running performance API authentication tests directly")
    pytest.main([__file__, "-v", "--tb=short"])