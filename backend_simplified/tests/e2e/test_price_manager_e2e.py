"""
End-to-end tests for PriceManager
Tests complete workflows and real-world scenarios
"""
import pytest
from datetime import datetime, date, timedelta, timezone
from unittest.mock import patch, AsyncMock, Mock
from typing import Dict, Any, List

from services.current_price_manager import CurrentPriceManager
from services.market_status_service import market_status_service


class TestPriceManagerE2E:
    """End-to-end tests for complete PriceManager workflows"""
    
    @pytest.mark.asyncio
    async def test_complete_portfolio_update_workflow(self, price_manager):
        """Test complete workflow: login -> portfolio update -> price refresh"""
        user_id = "test_user_123"
        user_token = "test_jwt_token"
        
        # Mock user's portfolio symbols
        portfolio_symbols = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA']
        
        with patch('supa_api.supa_api_client.get_supa_service_client') as mock_supa:
            # Mock getting user's transactions
            mock_client = Mock()
            mock_supa.return_value = mock_client
            
            mock_table = Mock()
            mock_client.table.return_value = mock_table
            mock_select = Mock()
            mock_table.select.return_value = mock_select
            mock_eq = Mock()
            mock_select.eq.return_value = mock_eq
            mock_execute = Mock()
            mock_eq.execute.return_value = mock_execute
            
            # Return user's symbols
            mock_execute.data = [{'symbol': s} for s in portfolio_symbols]
            
            with patch.object(price_manager, 'update_prices_with_session_check',
                              new_callable=AsyncMock) as mock_update:
                mock_update.return_value = {
                    "success": True,
                    "data": {
                        "updated": portfolio_symbols,
                        "skipped": [],
                        "failed": [],
                        "sessions_filled": 10,
                        "api_calls": 5
                    }
                }
                
                # Execute workflow
                result = await price_manager.update_user_portfolio_prices(user_id, user_token)
                
                assert result["success"] is True
                mock_update.assert_called_once_with(portfolio_symbols, user_token)
    
    @pytest.mark.asyncio
    async def test_market_open_to_close_workflow(self, price_manager):
        """Test workflow from market open through market close"""
        symbol = "AAPL"
        user_token = "test_token"
        
        # Simulate market open
        with patch('services.market_status_service.market_status_service.is_market_open_for_symbol',
                   new_callable=AsyncMock) as mock_market:
            mock_market.return_value = (True, {
                'market_region': 'United States',
                'market_open': '09:30:00',
                'market_close': '16:00:00',
                'market_timezone': 'America/New_York'
            })
            
            with patch.object(price_manager, '_get_current_price_data',
                              new_callable=AsyncMock) as mock_price:
                # Morning price
                mock_price.return_value = {
                    'symbol': symbol,
                    'price': 150.00,
                    'volume': 10000000
                }
                
                morning_result = await price_manager.get_current_price(symbol, user_token)
                assert morning_result['success'] is True
                assert morning_result['data']['price'] == 150.00
        
        # Simulate market close
        with patch('services.market_status_service.market_status_service.is_market_open_for_symbol',
                   new_callable=AsyncMock) as mock_market:
            mock_market.return_value = (False, {
                'market_region': 'United States',
                'market_close': '16:00:00'
            })
            
            with patch.object(price_manager, '_get_current_price_data',
                              new_callable=AsyncMock) as mock_price:
                # Closing price
                mock_price.return_value = {
                    'symbol': symbol,
                    'price': 152.50,
                    'volume': 75000000
                }
                
                # Ensure closing prices
                result = await price_manager.ensure_closing_prices([symbol], user_token)
                assert result['success'] is True
                assert symbol in result['updated'] or symbol in result['skipped']
    
    @pytest.mark.asyncio
    async def test_multi_day_gap_filling_scenario(self, price_manager):
        """Test handling of multi-day gaps (weekend, holidays)"""
        symbol = "AAPL"
        user_token = "test_token"
        
        # Last update was Friday
        last_friday = date(2024, 1, 12)  # Friday
        today = date(2024, 1, 16)  # Tuesday (Monday was holiday)
        
        with patch('services.market_status_service.market_status_service.load_market_holidays',
                   new_callable=AsyncMock):
            with patch('services.market_status_service.market_status_service.get_missed_sessions',
                       new_callable=AsyncMock) as mock_missed:
                # Only Tuesday should be missed (Monday was holiday)
                mock_missed.return_value = [date(2024, 1, 16)]
                
                with patch.object(price_manager, '_get_last_price_date',
                                  new_callable=AsyncMock) as mock_last_date:
                    mock_last_date.return_value = last_friday
                    
                    with patch('vantage_api.vantage_api_quotes.vantage_api_get_daily_adjusted',
                               new_callable=AsyncMock) as mock_daily:
                        mock_daily.return_value = {
                            '2024-01-16': {
                                '1. open': '151.00',
                                '2. high': '153.00',
                                '3. low': '150.50',
                                '4. close': '152.50',
                                '5. adjusted close': '152.50',
                                '6. volume': '80000000'
                            }
                        }
                        
                        with patch('supa_api.supa_api_historical_prices.supa_api_store_historical_prices_batch',
                                   new_callable=AsyncMock) as mock_store:
                            mock_store.return_value = True
                            
                            # Run update
                            result = await price_manager.update_prices_with_session_check(
                                [symbol], user_token, include_indexes=False
                            )
                            
                            assert result['success'] is True
                            assert result['data']['sessions_filled'] == 1
                            assert symbol in result['data']['updated']
    
    @pytest.mark.asyncio
    async def test_mixed_market_regions_workflow(self, price_manager):
        """Test handling symbols from different market regions"""
        symbols = {
            'US': ['AAPL', 'GOOGL'],
            'UK': ['BARC.L', 'BP.L'],
            'JP': ['7203.T'],  # Toyota
            'AU': ['BHP.AX']   # BHP on ASX
        }
        
        all_symbols = []
        for region_symbols in symbols.values():
            all_symbols.extend(region_symbols)
        
        with patch('services.market_status_service.market_status_service.group_symbols_by_market',
                   new_callable=AsyncMock) as mock_group:
            mock_group.return_value = {
                'United States': symbols['US'],
                'United Kingdom': symbols['UK'],
                'Japan': symbols['JP'],
                'Australia': symbols['AU']
            }
            
            with patch('services.market_status_service.market_status_service.check_markets_status',
                       new_callable=AsyncMock) as mock_status:
                # Different markets have different statuses
                mock_status.return_value = {
                    'United States': True,   # Open
                    'United Kingdom': False, # Closed
                    'Japan': False,         # Closed
                    'Australia': True       # Open
                }
                
                with patch.object(price_manager, 'get_historical_prices',
                                  new_callable=AsyncMock) as mock_hist:
                    mock_hist.return_value = {
                        "success": True,
                        "data": {"price_data": [{"close": 100.0}]}
                    }
                    
                    result = await price_manager.get_portfolio_prices(
                        all_symbols, user_token='test_token'
                    )
                    
                    assert result['success'] is True
                    # Should process US and AU symbols, skip UK and JP
                    assert 'United States' in result['metadata']['market_status']
                    assert result['metadata']['market_status']['United States'] is True
                    assert result['metadata']['market_status']['United Kingdom'] is False
    
    @pytest.mark.asyncio
    async def test_error_recovery_workflow(self, price_manager):
        """Test error recovery in various scenarios"""
        symbol = "AAPL"
        
        # Scenario 1: API failure with cache fallback
        cache_data = {
            "success": True,
            "data": {"symbol": symbol, "price": 150.00}
        }
        price_manager._quote_cache[f"quote_{symbol}"] = (
            cache_data,
            datetime.now(timezone.utc) - timedelta(minutes=30),
            150.00
        )
        
        with patch.object(price_manager, '_get_current_price_data',
                          side_effect=Exception("API Error")):
            with patch('services.market_status_service.market_status_service.is_market_open_for_symbol',
                       new_callable=AsyncMock) as mock_market:
                mock_market.return_value = (False, {})  # Market closed
                
                # Should use cache when market is closed
                result = await price_manager.get_current_price_fast(symbol)
                assert result['success'] is True
                assert result['data']['price'] == 150.00
        
        # Scenario 2: Database failure during gap filling
        with patch('supa_api.supa_api_historical_prices.supa_api_store_historical_prices_batch',
                   side_effect=Exception("Database error")):
            with patch('vantage_api.vantage_api_quotes.vantage_api_get_daily_adjusted',
                       new_callable=AsyncMock) as mock_daily:
                mock_daily.return_value = {'2024-01-15': {}}
                
                result = await price_manager._fill_price_gaps(
                    symbol, date.today(), date.today(), 'test_token'
                )
                assert result is False  # Should handle gracefully
    
    @pytest.mark.asyncio
    async def test_real_time_price_updates_workflow(self, price_manager):
        """Test real-time price updates during market hours"""
        symbol = "AAPL"
        
        # Simulate price changes during market hours
        price_updates = [
            {'time': '09:30', 'price': 150.00},
            {'time': '10:00', 'price': 150.50},
            {'time': '11:00', 'price': 151.25},
            {'time': '14:00', 'price': 150.75},
            {'time': '15:59', 'price': 151.50}
        ]
        
        for update in price_updates:
            with patch('services.market_status_service.market_status_service.is_market_open_for_symbol',
                       new_callable=AsyncMock) as mock_market:
                mock_market.return_value = (True, {'market_region': 'United States'})
                
                with patch.object(price_manager, '_get_current_price_data',
                                  new_callable=AsyncMock) as mock_price:
                    mock_price.return_value = {
                        'symbol': symbol,
                        'price': update['price'],
                        'latest_trading_day': '2024-01-15'
                    }
                    
                    result = await price_manager.get_current_price_fast(symbol)
                    
                    assert result['success'] is True
                    assert result['data']['price'] == update['price']
                    
                    # Verify cache is updated
                    cache_key = f"quote_{symbol}"
                    assert cache_key in price_manager._quote_cache
                    _, _, cached_price = price_manager._quote_cache[cache_key]
                    assert cached_price == update['price']
    
    @pytest.mark.asyncio
    async def test_session_aware_update_comprehensive(self, price_manager):
        """Test comprehensive session-aware update scenario"""
        # Mix of symbols with different update needs
        test_scenarios = [
            {'symbol': 'AAPL', 'last_update': datetime.now() - timedelta(days=3), 'missed_sessions': 3},
            {'symbol': 'GOOGL', 'last_update': datetime.now() - timedelta(hours=2), 'missed_sessions': 0},
            {'symbol': 'MSFT', 'last_update': datetime.now() - timedelta(days=7), 'missed_sessions': 5},
            {'symbol': 'TSLA', 'last_update': None, 'missed_sessions': 100}  # Never updated
        ]
        
        symbols = [s['symbol'] for s in test_scenarios]
        
        with patch('services.market_status_service.market_status_service.load_market_holidays',
                   new_callable=AsyncMock):
            with patch('supa_api.supa_api_client.get_supa_service_client') as mock_supa:
                mock_client = Mock()
                mock_supa.return_value = mock_client
                
                # Mock price update log queries
                def mock_execute_response(symbol):
                    for scenario in test_scenarios:
                        if scenario['symbol'] == symbol:
                            if scenario['last_update']:
                                return Mock(data=[{
                                    'last_update_time': scenario['last_update'].isoformat(),
                                    'last_session_date': (scenario['last_update'].date()).isoformat()
                                }])
                            else:
                                return Mock(data=[])
                    return Mock(data=[])
                
                # Setup complex mock chain
                mock_table = Mock()
                mock_client.table.return_value = mock_table
                
                # Track which symbol is being queried
                current_symbol = None
                
                def set_symbol(symbol):
                    nonlocal current_symbol
                    current_symbol = symbol
                    return mock_table
                
                mock_table.select.return_value = mock_table
                mock_table.eq.side_effect = lambda field, value: (
                    set_symbol(value) if field == 'symbol' else mock_table
                )
                mock_table.limit.return_value = mock_table
                mock_table.order.return_value = mock_table
                mock_table.execute.side_effect = lambda: mock_execute_response(current_symbol)
                
                with patch('services.market_status_service.market_status_service.get_missed_sessions',
                           new_callable=AsyncMock) as mock_missed:
                    # Return appropriate missed sessions
                    async def get_missed(symbol, last_update, user_token):
                        for scenario in test_scenarios:
                            if scenario['symbol'] == symbol:
                                return [date.today() - timedelta(days=i) 
                                       for i in range(scenario['missed_sessions'])]
                        return []
                    
                    mock_missed.side_effect = get_missed
                    
                    with patch.object(price_manager, 'get_historical_prices',
                                      new_callable=AsyncMock) as mock_hist:
                        mock_hist.return_value = {"success": True}
                        
                        with patch.object(price_manager, '_update_price_log',
                                          new_callable=AsyncMock):
                            result = await price_manager.update_prices_with_session_check(
                                symbols, 'test_token', include_indexes=False
                            )
                            
                            assert result['success'] is True
                            
                            # GOOGL should be skipped (no missed sessions)
                            assert 'GOOGL' in result['data']['skipped']
                            
                            # Others should be updated
                            assert 'AAPL' in result['data']['updated']
                            assert 'MSFT' in result['data']['updated']
                            assert 'TSLA' in result['data']['updated']
                            
                            # Total sessions filled
                            expected_sessions = 3 + 5 + 100  # AAPL + MSFT + TSLA
                            assert result['data']['sessions_filled'] == expected_sessions