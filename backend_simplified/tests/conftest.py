"""
Shared test fixtures and configuration for PriceManager tests
"""
import pytest
import asyncio
from datetime import datetime, date, timedelta, timezone
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from typing import Dict, Any, List, Optional
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.current_price_manager import CurrentPriceManager
from services.market_status_service import MarketStatusService


@pytest.fixture
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def mock_alpha_vantage_quote():
    """Mock Alpha Vantage quote response"""
    return {
        'symbol': 'AAPL',
        'price': 150.25,
        'change': 2.50,
        'change_percent': '1.69',
        'volume': 75000000,
        'latest_trading_day': '2024-01-15',
        'previous_close': 147.75,
        'open': 148.00,
        'high': 151.00,
        'low': 147.50
    }


@pytest.fixture
def mock_alpha_vantage_daily():
    """Mock Alpha Vantage daily adjusted response"""
    return {
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


@pytest.fixture
def mock_market_info():
    """Mock market info for a symbol"""
    return {
        'symbol': 'AAPL',
        'market_region': 'United States',
        'market_open': '09:30:00',
        'market_close': '16:00:00',
        'market_timezone': 'America/New_York',
        'market_currency': 'USD'
    }


@pytest.fixture
def mock_historical_prices():
    """Mock historical price data from database"""
    return [
        {
            'time': '2024-01-15',
            'open': 148.00,
            'high': 151.00,
            'low': 147.50,
            'close': 150.25,
            'volume': 75000000
        },
        {
            'time': '2024-01-12',
            'open': 145.00,
            'high': 148.00,
            'low': 144.50,
            'close': 147.75,
            'volume': 65000000
        }
    ]


@pytest.fixture
def price_manager():
    """Create a PriceManager instance for testing"""
    return CurrentPriceManager()


@pytest.fixture
def mock_vantage_client():
    """Mock Alpha Vantage client"""
    client = MagicMock()
    client._make_request = AsyncMock()
    client._get_from_cache = AsyncMock(return_value=None)
    client._save_to_cache = AsyncMock()
    return client


@pytest.fixture
def mock_supa_client():
    """Mock Supabase client"""
    client = MagicMock()
    
    # Mock table operations
    table_mock = MagicMock()
    select_mock = MagicMock()
    execute_mock = MagicMock()
    
    # Chain the mocks
    client.table = MagicMock(return_value=table_mock)
    table_mock.select = MagicMock(return_value=select_mock)
    table_mock.upsert = MagicMock(return_value=execute_mock)
    select_mock.eq = MagicMock(return_value=select_mock)
    select_mock.limit = MagicMock(return_value=select_mock)
    select_mock.order = MagicMock(return_value=select_mock)
    select_mock.execute = MagicMock()
    
    return client


@pytest.fixture
def mock_market_holidays():
    """Mock market holidays data"""
    return {
        'NYSE': {
            date(2024, 1, 1),  # New Year's Day
            date(2024, 1, 15), # MLK Day
            date(2024, 2, 19), # Presidents Day
            date(2024, 7, 4),  # Independence Day
        }
    }


@pytest.fixture
async def mock_market_status_service():
    """Mock market status service"""
    service = AsyncMock(spec=MarketStatusService)
    service.is_market_open_for_symbol = AsyncMock(return_value=(True, {'market_region': 'United States'}))
    service.get_market_info_for_symbol = AsyncMock()
    service.group_symbols_by_market = AsyncMock()
    service.check_markets_status = AsyncMock()
    service.should_update_prices = Mock(return_value=True)
    service.mark_symbol_updated = Mock()
    service.load_market_holidays = AsyncMock()
    service.get_missed_sessions = AsyncMock(return_value=[])
    service.get_last_trading_day = AsyncMock(return_value=date.today())
    return service


@pytest.fixture
def performance_timer():
    """Simple performance timer for benchmarking"""
    class Timer:
        def __init__(self):
            self.start_time = None
            self.end_time = None
            
        def start(self):
            self.start_time = datetime.now()
            
        def stop(self):
            self.end_time = datetime.now()
            return (self.end_time - self.start_time).total_seconds()
            
    return Timer()


# Test data generators
def generate_mock_symbols(count: int) -> List[str]:
    """Generate a list of mock stock symbols"""
    base_symbols = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'META', 'NVDA', 'TSLA', 'JPM', 'V', 'JNJ']
    if count <= len(base_symbols):
        return base_symbols[:count]
    
    # Generate additional symbols if needed
    symbols = base_symbols.copy()
    for i in range(len(base_symbols), count):
        symbols.append(f'TEST{i:04d}')
    return symbols


def generate_mock_price_history(symbol: str, days: int = 30) -> List[Dict[str, Any]]:
    """Generate mock price history for a symbol"""
    prices = []
    base_price = 100.0
    current_date = date.today()
    
    for i in range(days):
        price_date = current_date - timedelta(days=i)
        # Skip weekends
        if price_date.weekday() >= 5:
            continue
            
        # Add some randomness
        import random
        change = random.uniform(-5, 5)
        close_price = base_price + change
        
        prices.append({
            'time': price_date.strftime('%Y-%m-%d'),
            'open': close_price - random.uniform(0, 2),
            'high': close_price + random.uniform(0, 3),
            'low': close_price - random.uniform(0, 3),
            'close': close_price,
            'volume': random.randint(1000000, 100000000)
        })
        
        base_price = close_price
    
    return prices


# Environment setup
@pytest.fixture(autouse=True)
def setup_test_env():
    """Set up test environment variables"""
    os.environ['ALPHA_VANTAGE_API_KEY'] = 'test_api_key'
    os.environ['SUPABASE_URL'] = 'http://test.supabase.co'
    os.environ['SUPABASE_SERVICE_KEY'] = 'test_service_key'
    yield
    # Cleanup if needed