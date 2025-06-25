import pytest
from ninja.testing import TestClient

# Import the main API instance
from ..api import api

@pytest.fixture(scope="session")
def ninja_client():
    """Shared test client for all Ninja API tests to prevent multiple TestClient conflicts"""
    return TestClient(api)

@pytest.fixture
def test_user_id():
    """Consistent test user ID for all tests"""
    return "test_user_123"

@pytest.fixture
def alt_user_id():
    """Alternative test user ID for multi-user tests"""
    return "alt_user_456" 