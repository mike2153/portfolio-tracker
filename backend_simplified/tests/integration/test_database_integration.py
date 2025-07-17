"""
Integration tests for database caching layer
Tests Supabase interactions, cache operations, and data consistency
"""
import pytest
from datetime import datetime, date, timedelta
from unittest.mock import patch, AsyncMock, MagicMock, Mock
from typing import Dict, Any, List

from supa_api.supa_api_historical_prices import (
    supa_api_store_historical_prices_batch,
    supa_api_get_historical_prices
)
from services.current_price_manager import CurrentPriceManager


class TestDatabaseIntegration:
    """Integration tests for database caching operations"""
    
    @pytest.mark.asyncio
    async def test_cache_write_and_read(self, mock_supa_client):
        """Test writing to and reading from database cache"""
        test_data = [
            {
                'symbol': 'AAPL',
                'date': '2024-01-15',
                'open': 148.00,
                'high': 151.00,
                'low': 147.50,
                'close': 150.25,
                'adjusted_close': 150.25,
                'volume': 75000000,
                'dividend_amount': 0.0,
                'split_coefficient': 1.0
            }
        ]
        
        with patch('supa_api.supa_api_client.get_supa_service_client') as mock_get_client:
            mock_get_client.return_value = mock_supa_client
            
            # Mock successful insert
            mock_supa_client.table().upsert().execute.return_value = Mock(data=test_data)
            
            # Test write
            result = await supa_api_store_historical_prices_batch(test_data, 'test_token')
            assert result is True
            
            # Mock read response
            mock_supa_client.table().select().eq().eq().order().execute.return_value = Mock(data=test_data)
            
            # Test read
            read_data = await supa_api_get_historical_prices(
                'AAPL',
                '2024-01-15',
                '2024-01-15',
                'test_token'
            )
            
            assert len(read_data) == 1
            assert read_data[0]['close'] == 150.25
    
    @pytest.mark.asyncio
    async def test_cache_expiration(self, price_manager):
        """Test cache expiration logic"""
        # Set up expired cache entry
        old_cache_time = datetime.now() - timedelta(hours=2)
        cache_data = {
            "success": True,
            "data": {"symbol": "AAPL", "price": 150.00}
        }
        
        price_manager._quote_cache["quote_AAPL"] = (cache_data, old_cache_time, 150.00)
        price_manager._cache_timeout_fallback = 3600  # 1 hour
        
        with patch('services.market_status_service.market_status_service.is_market_open_for_symbol',
                   new_callable=AsyncMock) as mock_market:
            mock_market.return_value = (True, {})
            
            with patch.object(price_manager, '_get_current_price_data',
                              new_callable=AsyncMock) as mock_get_price:
                mock_get_price.side_effect = Exception("API Error")
                
                # Should not use expired cache when market is open
                result = await price_manager.get_current_price_fast("AAPL")
                
                assert result["success"] is False
                assert "Quote Not Available" in result["error"]
    
    @pytest.mark.asyncio
    async def test_batch_price_storage(self, mock_supa_client):
        """Test batch storage of price data"""
        # Generate test data for multiple days
        test_data = []
        base_date = date(2024, 1, 1)
        
        for i in range(30):
            current_date = base_date + timedelta(days=i)
            if current_date.weekday() < 5:  # Skip weekends
                test_data.append({
                    'symbol': 'AAPL',
                    'date': current_date.strftime('%Y-%m-%d'),
                    'open': 145.00 + i,
                    'high': 148.00 + i,
                    'low': 144.00 + i,
                    'close': 147.00 + i,
                    'adjusted_close': 147.00 + i,
                    'volume': 50000000 + (i * 1000000),
                    'dividend_amount': 0.0,
                    'split_coefficient': 1.0
                })
        
        with patch('supa_api.supa_api_client.get_supa_service_client') as mock_get_client:
            mock_get_client.return_value = mock_supa_client
            mock_supa_client.table().upsert().execute.return_value = Mock(data=test_data)
            
            result = await supa_api_store_historical_prices_batch(test_data, 'test_token')
            
            assert result is True
            # Verify upsert was called with correct conflict resolution
            mock_supa_client.table().upsert.assert_called_once()
            call_args = mock_supa_client.table().upsert.call_args
            assert call_args[1]['on_conflict'] == 'symbol,date'
    
    @pytest.mark.asyncio
    async def test_gap_filling_logic(self, price_manager, mock_alpha_vantage_daily):
        """Test price gap filling logic"""
        # Mock last price date as 3 days ago
        last_date = date.today() - timedelta(days=3)
        
        with patch.object(price_manager, '_get_last_price_date',
                          new_callable=AsyncMock) as mock_last_date:
            mock_last_date.return_value = last_date
            
            with patch('vantage_api.vantage_api_quotes.vantage_api_get_daily_adjusted',
                       new_callable=AsyncMock) as mock_daily:
                mock_daily.return_value = mock_alpha_vantage_daily
                
                with patch('supa_api.supa_api_historical_prices.supa_api_store_historical_prices_batch',
                           new_callable=AsyncMock) as mock_store:
                    mock_store.return_value = True
                    
                    # Fill gaps
                    result = await price_manager._fill_price_gaps(
                        'AAPL',
                        last_date + timedelta(days=1),
                        date.today(),
                        'test_token'
                    )
                    
                    assert result is True
                    # Verify data was stored
                    mock_store.assert_called_once()
                    stored_data = mock_store.call_args[0][0]
                    assert len(stored_data) > 0
    
    @pytest.mark.asyncio
    async def test_duplicate_price_handling(self, mock_supa_client):
        """Test handling of duplicate price entries"""
        # Same date, different prices (should update)
        initial_data = [{
            'symbol': 'AAPL',
            'date': '2024-01-15',
            'close': 150.00
        }]
        
        updated_data = [{
            'symbol': 'AAPL',
            'date': '2024-01-15',
            'close': 151.00  # Updated price
        }]
        
        with patch('supa_api.supa_api_client.get_supa_service_client') as mock_get_client:
            mock_get_client.return_value = mock_supa_client
            
            # First insert
            mock_supa_client.table().upsert().execute.return_value = Mock(data=initial_data)
            await supa_api_store_historical_prices_batch(initial_data, 'test_token')
            
            # Second insert (should update)
            mock_supa_client.table().upsert().execute.return_value = Mock(data=updated_data)
            result = await supa_api_store_historical_prices_batch(updated_data, 'test_token')
            
            assert result is True
            # Verify upsert was used (not insert)
            assert mock_supa_client.table().upsert.call_count == 2
    
    @pytest.mark.asyncio
    async def test_transaction_rollback(self, mock_supa_client):
        """Test transaction rollback on error"""
        test_data = [{'symbol': 'AAPL', 'date': '2024-01-15', 'close': 150.00}]
        
        with patch('supa_api.supa_api_client.get_supa_service_client') as mock_get_client:
            mock_get_client.return_value = mock_supa_client
            
            # Simulate database error
            mock_supa_client.table().upsert().execute.side_effect = Exception("Database error")
            
            # Should handle error gracefully
            result = await supa_api_store_historical_prices_batch(test_data, 'test_token')
            assert result is False
    
    @pytest.mark.asyncio
    async def test_concurrent_cache_access(self, price_manager):
        """Test concurrent access to cache"""
        symbols = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'META']
        
        async def get_price(symbol):
            # Simulate cache miss and API call
            with patch.object(price_manager, '_get_current_price_data',
                              new_callable=AsyncMock) as mock_get:
                mock_get.return_value = {'symbol': symbol, 'price': 150.00}
                
                with patch('services.market_status_service.market_status_service.is_market_open_for_symbol',
                           new_callable=AsyncMock) as mock_market:
                    mock_market.return_value = (True, {})
                    
                    return await price_manager.get_current_price_fast(symbol)
        
        # Concurrent requests
        import asyncio
        results = await asyncio.gather(*[get_price(s) for s in symbols])
        
        assert len(results) == len(symbols)
        assert all(r['success'] for r in results)
        
        # Verify all symbols are cached
        for symbol in symbols:
            assert f"quote_{symbol}" in price_manager._quote_cache
    
    @pytest.mark.asyncio
    async def test_database_connection_recovery(self, mock_supa_client):
        """Test recovery from database connection errors"""
        with patch('supa_api.supa_api_client.get_supa_service_client') as mock_get_client:
            # First call fails, second succeeds
            mock_get_client.side_effect = [
                Exception("Connection error"),
                mock_supa_client
            ]
            
            # First attempt should fail
            try:
                await supa_api_get_historical_prices('AAPL', '2024-01-01', '2024-01-15', 'test_token')
                assert False, "Should have raised exception"
            except Exception as e:
                assert "Connection error" in str(e)
            
            # Second attempt should succeed
            mock_supa_client.table().select().eq().eq().order().execute.return_value = Mock(data=[])
            result = await supa_api_get_historical_prices('AAPL', '2024-01-01', '2024-01-15', 'test_token')
            assert result == []
    
    @pytest.mark.asyncio
    async def test_price_update_log(self, price_manager, mock_supa_client):
        """Test price update logging functionality"""
        with patch('supa_api.supa_api_client.get_supa_service_client') as mock_get_client:
            mock_get_client.return_value = mock_supa_client
            
            with patch('services.market_status_service.market_status_service.get_last_trading_day',
                       new_callable=AsyncMock) as mock_last_day:
                mock_last_day.return_value = date.today()
                
                # Mock upsert for price update log
                mock_supa_client.table().upsert().execute.return_value = Mock(data=[])
                
                await price_manager._update_price_log('AAPL', 'session_check', 5)
                
                # Verify log entry was created
                mock_supa_client.table.assert_called_with('price_update_log')
                upsert_data = mock_supa_client.table().upsert.call_args[0][0]
                
                assert upsert_data['symbol'] == 'AAPL'
                assert upsert_data['update_trigger'] == 'session_check'
                assert upsert_data['sessions_updated'] == 5
                assert upsert_data['api_calls_made'] == 1