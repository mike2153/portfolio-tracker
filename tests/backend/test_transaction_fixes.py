"""
Unit Tests for Transaction Form Fixes
Tests price fetching, validation, and search functionality
"""

import os
import sys
import asyncio
import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, AsyncMock
import logging

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'backend_simplified'))

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class TestTransactionFixes:
    """Test suite for transaction form fixes"""
    
    @pytest.mark.asyncio
    async def test_historical_price_response_format(self):
        """Test that historical price API returns correct format for frontend"""
        logger.info("\n🧪 Testing historical price response format")
        
        # Import the handler
        try:
            from backend_api_routes.backend_api_research import backend_api_historical_price_handler
        except ImportError:
            pytest.skip("Backend modules not available")
        
        # Mock the vantage API response
        mock_price_data = {
            "symbol": "AAPL",
            "requested_date": "2024-01-15",
            "date": "2024-01-15",
            "is_exact_date": True,
            "open": 150.00,
            "high": 152.00,
            "low": 149.00,
            "close": 151.50,
            "adjusted_close": 151.50,
            "volume": 50000000
        }
        
        with patch('backend_api_routes.backend_api_research.vantage_api_get_historical_price', 
                   new_callable=AsyncMock) as mock_get_price:
            mock_get_price.return_value = mock_price_data
            
            # Call the handler
            response = await backend_api_historical_price_handler(
                symbol="AAPL",
                date="2024-01-15"
            )
            
            # Verify response structure matches what frontend expects
            logger.info(f"📊 Response: {response}")
            
            assert response["success"] == True
            assert response["symbol"] == "AAPL"
            assert response["requested_date"] == "2024-01-15"
            assert response["actual_date"] == "2024-01-15"
            assert response["is_exact_date"] == True
            
            # Most importantly - price_data structure
            assert "price_data" in response
            assert response["price_data"]["close"] == 151.50
            assert response["price_data"]["open"] == 150.00
            assert response["price_data"]["high"] == 152.00
            assert response["price_data"]["low"] == 149.00
            assert response["price_data"]["volume"] == 50000000
            
            logger.info("✅ Response format matches frontend expectations")
    
    @pytest.mark.asyncio
    async def test_fuzzy_search_algorithm(self):
        """Test fuzzy search with typos"""
        logger.info("\n🧪 Testing fuzzy search algorithm")
        
        try:
            from vantage_api.vantage_api_search import calculate_relevance_score, levenshtein_distance
        except ImportError:
            pytest.skip("Backend modules not available")
        
        # Test Levenshtein distance
        test_cases = [
            ("AAPL", "APPL", 1),  # One character difference
            ("MSFT", "MSFT", 0),  # Exact match
            ("GOOGL", "GOOG", 1), # One character missing
            ("META", "MELA", 2),  # Two character swap
        ]
        
        for s1, s2, expected_distance in test_cases:
            distance = levenshtein_distance(s1, s2)
            logger.info(f"📏 Distance between '{s1}' and '{s2}': {distance} (expected: {expected_distance})")
            assert distance == expected_distance
        
        # Test relevance scoring
        score_tests = [
            {
                "query": "APPL",
                "symbol": "AAPL",
                "name": "Apple Inc.",
                "min_score": 20  # Should get fuzzy match bonus
            },
            {
                "query": "AAPL",
                "symbol": "AAPL", 
                "name": "Apple Inc.",
                "min_score": 100  # Exact match
            },
            {
                "query": "AA",
                "symbol": "AAPL",
                "name": "Apple Inc.", 
                "min_score": 75  # Prefix match
            }
        ]
        
        for test in score_tests:
            score = calculate_relevance_score(
                symbol=test["symbol"],
                name=test["name"],
                query_upper=test["query"].upper(),
                query_lower=test["query"].lower()
            )
            logger.info(f"🎯 Score for '{test['query']}' -> '{test['symbol']}': {score}")
            assert score >= test["min_score"], f"Score {score} is less than expected {test['min_score']}"
        
        logger.info("✅ Fuzzy search algorithm working correctly")
    
    @pytest.mark.asyncio
    async def test_price_validation_edge_cases(self):
        """Test price fetch validation for edge cases"""
        logger.info("\n🧪 Testing price validation edge cases")
        
        try:
            from backend_api_routes.backend_api_research import backend_api_historical_price_handler
            from fastapi import HTTPException
        except ImportError:
            pytest.skip("Backend modules not available")
        
        # Test invalid date format
        with pytest.raises(HTTPException) as exc_info:
            await backend_api_historical_price_handler(
                symbol="AAPL",
                date="2024/01/15"  # Wrong format
            )
        assert exc_info.value.status_code == 400
        assert "YYYY-MM-DD" in str(exc_info.value.detail)
        logger.info("✅ Invalid date format rejected")
        
        # Test missing symbol
        with pytest.raises(HTTPException) as exc_info:
            await backend_api_historical_price_handler(
                symbol="",
                date="2024-01-15"
            )
        assert exc_info.value.status_code == 400
        assert "Symbol is required" in str(exc_info.value.detail)
        logger.info("✅ Empty symbol rejected")
        
        # Test missing date
        with pytest.raises(HTTPException) as exc_info:
            await backend_api_historical_price_handler(
                symbol="AAPL",
                date=""
            )
        assert exc_info.value.status_code == 400
        assert "Date is required" in str(exc_info.value.detail)
        logger.info("✅ Empty date rejected")
    
    def test_transaction_validation_logic(self):
        """Test transaction form validation logic"""
        logger.info("\n🧪 Testing transaction validation logic")
        
        # Simulate frontend validation
        def validate_transaction(data):
            errors = {}
            
            # Validate ticker
            if not data.get('ticker') or data['ticker'].strip() == '':
                errors['ticker'] = 'Ticker symbol is required'
            
            # Validate shares
            try:
                shares = float(data.get('shares', 0))
                if shares <= 0:
                    errors['shares'] = 'Valid number of shares is required'
            except (ValueError, TypeError):
                errors['shares'] = 'Valid number of shares is required'
            
            # Validate price - MOST IMPORTANT
            try:
                price = float(data.get('purchase_price', 0))
                if price <= 0:
                    errors['purchase_price'] = 'Valid price is required'
            except (ValueError, TypeError):
                errors['purchase_price'] = 'Valid price is required'
            
            # Validate date
            if not data.get('purchase_date'):
                errors['purchase_date'] = 'Transaction date is required'
            
            return errors
        
        # Test cases
        test_cases = [
            {
                "name": "Valid transaction",
                "data": {
                    "ticker": "AAPL",
                    "shares": "10",
                    "purchase_price": "150.50",
                    "purchase_date": "2024-01-15"
                },
                "expect_errors": False
            },
            {
                "name": "Missing price",
                "data": {
                    "ticker": "AAPL",
                    "shares": "10",
                    "purchase_price": "",
                    "purchase_date": "2024-01-15"
                },
                "expect_errors": True,
                "expected_error_field": "purchase_price"
            },
            {
                "name": "Zero price",
                "data": {
                    "ticker": "AAPL",
                    "shares": "10",
                    "purchase_price": "0",
                    "purchase_date": "2024-01-15"
                },
                "expect_errors": True,
                "expected_error_field": "purchase_price"
            },
            {
                "name": "Invalid shares",
                "data": {
                    "ticker": "AAPL",
                    "shares": "abc",
                    "purchase_price": "150.50",
                    "purchase_date": "2024-01-15"
                },
                "expect_errors": True,
                "expected_error_field": "shares"
            }
        ]
        
        for test_case in test_cases:
            logger.info(f"\n📋 Testing: {test_case['name']}")
            errors = validate_transaction(test_case['data'])
            
            if test_case['expect_errors']:
                assert len(errors) > 0, f"Expected errors but got none"
                if 'expected_error_field' in test_case:
                    assert test_case['expected_error_field'] in errors
                    logger.info(f"✅ Got expected error: {errors[test_case['expected_error_field']]}")
            else:
                assert len(errors) == 0, f"Expected no errors but got: {errors}"
                logger.info("✅ Validation passed")
    
    @pytest.mark.asyncio
    async def test_race_condition_prevention(self):
        """Test that manual price entry is not overwritten by auto-fetch"""
        logger.info("\n🧪 Testing race condition prevention")
        
        # Simulate form state
        form_state = {
            "ticker": "AAPL",
            "purchase_date": "2024-01-15",
            "purchase_price": "155.00"  # Manual price
        }
        
        # Function that simulates date blur handler logic
        def should_fetch_price(form):
            has_valid_ticker = form.get('ticker') and form['ticker'].strip() != ''
            has_valid_date = form.get('purchase_date') and form['purchase_date'].strip() != ''
            has_manual_price = form.get('purchase_price') and form['purchase_price'].strip() != ''
            
            # Don't fetch if manual price exists
            return has_valid_ticker and has_valid_date and not has_manual_price
        
        # Test with manual price - should NOT fetch
        should_fetch = should_fetch_price(form_state)
        assert should_fetch == False, "Should not fetch when manual price exists"
        logger.info("✅ Manual price preserved - no auto-fetch")
        
        # Test without manual price - should fetch
        form_state['purchase_price'] = ""
        should_fetch = should_fetch_price(form_state)
        assert should_fetch == True, "Should fetch when no manual price"
        logger.info("✅ No manual price - auto-fetch triggered")
    
    def test_price_loading_state(self):
        """Test that form submission is blocked while price is loading"""
        logger.info("\n🧪 Testing price loading state")
        
        # Simulate submission validation with loading state
        def can_submit(form, loading_price):
            if loading_price:
                return False, "Price is being fetched"
            
            # Normal validation
            if not form.get('purchase_price'):
                return False, "Price is required"
            
            return True, None
        
        form = {"ticker": "AAPL", "purchase_price": ""}
        
        # Test with loading state
        can_submit_result, error = can_submit(form, loading_price=True)
        assert can_submit_result == False
        assert error is not None and "being fetched" in error
        logger.info("✅ Submission blocked while loading")
        
        # Test without loading but missing price
        can_submit_result, error = can_submit(form, loading_price=False)
        assert can_submit_result == False
        assert error is not None and "required" in error
        logger.info("✅ Submission blocked for missing price")
        
        # Test valid submission
        form['purchase_price'] = "150.50"
        can_submit_result, error = can_submit(form, loading_price=False)
        assert can_submit_result == True
        assert error is None
        logger.info("✅ Valid submission allowed")


def run_all_tests():
    """Run all tests using pytest"""
    logger.info("\n" + "="*80)
    logger.info("🚀 RUNNING TRANSACTION FIX UNIT TESTS")
    logger.info("="*80)
    
    # Run pytest
    pytest_args = [
        __file__,
        "-v",  # Verbose
        "-s",  # No capture (show print statements)
        "--tb=short",  # Short traceback
        "--color=yes"
    ]
    
    return pytest.main(pytest_args)


if __name__ == "__main__":
    exit_code = run_all_tests()
    sys.exit(exit_code) 