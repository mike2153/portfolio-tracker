"""
Unit tests for CurrentPriceManager
Tests individual methods in isolation with mocked dependencies
"""
import pytest
from datetime import datetime, date, timedelta, timezone
from unittest.mock import patch, AsyncMock, Mock, MagicMock
import math

from services.current_price_manager import CurrentPriceManager


class TestCurrentPriceManagerUnit:
    """Unit tests for CurrentPriceManager methods"""
    
    @pytest.mark.asyncio
    async def test_get_current_price_fast_cache_hit_market_closed(self, price_manager, mock_alpha_vantage_quote):
        """Test cache hit when market is closed - should return cached data"""
        # Setup cache
        cache_data = {
            "success": True,
            "data": mock_alpha_vantage_quote,
            "metadata": {"symbol": "AAPL", "data_source": "cached"}
        }
        price_manager._quote_cache["quote_AAPL"] = (
            cache_data,
            datetime.now(timezone.utc) - timedelta(minutes=10),
            mock_alpha_vantage_quote['price']
        )
        
        # Mock market closed
        with patch('services.market_status_service.market_status_service.is_market_open_for_symbol',
                   new_callable=AsyncMock) as mock_market_open:
            mock_market_open.return_value = (False, {"market_region": "United States"})
            
            result = await price_manager.get_current_price_fast("AAPL")
            
            assert result["success"] is True
            assert result["data"]["symbol"] == "AAPL"
            assert result["metadata"]["data_source"] == "cached"
            mock_market_open.assert_called_once_with("AAPL")
    
    @pytest.mark.asyncio
    async def test_get_current_price_fast_cache_hit_market_open_price_unchanged(self, price_manager, mock_alpha_vantage_quote):
        """Test cache hit when market is open but price unchanged - should extend cache"""
        # Setup cache
        cache_data = {
            "success": True,
            "data": mock_alpha_vantage_quote,
            "metadata": {"symbol": "AAPL", "data_source": "cached"}
        }
        old_cache_time = datetime.now(timezone.utc) - timedelta(minutes=10)
        price_manager._quote_cache["quote_AAPL"] = (
            cache_data,
            old_cache_time,
            mock_alpha_vantage_quote['price']
        )
        
        # Mock market open and price unchanged
        with patch('services.market_status_service.market_status_service.is_market_open_for_symbol',
                   new_callable=AsyncMock) as mock_market_open:
            mock_market_open.return_value = (True, {"market_region": "United States"})
            
            with patch.object(price_manager, '_get_current_price_data',
                              new_callable=AsyncMock) as mock_get_price:
                mock_get_price.return_value = mock_alpha_vantage_quote
                
                result = await price_manager.get_current_price_fast("AAPL")
                
                assert result["success"] is True
                assert result["data"]["symbol"] == "AAPL"
                # Cache should be updated with new timestamp
                _, new_cache_time, _ = price_manager._quote_cache["quote_AAPL"]
                assert new_cache_time > old_cache_time
    
    @pytest.mark.asyncio
    async def test_get_current_price_fast_cache_miss(self, price_manager, mock_alpha_vantage_quote):
        """Test cache miss - should fetch fresh data"""
        # No cache entry
        assert "quote_AAPL" not in price_manager._quote_cache
        
        with patch.object(price_manager, '_get_current_price_data',
                          new_callable=AsyncMock) as mock_get_price:
            mock_get_price.return_value = mock_alpha_vantage_quote
            
            with patch('services.market_status_service.market_status_service.is_market_open_for_symbol',
                       new_callable=AsyncMock) as mock_market_open:
                mock_market_open.return_value = (True, {"market_region": "United States"})
                
                result = await price_manager.get_current_price_fast("AAPL")
                
                assert result["success"] is True
                assert result["data"]["symbol"] == "AAPL"
                assert "quote_AAPL" in price_manager._quote_cache
                mock_get_price.assert_called_once_with("AAPL")
    
    @pytest.mark.asyncio
    async def test_get_current_price_fast_error_handling(self, price_manager):
        """Test error handling in get_current_price_fast"""
        with patch.object(price_manager, '_get_current_price_data',
                          side_effect=Exception("API Error")):
            result = await price_manager.get_current_price_fast("AAPL")
            
            assert result["success"] is False
            assert "Service Temporarily Unavailable" in result["error"]
            assert "API Error" in result["metadata"]["message"]
    
    def test_is_valid_price_various_inputs(self, price_manager):
        """Test _is_valid_price with various inputs"""
        # Valid prices
        assert price_manager._is_valid_price(100.0) is True
        assert price_manager._is_valid_price(0.01) is True
        assert price_manager._is_valid_price(999999.99) is True
        
        # Invalid prices
        assert price_manager._is_valid_price(0) is False
        assert price_manager._is_valid_price(-10) is False
        assert price_manager._is_valid_price(None) is False
        assert price_manager._is_valid_price(float('nan')) is False
        assert price_manager._is_valid_price(float('inf')) is False
        assert price_manager._is_valid_price(float('-inf')) is False
        
        # Type errors
        assert price_manager._is_valid_price("100") is False
        assert price_manager._is_valid_price([100]) is False
    
    @pytest.mark.asyncio
    async def test_ensure_data_current_market_open(self, price_manager):
        """Test _ensure_data_current when market is open"""
        with patch('services.market_status_service.market_status_service.is_market_open_for_symbol',
                   new_callable=AsyncMock) as mock_market_open:
            mock_market_open.return_value = (True, {"market_region": "United States"})
            
            with patch.object(price_manager, '_get_last_price_date',
                              new_callable=AsyncMock) as mock_last_date:
                mock_last_date.return_value = date.today() - timedelta(days=2)
                
                with patch.object(price_manager, '_fill_price_gaps',
                                  new_callable=AsyncMock) as mock_fill_gaps:
                    result = await price_manager._ensure_data_current("AAPL", "test_token")
                    
                    assert result is True
                    mock_fill_gaps.assert_called_once()
                    call_args = mock_fill_gaps.call_args[0]
                    assert call_args[0] == "AAPL"
                    assert call_args[3] == "test_token"
    
    @pytest.mark.asyncio
    async def test_ensure_data_current_market_closed(self, price_manager):
        """Test _ensure_data_current when market is closed"""
        with patch('services.market_status_service.market_status_service.is_market_open_for_symbol',
                   new_callable=AsyncMock) as mock_market_open:
            mock_market_open.return_value = (False, {"market_region": "United States"})
            
            result = await price_manager._ensure_data_current("AAPL", "test_token")
            
            assert result is True
            # Should not check for gaps when market is closed
    
    @pytest.mark.asyncio
    async def test_get_portfolio_prices_market_grouping(self, price_manager):
        """Test portfolio prices with market grouping"""
        symbols = ["AAPL", "GOOGL", "TSM", "ASML"]
        
        with patch('services.market_status_service.market_status_service.group_symbols_by_market',
                   new_callable=AsyncMock) as mock_group:
            mock_group.return_value = {
                "United States": ["AAPL", "GOOGL"],
                "Taiwan": ["TSM"],
                "Netherlands": ["ASML"]
            }
            
            with patch('services.market_status_service.market_status_service.check_markets_status',
                       new_callable=AsyncMock) as mock_check_status:
                mock_check_status.return_value = {
                    "United States": True,
                    "Taiwan": False,
                    "Netherlands": False
                }
                
                with patch.object(price_manager, 'get_historical_prices',
                                  new_callable=AsyncMock) as mock_get_hist:
                    mock_get_hist.return_value = {
                        "success": True,
                        "data": {"price_data": [{"close": 150.0}]}
                    }
                    
                    result = await price_manager.get_portfolio_prices(symbols, user_token="test_token")
                    
                    assert result["success"] is True
                    assert "United States" in result["metadata"]["market_status"]
                    mock_group.assert_called_once_with(symbols, "test_token")
    
    @pytest.mark.asyncio
    async def test_fill_price_gaps_data_validation(self, price_manager, mock_alpha_vantage_daily):
        """Test _fill_price_gaps with data validation"""
        with patch('vantage_api.vantage_api_quotes.vantage_api_get_daily_adjusted',
                   new_callable=AsyncMock) as mock_daily:
            # Include invalid data in response
            invalid_data = mock_alpha_vantage_daily.copy()
            invalid_data['2024-01-14'] = {
                '1. open': '0',  # Invalid price
                '2. high': 'NaN',
                '3. low': '-10',
                '4. close': '0',
                '5. adjusted close': '0',
                '6. volume': '0'
            }
            mock_daily.return_value = invalid_data
            
            with patch('supa_api.supa_api_historical_prices.supa_api_store_historical_prices_batch',
                       new_callable=AsyncMock) as mock_store:
                mock_store.return_value = True
                
                result = await price_manager._fill_price_gaps(
                    "AAPL",
                    date(2024, 1, 10),
                    date(2024, 1, 15),
                    "test_token"
                )
                
                # Should filter out invalid data
                stored_data = mock_store.call_args[0][0]
                assert len(stored_data) == 2  # Only valid entries
                assert all(record['close'] > 0 for record in stored_data)
    
    @pytest.mark.asyncio
    async def test_update_prices_with_session_check_flow(self, price_manager):
        """Test the complete flow of update_prices_with_session_check"""
        symbols = ["AAPL", "GOOGL"]
        
        with patch('services.market_status_service.market_status_service.load_market_holidays',
                   new_callable=AsyncMock):
            with patch('supa_api.supa_api_client.get_supa_service_client') as mock_supa:
                # Mock database responses
                mock_client = MagicMock()
                mock_supa.return_value = mock_client
                
                # Mock price update log query
                mock_table = MagicMock()
                mock_client.table.return_value = mock_table
                mock_select = MagicMock()
                mock_table.select.return_value = mock_select
                mock_eq = MagicMock()
                mock_select.eq.return_value = mock_eq
                mock_limit = MagicMock()
                mock_eq.limit.return_value = mock_limit
                mock_execute = MagicMock()
                mock_limit.execute.return_value = mock_execute
                mock_execute.data = []  # No previous updates
                
                with patch('services.market_status_service.market_status_service.get_missed_sessions',
                           new_callable=AsyncMock) as mock_missed:
                    mock_missed.return_value = [date(2024, 1, 15), date(2024, 1, 16)]
                    
                    with patch.object(price_manager, 'get_historical_prices',
                                      new_callable=AsyncMock) as mock_get_hist:
                        mock_get_hist.return_value = {"success": True}
                        
                        with patch.object(price_manager, '_update_price_log',
                                          new_callable=AsyncMock):
                            result = await price_manager.update_prices_with_session_check(
                                symbols, "test_token", include_indexes=False
                            )
                            
                            assert result["success"] is True
                            assert len(result["data"]["updated"]) == 2
                            assert result["data"]["sessions_filled"] == 4  # 2 symbols × 2 sessions
    
    @pytest.mark.asyncio
    async def test_ensure_closing_prices(self, price_manager):
        """Test ensure_closing_prices functionality"""
        symbols = ["AAPL", "GOOGL", "MSFT"]
        
        with patch('services.market_status_service.market_status_service.is_market_open_for_symbol',
                   new_callable=AsyncMock) as mock_market_open:
            # AAPL: market still open
            # GOOGL: market closed, needs update
            # MSFT: market closed, already updated
            mock_market_open.side_effect = [
                (True, {"market_region": "United States"}),   # AAPL
                (False, {"market_region": "United States"}),  # GOOGL
                (False, {"market_region": "United States"})   # MSFT
            ]
            
            with patch('services.market_status_service.market_status_service.should_update_prices') as mock_should_update:
                mock_should_update.side_effect = [True, False]  # GOOGL needs update, MSFT doesn't
                
                with patch.object(price_manager, '_get_current_price_data',
                                  new_callable=AsyncMock) as mock_get_price:
                    mock_get_price.return_value = {"price": 150.0, "symbol": "GOOGL"}
                    
                    with patch.object(price_manager, '_ensure_data_current',
                                      new_callable=AsyncMock):
                        result = await price_manager.ensure_closing_prices(symbols, "test_token")
                        
                        assert result["success"] is True
                        assert "AAPL" in result["skipped"]  # Market still open
                        assert "GOOGL" in result["updated"]  # Updated closing price
                        assert "MSFT" in result["skipped"]   # Already has closing price
    
    @pytest.mark.asyncio
    async def test_get_portfolio_prices_for_charts_optimization(self, price_manager, mock_historical_prices):
        """Test chart-optimized portfolio prices (no API calls)"""
        symbols = ["AAPL", "GOOGL"]
        
        with patch.object(price_manager, '_get_db_historical_data',
                          new_callable=AsyncMock) as mock_get_db:
            mock_get_db.return_value = mock_historical_prices
            
            # Should NOT call Alpha Vantage
            with patch('vantage_api.vantage_api_quotes.vantage_api_get_daily_adjusted',
                       new_callable=AsyncMock) as mock_vantage:
                result = await price_manager.get_portfolio_prices_for_charts(
                    symbols, user_token="test_token"
                )
                
                assert result["success"] is True
                assert len(result["data"]["successful_symbols"]) == 2
                assert result["metadata"]["optimization"] == "chart_mode_database_only"
                assert result["metadata"]["data_source"] == "database_cache"
                
                # Verify no Alpha Vantage calls
                mock_vantage.assert_not_called()