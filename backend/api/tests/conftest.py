import os
import sys
import pytest
from ninja.testing import TestClient

# Set up Django before any imports
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.core.settings")

import django
django.setup()

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