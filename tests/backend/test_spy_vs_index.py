"""
Unit smoke test for SPY portfolio vs index matching
Tests that a portfolio containing only SPY transactions should match the SPY index performance
within acceptable tolerance (≤ 0.2% drift as specified in the requirements).
"""

import pytest
import asyncio
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Dict, Any, List
import logging

# Test utilities and fixtures
from test_real_auth_api import get_authenticated_client, create_test_user, cleanup_test_user

# Import the services we need to test
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '../../backend_simplified'))

from services.portfolio_service import PortfolioTimeSeriesService, PortfolioServiceUtils
from services.index_sim_service import IndexSimulationService, IndexSimulationUtils

logger = logging.getLogger(__name__)

class TestSPYPortfolioIndexMatching:
    """Test class for SPY portfolio vs index performance matching"""
    
    @pytest.mark.asyncio
    async def test_spy_portfolio_matches_index_3y_period(self):
        """
        Test that a portfolio with only SPY transactions matches SPY index performance
        within 0.2% tolerance over a 3-year period.
        
        This is the main smoke test specified in the requirements.
        """
        print("\n🔥 [test_spy_vs_index] === SPY PORTFOLIO INDEX MATCHING TEST START ===")
        print(f"🔥 [test_spy_vs_index] Timestamp: {datetime.now().isoformat()}")
        print(f"🔥 [test_spy_vs_index] Test: SPY portfolio should match SPY index ≤ 0.2% drift")
        
        # Step 1: Set up test user and authentication
        print(f"🔐 [test_spy_vs_index] Step 1: Creating test user and authentication...")
        
        test_user_data = await create_test_user("spy_test_user@test.com", "TestPass123!")
        client = await get_authenticated_client(test_user_data)
        user_id = test_user_data['user']['id']
        user_token = test_user_data['session']['access_token']
        
        print(f"✅ [test_spy_vs_index] Test user created: {user_id}")
        print(f"✅ [test_spy_vs_index] Authentication token obtained")
        
        try:
            # Step 2: Create SPY transaction 3 years ago
            print(f"📊 [test_spy_vs_index] Step 2: Creating SPY transaction 3 years ago...")
            
            three_years_ago = date.today() - timedelta(days=3*365)
            transaction_date = three_years_ago.isoformat()
            
            # Create a significant SPY purchase to test with
            transaction_data = {
                "symbol": "SPY",
                "quantity": 100,  # 100 shares
                "price": 300.00,  # Approximate SPY price 3 years ago
                "date": transaction_date,
                "transaction_type": "BUY"
            }
            
            print(f"📝 [test_spy_vs_index] Creating transaction: {transaction_data}")
            
            # Add transaction via API
            response = client.post("/api/transactions", json=transaction_data)
            assert response.status_code == 200, f"Failed to create transaction: {response.text}"
            
            transaction_response = response.json()
            print(f"✅ [test_spy_vs_index] Transaction created: {transaction_response}")
            
            # Step 3: Calculate date range for 3Y period
            print(f"📅 [test_spy_vs_index] Step 3: Setting up 3Y date range...")
            
            start_date, end_date = PortfolioServiceUtils.compute_date_range('3Y')
            print(f"📅 [test_spy_vs_index] Date range: {start_date} to {end_date}")
            
            # Step 4: Calculate portfolio performance
            print(f"📈 [test_spy_vs_index] Step 4: Calculating portfolio performance...")
            
            portfolio_series = await PortfolioTimeSeriesService.get_portfolio_series(
                user_id=user_id,
                start_date=start_date,
                end_date=end_date,
                user_token=user_token
            )
            
            print(f"📈 [test_spy_vs_index] Portfolio series calculated: {len(portfolio_series)} points")
            print(f"📈 [test_spy_vs_index] Portfolio start value: ${portfolio_series[0][1] if portfolio_series else 0}")
            print(f"📈 [test_spy_vs_index] Portfolio end value: ${portfolio_series[-1][1] if portfolio_series else 0}")
            
            # Step 5: Calculate SPY index simulation
            print(f"📊 [test_spy_vs_index] Step 5: Calculating SPY index simulation...")
            
            index_series = await IndexSimulationService.get_index_sim_series(
                user_id=user_id,
                benchmark="SPY",
                start_date=start_date,
                end_date=end_date,
                user_token=user_token
            )
            
            print(f"📊 [test_spy_vs_index] Index series calculated: {len(index_series)} points")
            print(f"📊 [test_spy_vs_index] Index start value: ${index_series[0][1] if index_series else 0}")
            print(f"📊 [test_spy_vs_index] Index end value: ${index_series[-1][1] if index_series else 0}")
            
            # Step 6: Calculate performance metrics
            print(f"🧮 [test_spy_vs_index] Step 6: Calculating performance metrics...")
            
            metrics = IndexSimulationUtils.calculate_performance_metrics(
                portfolio_series, index_series
            )
            
            print(f"📊 [test_spy_vs_index] Performance metrics: {metrics}")
            
            # Step 7: Verify matching within tolerance
            print(f"🎯 [test_spy_vs_index] Step 7: Verifying performance matching...")
            
            portfolio_final = portfolio_series[-1][1] if portfolio_series else Decimal('0')
            index_final = index_series[-1][1] if index_series else Decimal('0')
            
            # Calculate percentage difference
            if index_final > 0:
                percentage_diff = abs(portfolio_final - index_final) / index_final * 100
                print(f"📊 [test_spy_vs_index] Portfolio final value: ${portfolio_final}")
                print(f"📊 [test_spy_vs_index] Index final value: ${index_final}")
                print(f"📊 [test_spy_vs_index] Percentage difference: {percentage_diff:.4f}%")
                print(f"📊 [test_spy_vs_index] Tolerance threshold: 0.2%")
                
                # CRITICAL ASSERTION: Portfolio should match index within 0.2%
                assert percentage_diff <= 0.2, (
                    f"SPY portfolio vs SPY index drift too high: {percentage_diff:.4f}% > 0.2%. "
                    f"Portfolio: ${portfolio_final}, Index: ${index_final}"
                )
                
                print(f"✅ [test_spy_vs_index] PASS: SPY portfolio matches SPY index within tolerance")
                print(f"✅ [test_spy_vs_index] Drift: {percentage_diff:.4f}% ≤ 0.2% ✓")
                
            else:
                pytest.fail("Index final value is zero, cannot calculate percentage difference")
            
            # Step 8: Verify performance metrics
            print(f"📈 [test_spy_vs_index] Step 8: Verifying performance metrics...")
            
            if metrics:
                portfolio_return = metrics.get('portfolio_return_pct', 0)
                index_return = metrics.get('index_return_pct', 0)
                outperformance = metrics.get('outperformance_pct', 0)
                
                print(f"📊 [test_spy_vs_index] Portfolio return: {portfolio_return:.2f}%")
                print(f"📊 [test_spy_vs_index] Index return: {index_return:.2f}%")
                print(f"📊 [test_spy_vs_index] Outperformance: {outperformance:.2f}%")
                
                # Outperformance should be close to zero for SPY vs SPY
                assert abs(outperformance) <= 0.2, (
                    f"SPY vs SPY outperformance too high: {abs(outperformance):.2f}% > 0.2%"
                )
                
                print(f"✅ [test_spy_vs_index] PASS: Outperformance within tolerance: {abs(outperformance):.2f}% ≤ 0.2%")
            
            print(f"🎉 [test_spy_vs_index] === SPY PORTFOLIO INDEX MATCHING TEST COMPLETE ===")
            print(f"🎉 [test_spy_vs_index] RESULT: ALL ASSERTIONS PASSED ✅")
            
        finally:
            # Cleanup: Remove test user
            print(f"🧹 [test_spy_vs_index] Cleaning up test user...")
            await cleanup_test_user(test_user_data)
            print(f"✅ [test_spy_vs_index] Test user cleanup complete")
    
    @pytest.mark.asyncio
    async def test_spy_portfolio_with_multiple_transactions(self):
        """
        Test SPY portfolio matching with multiple buy/sell transactions
        to ensure the algorithm works correctly with complex transaction history.
        """
        print("\n🔥 [test_spy_vs_index] === MULTIPLE SPY TRANSACTIONS TEST START ===")
        
        # Set up test user
        test_user_data = await create_test_user("spy_multi_test@test.com", "TestPass123!")
        client = await get_authenticated_client(test_user_data)
        user_id = test_user_data['user']['id']
        user_token = test_user_data['session']['access_token']
        
        try:
            # Create multiple SPY transactions over time
            transactions = [
                # Initial purchase 2 years ago
                {
                    "symbol": "SPY",
                    "quantity": 50,
                    "price": 350.00,
                    "date": (date.today() - timedelta(days=2*365)).isoformat(),
                    "transaction_type": "BUY"
                },
                # Additional purchase 1 year ago
                {
                    "symbol": "SPY", 
                    "quantity": 30,
                    "price": 400.00,
                    "date": (date.today() - timedelta(days=365)).isoformat(),
                    "transaction_type": "BUY"
                },
                # Partial sale 6 months ago
                {
                    "symbol": "SPY",
                    "quantity": 20,
                    "price": 450.00,
                    "date": (date.today() - timedelta(days=180)).isoformat(),
                    "transaction_type": "SELL"
                }
            ]
            
            print(f"📝 [test_spy_vs_index] Creating {len(transactions)} SPY transactions...")
            
            for i, transaction_data in enumerate(transactions):
                response = client.post("/api/transactions", json=transaction_data)
                assert response.status_code == 200, f"Failed to create transaction {i}: {response.text}"
                print(f"✅ [test_spy_vs_index] Transaction {i+1} created: {transaction_data}")
            
            # Calculate performance over 1Y period
            start_date, end_date = PortfolioServiceUtils.compute_date_range('1Y')
            
            portfolio_series = await PortfolioTimeSeriesService.get_portfolio_series(
                user_id=user_id,
                start_date=start_date,
                end_date=end_date,
                user_token=user_token
            )
            
            index_series = await IndexSimulationService.get_index_sim_series(
                user_id=user_id,
                benchmark="SPY",
                start_date=start_date,
                end_date=end_date,
                user_token=user_token
            )
            
            # Verify matching within tolerance
            if portfolio_series and index_series:
                portfolio_final = portfolio_series[-1][1]
                index_final = index_series[-1][1]
                
                if index_final > 0:
                    percentage_diff = abs(portfolio_final - index_final) / index_final * 100
                    print(f"📊 [test_spy_vs_index] Multi-transaction test - Percentage difference: {percentage_diff:.4f}%")
                    
                    # Should still match within tolerance even with multiple transactions
                    assert percentage_diff <= 0.2, (
                        f"Multi-transaction SPY portfolio drift too high: {percentage_diff:.4f}% > 0.2%"
                    )
                    
                    print(f"✅ [test_spy_vs_index] PASS: Multi-transaction SPY portfolio matches index")
            
        finally:
            await cleanup_test_user(test_user_data)

    @pytest.mark.asyncio 
    async def test_error_handling_no_transactions(self):
        """
        Test that the system handles the case where a user has no transactions gracefully.
        """
        print("\n🔥 [test_spy_vs_index] === NO TRANSACTIONS ERROR HANDLING TEST START ===")
        
        test_user_data = await create_test_user("spy_empty_test@test.com", "TestPass123!")
        user_id = test_user_data['user']['id']
        user_token = test_user_data['session']['access_token']
        
        try:
            start_date, end_date = PortfolioServiceUtils.compute_date_range('1Y')
            
            # Should handle empty portfolio gracefully
            portfolio_series = await PortfolioTimeSeriesService.get_portfolio_series(
                user_id=user_id,
                start_date=start_date,
                end_date=end_date,
                user_token=user_token
            )
            
            index_series = await IndexSimulationService.get_index_sim_series(
                user_id=user_id,
                benchmark="SPY",
                start_date=start_date,
                end_date=end_date,
                user_token=user_token
            )
            
            # Should return zero values for empty portfolio
            assert len(portfolio_series) > 0, "Portfolio series should not be empty"
            assert all(value == 0 for _, value in portfolio_series), "Portfolio should have zero values"
            
            assert len(index_series) > 0, "Index series should not be empty"
            assert all(value == 0 for _, value in index_series), "Index should have zero values for no transactions"
            
            print(f"✅ [test_spy_vs_index] PASS: Empty portfolio handled correctly")
            
        finally:
            await cleanup_test_user(test_user_data)

if __name__ == "__main__":
    # Allow running this test file directly
    asyncio.run(pytest.main([__file__, "-v"]))