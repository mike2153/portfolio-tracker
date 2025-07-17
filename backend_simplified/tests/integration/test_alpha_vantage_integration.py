"""
Integration tests for Alpha Vantage API interactions
Tests API mocking, rate limiting, retry logic, and error handling
"""
import pytest
from datetime import datetime, timedelta
from unittest.mock import patch, AsyncMock, MagicMock
import aiohttp
import asyncio

from vantage_api.vantage_api_client import AlphaVantageClient
from vantage_api.vantage_api_quotes import (
    vantage_api_get_quote,
    vantage_api_get_daily_adjusted,
    vantage_api_get_overview,
    vantage_api_get_dividends
)


class TestAlphaVantageIntegration:
    """Integration tests for Alpha Vantage API"""
    
    @pytest.mark.asyncio
    async def test_alpha_vantage_quote_success(self, mock_vantage_client):
        """Test successful quote retrieval"""
        mock_response = {
            'Global Quote': {
                '01. symbol': 'AAPL',
                '05. price': '150.25',
                '09. change': '2.50',
                '10. change percent': '1.69%',
                '06. volume': '75000000',
                '07. latest trading day': '2024-01-15',
                '08. previous close': '147.75',
                '02. open': '148.00',
                '03. high': '151.00',
                '04. low': '147.50'
            }
        }
        
        with patch('vantage_api.vantage_api_client.get_vantage_client') as mock_get_client:
            mock_get_client.return_value = mock_vantage_client
            mock_vantage_client._make_request.return_value = mock_response
            
            result = await vantage_api_get_quote('AAPL')
            
            assert result['symbol'] == 'AAPL'
            assert result['price'] == 150.25
            assert result['change'] == 2.50
            assert result['change_percent'] == '1.69'
            assert result['volume'] == 75000000
    
    @pytest.mark.asyncio
    async def test_alpha_vantage_quote_failure(self, mock_vantage_client):
        """Test quote retrieval failure handling"""
        with patch('vantage_api.vantage_api_client.get_vantage_client') as mock_get_client:
            mock_get_client.return_value = mock_vantage_client
            mock_vantage_client._make_request.side_effect = Exception("API Error")
            
            with pytest.raises(Exception) as exc_info:
                await vantage_api_get_quote('INVALID')
            
            assert "API Error" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_alpha_vantage_rate_limit_handling(self):
        """Test rate limit handling with retry logic"""
        client = AlphaVantageClient()
        
        # Mock rate limit response
        rate_limit_response = {
            'Note': 'Thank you for using Alpha Vantage! Our standard API call frequency is 5 calls per minute'
        }
        
        successful_response = {
            'Global Quote': {
                '01. symbol': 'AAPL',
                '05. price': '150.25'
            }
        }
        
        with patch.object(client.session, 'get', new_callable=AsyncMock) as mock_get:
            # First call: rate limited
            # Second call: success
            mock_resp1 = AsyncMock()
            mock_resp1.json = AsyncMock(return_value=rate_limit_response)
            mock_resp1.status = 200
            
            mock_resp2 = AsyncMock()
            mock_resp2.json = AsyncMock(return_value=successful_response)
            mock_resp2.status = 200
            
            mock_get.side_effect = [mock_resp1, mock_resp2]
            
            # Should retry and succeed
            result = await client._make_request({'function': 'GLOBAL_QUOTE', 'symbol': 'AAPL'})
            
            assert 'Global Quote' in result
            assert mock_get.call_count == 2
    
    @pytest.mark.asyncio
    async def test_alpha_vantage_retry_logic_max_retries(self):
        """Test retry logic reaches max retries"""
        client = AlphaVantageClient()
        
        rate_limit_response = {
            'Note': 'Thank you for using Alpha Vantage! Our standard API call frequency is 5 calls per minute'
        }
        
        with patch.object(client.session, 'get', new_callable=AsyncMock) as mock_get:
            mock_resp = AsyncMock()
            mock_resp.json = AsyncMock(return_value=rate_limit_response)
            mock_resp.status = 200
            mock_get.return_value = mock_resp
            
            # Should fail after max retries
            with pytest.raises(Exception) as exc_info:
                await client._make_request({'function': 'GLOBAL_QUOTE', 'symbol': 'AAPL'})
            
            assert "Rate limit" in str(exc_info.value)
            assert mock_get.call_count == 3  # Default max retries
    
    @pytest.mark.asyncio
    async def test_alpha_vantage_timeout_handling(self):
        """Test timeout handling"""
        client = AlphaVantageClient()
        
        with patch.object(client.session, 'get', new_callable=AsyncMock) as mock_get:
            # Simulate timeout
            mock_get.side_effect = asyncio.TimeoutError()
            
            with pytest.raises(Exception) as exc_info:
                await client._make_request({'function': 'GLOBAL_QUOTE', 'symbol': 'AAPL'})
            
            assert "Request timeout" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_daily_adjusted_data_parsing(self, mock_vantage_client):
        """Test parsing of daily adjusted time series data"""
        mock_response = {
            'Time Series (Daily)': {
                '2024-01-15': {
                    '1. open': '148.00',
                    '2. high': '151.00',
                    '3. low': '147.50',
                    '4. close': '150.25',
                    '5. adjusted close': '150.25',
                    '6. volume': '75000000',
                    '7. dividend amount': '0.0',
                    '8. split coefficient': '1.0'
                },
                '2024-01-12': {
                    '1. open': '145.00',
                    '2. high': '148.00',
                    '3. low': '144.50',
                    '4. close': '147.75',
                    '5. adjusted close': '147.75',
                    '6. volume': '65000000',
                    '7. dividend amount': '0.0',
                    '8. split coefficient': '1.0'
                }
            }
        }
        
        with patch('vantage_api.vantage_api_client.get_vantage_client') as mock_get_client:
            mock_get_client.return_value = mock_vantage_client
            mock_vantage_client._make_request.return_value = mock_response
            
            result = await vantage_api_get_daily_adjusted('AAPL')
            
            assert '2024-01-15' in result
            assert '2024-01-12' in result
            assert result['2024-01-15']['4. close'] == '150.25'
    
    @pytest.mark.asyncio
    async def test_invalid_symbol_handling(self, mock_vantage_client):
        """Test handling of invalid symbols"""
        mock_response = {}  # Empty response for invalid symbol
        
        with patch('vantage_api.vantage_api_client.get_vantage_client') as mock_get_client:
            mock_get_client.return_value = mock_vantage_client
            mock_vantage_client._make_request.return_value = mock_response
            
            with pytest.raises(Exception) as exc_info:
                await vantage_api_get_quote('INVALID_SYMBOL_12345')
            
            assert "No quote data found" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_overview_data_parsing(self, mock_vantage_client):
        """Test company overview data parsing"""
        mock_response = {
            'Symbol': 'AAPL',
            'Name': 'Apple Inc.',
            'Description': 'Apple designs, manufactures...',
            'Exchange': 'NASDAQ',
            'Currency': 'USD',
            'Country': 'USA',
            'Sector': 'Technology',
            'Industry': 'Consumer Electronics',
            'MarketCapitalization': '3000000000000',
            'PERatio': '30.5',
            'DividendYield': '0.005',
            '52WeekHigh': '200.00',
            '52WeekLow': '120.00'
        }
        
        with patch('vantage_api.vantage_api_client.get_vantage_client') as mock_get_client:
            mock_get_client.return_value = mock_vantage_client
            mock_vantage_client._make_request.return_value = mock_response
            
            result = await vantage_api_get_overview('AAPL')
            
            assert result['symbol'] == 'AAPL'
            assert result['name'] == 'Apple Inc.'
            assert result['market_cap'] == 3000000000000.0
            assert result['pe_ratio'] == 30.5
            assert result['dividend_yield'] == 0.005
    
    @pytest.mark.asyncio
    async def test_dividend_data_retrieval(self, mock_vantage_client):
        """Test dividend data retrieval and parsing"""
        mock_response = {
            'data': [
                {
                    'ex_dividend_date': '2024-02-09',
                    'declaration_date': '2024-02-01',
                    'record_date': '2024-02-12',
                    'payment_date': '2024-02-15',
                    'amount': '0.24'
                },
                {
                    'ex_dividend_date': '2023-11-10',
                    'declaration_date': '2023-11-02',
                    'record_date': '2023-11-13',
                    'payment_date': '2023-11-16',
                    'amount': '0.24'
                }
            ]
        }
        
        with patch('vantage_api.vantage_api_client.get_vantage_client') as mock_get_client:
            mock_get_client.return_value = mock_vantage_client
            mock_vantage_client._make_request.return_value = mock_response
            
            result = await vantage_api_get_dividends('AAPL')
            
            assert len(result) == 2
            assert result[0]['ex_date'] == '2024-02-09'
            assert result[0]['amount'] == 0.24
            assert result[1]['ex_date'] == '2023-11-10'
    
    @pytest.mark.asyncio
    async def test_concurrent_api_requests(self, mock_vantage_client):
        """Test handling of concurrent API requests"""
        symbols = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'META']
        
        def create_mock_response(symbol):
            return {
                'Global Quote': {
                    '01. symbol': symbol,
                    '05. price': '150.00',
                    '06. volume': '1000000'
                }
            }
        
        with patch('vantage_api.vantage_api_client.get_vantage_client') as mock_get_client:
            mock_get_client.return_value = mock_vantage_client
            
            # Set up responses for each symbol
            responses = [create_mock_response(s) for s in symbols]
            mock_vantage_client._make_request.side_effect = responses
            
            # Make concurrent requests
            tasks = [vantage_api_get_quote(symbol) for symbol in symbols]
            results = await asyncio.gather(*tasks)
            
            assert len(results) == len(symbols)
            for i, result in enumerate(results):
                assert result['symbol'] == symbols[i]
    
    @pytest.mark.asyncio
    async def test_cache_functionality(self, mock_vantage_client):
        """Test API response caching"""
        mock_response = {
            'Global Quote': {
                '01. symbol': 'AAPL',
                '05. price': '150.25'
            }
        }
        
        with patch('vantage_api.vantage_api_client.get_vantage_client') as mock_get_client:
            mock_get_client.return_value = mock_vantage_client
            mock_vantage_client._make_request.return_value = mock_response
            
            # First call should hit API
            result1 = await vantage_api_get_quote('AAPL')
            
            # Set cache to return data
            mock_vantage_client._get_from_cache.return_value = {
                'symbol': 'AAPL',
                'price': 150.25
            }
            
            # Second call should hit cache
            result2 = await vantage_api_get_quote('AAPL')
            
            # API should only be called once
            mock_vantage_client._make_request.assert_called_once()