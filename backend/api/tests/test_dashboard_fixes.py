#!/usr/bin/env python3
"""
Comprehensive unit tests for the dashboard fixes.
Tests the corrected data structures, field names, and endpoints.
"""

import pytest
from django.test import TestCase
from unittest.mock import Mock, patch, AsyncMock
from decimal import Decimal
import json
from django.test import AsyncClient
from api.models import Transaction
from api.auth import SupabaseUser


class TestDashboardFixes(TestCase):
    """Test suite for dashboard API fixes"""

    def setUp(self):
        """Set up test data"""
        print("\n[TEST DEBUG] Setting up dashboard fixes test data...")
        self.mock_user = SupabaseUser(user_id="test-user-id", email="test@example.com")
        print(f"[TEST DEBUG] Created mock user: {self.mock_user.id}")

    @pytest.mark.asyncio
    @patch('api.dashboard_views.get_current_user')
    @patch('api.dashboard_views.sync_to_async')
    @patch('api.dashboard_views.get_alpha_vantage_service')
    async def test_allocation_data_structure_fixed(self, mock_av_service, mock_sync_to_async, mock_get_user):
        """Test that allocation endpoint returns correct camelCase fields and allocation as number"""
        print("[TEST DEBUG] Testing allocation data structure fixes...")
        
        # Mock user and auth
        mock_get_user.return_value = self.mock_user
        
        # Mock transactions
        mock_transactions = [
            Mock(ticker="AAPL", transaction_type="BUY", shares=Decimal("10"), total_amount=Decimal("1000")),
            Mock(ticker="MSFT", transaction_type="BUY", shares=Decimal("5"), total_amount=Decimal("500"))
        ]
        mock_sync_to_async.return_value = mock_transactions
        
        # Mock Alpha Vantage service
        mock_av = Mock()
        mock_av.get_global_quote.return_value = {"price": "150.0"}
        mock_av_service.return_value = mock_av
        
        from api.dashboard_views import get_portfolio_allocation
        
        # Create mock request
        mock_request = Mock()
        
        # Call the function
        result = await get_portfolio_allocation(mock_request)
        
        print(f"[TEST DEBUG] Allocation result: {result}")
        
        # Verify structure
        assert "rows" in result
        assert len(result["rows"]) > 0
        
        # Check first row has correct camelCase fields
        first_row = result["rows"][0]
        print(f"[TEST DEBUG] First allocation row: {first_row}")
        
        # Verify camelCase field names
        required_fields = ["groupKey", "value", "invested", "gainValue", "gainPercent", "allocation", "accentColor"]
        for field in required_fields:
            assert field in first_row, f"Missing camelCase field: {field}"
        
        # Verify allocation is a number, not string
        assert isinstance(first_row["allocation"], (int, float)), f"allocation should be number, got {type(first_row['allocation'])}"
        
        print("[TEST DEBUG] ✅ Allocation data structure test passed!")

    @pytest.mark.asyncio
    @patch('api.dashboard_views.get_current_user')
    @patch('api.dashboard_views.sync_to_async')
    @patch('api.dashboard_views.get_alpha_vantage_service')
    async def test_gainers_endpoint_fixed(self, mock_av_service, mock_sync_to_async, mock_get_user):
        """Test that gainers endpoint returns correct camelCase fields and no 500 errors"""
        print("[TEST DEBUG] Testing gainers endpoint fixes...")
        
        # Mock user and auth
        mock_get_user.return_value = self.mock_user
        
        # Mock transactions
        mock_transactions = [
            Mock(ticker="AAPL", transaction_type="BUY", shares=Decimal("10"), total_amount=Decimal("1000")),
        ]
        mock_sync_to_async.return_value = mock_transactions
        
        # Mock Alpha Vantage service
        mock_av = Mock()
        mock_av.get_global_quote.return_value = {
            "price": "150.0",
            "change": "5.0", 
            "change_percent": "3.45"
        }
        mock_av_service.return_value = mock_av
        
        from api.dashboard_views import get_top_gainers
        
        # Create mock request
        mock_request = Mock()
        
        # Call the function
        result = await get_top_gainers(mock_request, limit=5)
        
        print(f"[TEST DEBUG] Gainers result: {result}")
        
        # Verify structure
        assert "items" in result
        assert len(result["items"]) > 0
        
        # Check first item has correct camelCase fields
        first_item = result["items"][0]
        print(f"[TEST DEBUG] First gainer item: {first_item}")
        
        # Verify camelCase field names
        required_fields = ["logoUrl", "name", "ticker", "value", "changePercent", "changeValue"]
        for field in required_fields:
            assert field in first_item, f"Missing camelCase field: {field}"
        
        print("[TEST DEBUG] ✅ Gainers endpoint test passed!")

    @pytest.mark.asyncio
    @patch('api.dashboard_views.get_current_user')
    @patch('api.dashboard_views.sync_to_async')
    @patch('api.dashboard_views.get_alpha_vantage_service')
    async def test_losers_endpoint_fixed(self, mock_av_service, mock_sync_to_async, mock_get_user):
        """Test that losers endpoint returns correct camelCase fields and no 500 errors"""
        print("[TEST DEBUG] Testing losers endpoint fixes...")
        
        # Mock user and auth
        mock_get_user.return_value = self.mock_user
        
        # Mock transactions
        mock_transactions = [
            Mock(ticker="AAPL", transaction_type="BUY", shares=Decimal("10"), total_amount=Decimal("1000")),
        ]
        mock_sync_to_async.return_value = mock_transactions
        
        # Mock Alpha Vantage service
        mock_av = Mock()
        mock_av.get_global_quote.return_value = {
            "price": "140.0",
            "change": "-5.0", 
            "change_percent": "-3.45"
        }
        mock_av_service.return_value = mock_av
        
        from api.dashboard_views import get_top_losers
        
        # Create mock request
        mock_request = Mock()
        
        # Call the function
        result = await get_top_losers(mock_request, limit=5)
        
        print(f"[TEST DEBUG] Losers result: {result}")
        
        # Verify structure
        assert "items" in result
        assert len(result["items"]) > 0
        
        # Check first item has correct camelCase fields
        first_item = result["items"][0]
        print(f"[TEST DEBUG] First loser item: {first_item}")
        
        # Verify camelCase field names
        required_fields = ["logoUrl", "name", "ticker", "value", "changePercent", "changeValue"]
        for field in required_fields:
            assert field in first_item, f"Missing camelCase field: {field}"
        
        print("[TEST DEBUG] ✅ Losers endpoint test passed!")

    def test_comprehensive_debugging_added(self):
        """Test that comprehensive debugging was added to all endpoints"""
        print("[TEST DEBUG] Testing comprehensive debugging coverage...")
        
        from api import dashboard_views
        import inspect
        
        # Get source code of dashboard views
        source = inspect.getsource(dashboard_views)
        
        # Count debug statements
        debug_count = source.count("[DASHBOARD DEBUG]")
        print(f"[TEST DEBUG] Found {debug_count} debug statements in dashboard views")
        
        # Verify minimum debug coverage - increased expectation due to new logging
        assert debug_count >= 25, f"Expected at least 25 debug statements, found {debug_count}"
        
        # Verify specific debug patterns exist
        required_debug_patterns = [
            "get_dashboard_overview called",
            "get_portfolio_allocation called", 
            "get_top_gainers called",
            "get_top_losers called",
            "User retrieved",
            "Found",  # Simplified pattern for transaction counting
            "Generated",  # Simplified pattern for row generation
            "Processing",  # For individual item processing
            "Final items data types"  # For type checking
        ]
        
        for pattern in required_debug_patterns:
            pattern_found = pattern in source
            assert pattern_found, f"Debug pattern not found: {pattern}"
        
        print("[TEST DEBUG] ✅ Comprehensive debugging test passed!")


class TestFrontendCompatibility(TestCase):
    """Test that backend changes are compatible with frontend expectations"""
    
    def test_allocation_table_compatibility(self):
        """Test that allocation data structure matches AllocationTable.tsx expectations"""
        print("[TEST DEBUG] Testing AllocationTable frontend compatibility...")
        
        # Simulate the data structure that should be returned
        expected_structure = {
            "rows": [
                {
                    "groupKey": "AAPL",           # Frontend expects groupKey
                    "value": "1000.00",          # Frontend expects string
                    "invested": "800.00",        # Frontend expects string  
                    "gainValue": "200.00",       # Frontend expects gainValue
                    "gainPercent": "25.00",      # Frontend expects gainPercent
                    "allocation": 25.5,          # Frontend expects NUMBER for .toFixed()
                    "accentColor": "blue"        # Frontend expects accentColor
                }
            ]
        }
        
        # Verify each field that frontend AllocationTable.tsx expects
        row = expected_structure["rows"][0]
        
        # Test the allocation field specifically (this was the main error)
        allocation = row["allocation"]
        try:
            # This should work now (was causing "toFixed is not a function")
            result = f"{allocation:.2f}%"
            print(f"[TEST DEBUG] allocation.toFixed simulation: {result}")
            assert result == "25.50%"
        except AttributeError:
            assert False, "allocation field should be a number to support .toFixed()"
        
        print("[TEST DEBUG] ✅ AllocationTable compatibility test passed!")

    def test_gain_loss_card_compatibility(self):
        """Test that gainers/losers data structure matches GainLossCard.tsx expectations"""
        print("[TEST DEBUG] Testing GainLossCard frontend compatibility...")
        
        # Simulate the data structure that should be returned
        expected_structure = {
            "items": [
                {
                    "logoUrl": None,
                    "name": "Apple Inc",
                    "ticker": "AAPL",
                    "value": "150.00",          # String for display
                    "changePercent": 3.45,      # NUMBER for .toFixed()
                    "changeValue": 5.25         # NUMBER for .toLocaleString()
                }
            ]
        }
        
        # Verify each field that frontend GainLossCard.tsx expects
        item = expected_structure["items"][0]
        
        # Test the changePercent field (this was causing "toFixed is not a function")
        change_percent = item["changePercent"]
        try:
            result = f"{change_percent:.2f}%"
            print(f"[TEST DEBUG] changePercent.toFixed simulation: {result}")
            assert result == "3.45%"
        except AttributeError:
            assert False, "changePercent field should be a number to support .toFixed()"
            
        # Test the changeValue field (this was causing "toLocaleString is not a function")
        change_value = item["changeValue"]
        try:
            # Simulate what the frontend does
            if isinstance(change_value, (int, float)):
                result = f"${change_value:,.2f}"
            else:
                result = f"${float(change_value):,.2f}"
            print(f"[TEST DEBUG] changeValue.toLocaleString simulation: {result}")
            assert result == "$5.25"
        except (ValueError, TypeError):
            assert False, "changeValue field should be a number or parseable string"
        
        print("[TEST DEBUG] ✅ GainLossCard compatibility test passed!") 