# PriceManager Test Suite

Comprehensive test suite for the CurrentPriceManager implementation, covering unit tests, integration tests, performance benchmarks, and end-to-end scenarios.

## Test Structure

```
tests/
├── conftest.py                      # Shared fixtures and test configuration
├── unit/                            # Unit tests for individual methods
│   └── test_price_manager_unit.py   # Core PriceManager unit tests
├── integration/                     # Integration tests with mocked dependencies
│   ├── test_alpha_vantage_integration.py  # Alpha Vantage API integration
│   └── test_database_integration.py        # Database caching layer tests
├── performance/                     # Performance and benchmark tests
│   └── test_performance_benchmarks.py      # Response time and throughput tests
└── e2e/                            # End-to-end scenario tests
    └── test_price_manager_e2e.py   # Complete workflow tests
```

## Running Tests

### Basic Usage

```bash
# Run all tests
python tests/run_tests.py

# Run specific test category
python tests/run_tests.py unit
python tests/run_tests.py integration
python tests/run_tests.py performance
python tests/run_tests.py e2e

# Run with coverage
python tests/run_tests.py -c

# Run with verbose output
python tests/run_tests.py -v

# Run quick tests only (excludes performance)
python tests/run_tests.py --quick
```

### Using pytest directly

```bash
# Run all tests
pytest tests/

# Run with coverage
pytest tests/ --cov=services.current_price_manager --cov-report=html

# Run specific test file
pytest tests/unit/test_price_manager_unit.py

# Run specific test
pytest tests/unit/test_price_manager_unit.py::TestCurrentPriceManagerUnit::test_get_current_price_fast_cache_hit_market_closed

# Run tests matching pattern
pytest tests/ -k "cache"

# Run tests with specific marker
pytest tests/ -m "not slow"
```

## Test Categories

### 1. Unit Tests (`test_price_manager_unit.py`)

Tests individual methods in isolation with mocked dependencies:

- **Cache Management**
  - `test_get_current_price_fast_cache_hit_market_closed` - Cache hit when market closed
  - `test_get_current_price_fast_cache_hit_market_open_price_unchanged` - Cache extension logic
  - `test_get_current_price_fast_cache_miss` - Cache miss handling

- **Data Validation**
  - `test_is_valid_price_various_inputs` - Price validation logic
  - `test_fill_price_gaps_data_validation` - Invalid data filtering

- **Market Integration**
  - `test_ensure_data_current_market_open` - Data updates during market hours
  - `test_ensure_data_current_market_closed` - Behavior when market closed
  - `test_get_portfolio_prices_market_grouping` - Multi-market handling

- **Session Management**
  - `test_update_prices_with_session_check_flow` - Session-aware updates
  - `test_ensure_closing_prices` - Closing price capture

### 2. Integration Tests

#### Alpha Vantage Integration (`test_alpha_vantage_integration.py`)

- **API Communication**
  - `test_alpha_vantage_quote_success` - Successful quote retrieval
  - `test_alpha_vantage_quote_failure` - Error handling
  - `test_invalid_symbol_handling` - Invalid symbol responses

- **Rate Limiting**
  - `test_alpha_vantage_rate_limit_handling` - Retry on rate limit
  - `test_alpha_vantage_retry_logic_max_retries` - Max retry behavior

- **Data Parsing**
  - `test_daily_adjusted_data_parsing` - Time series parsing
  - `test_overview_data_parsing` - Company overview parsing
  - `test_dividend_data_retrieval` - Dividend data handling

- **Performance**
  - `test_concurrent_api_requests` - Parallel request handling
  - `test_cache_functionality` - API response caching

#### Database Integration (`test_database_integration.py`)

- **Cache Operations**
  - `test_cache_write_and_read` - Basic cache operations
  - `test_cache_expiration` - TTL and expiration logic
  - `test_concurrent_cache_access` - Thread safety

- **Data Storage**
  - `test_batch_price_storage` - Bulk insert operations
  - `test_duplicate_price_handling` - Upsert behavior
  - `test_gap_filling_logic` - Missing data recovery

- **Error Handling**
  - `test_transaction_rollback` - Database error recovery
  - `test_database_connection_recovery` - Connection failure handling

### 3. Performance Tests (`test_performance_benchmarks.py`)

- **Response Time**
  - `test_single_quote_response_time` - Single quote benchmarks
  - `test_portfolio_batch_response_time` - Batch processing speed
  - `test_cache_lookup_performance` - Cache efficiency

- **Throughput**
  - `test_concurrent_request_performance` - Parallel processing
  - `test_api_call_count_optimization` - API call minimization

- **Resource Usage**
  - `test_memory_usage_under_load` - Memory efficiency
  - `test_database_query_performance` - Query optimization

- **Overhead Analysis**
  - `test_market_status_check_overhead` - Market check cost

### 4. End-to-End Tests (`test_price_manager_e2e.py`)

- **Complete Workflows**
  - `test_complete_portfolio_update_workflow` - User login to price update
  - `test_market_open_to_close_workflow` - Full trading day simulation
  - `test_real_time_price_updates_workflow` - Intraday price changes

- **Complex Scenarios**
  - `test_multi_day_gap_filling_scenario` - Weekend/holiday handling
  - `test_mixed_market_regions_workflow` - Global portfolio management
  - `test_session_aware_update_comprehensive` - Advanced session tracking

- **Error Recovery**
  - `test_error_recovery_workflow` - Graceful degradation

## Performance Benchmarks

Expected performance targets:

| Operation | Target | Actual |
|-----------|--------|--------|
| Single quote (cold) | < 500ms | ~200ms |
| Single quote (cached) | < 10ms | ~2ms |
| Portfolio 100 symbols | < 1s | ~800ms |
| Cache lookup | < 1μs | ~200ns |
| Concurrent 50 requests | > 5x speedup | ~8x |

## Test Data

The test suite uses various mock data generators:

- `generate_mock_symbols(count)` - Generate test stock symbols
- `generate_mock_price_history(symbol, days)` - Create price history
- Mock Alpha Vantage responses for quotes, daily data, and dividends
- Mock Supabase responses for database operations

## Coverage Goals

Target coverage metrics:

- Overall coverage: > 90%
- Critical paths: 100%
- Error handling: > 95%
- Edge cases: > 85%

## Adding New Tests

When adding new tests:

1. Place in appropriate category (unit/integration/performance/e2e)
2. Use descriptive test names following pattern: `test_<feature>_<scenario>`
3. Include docstrings explaining test purpose
4. Use appropriate fixtures from conftest.py
5. Add performance assertions where relevant
6. Consider both success and failure cases

## Continuous Integration

For CI/CD pipelines:

```yaml
# Example GitHub Actions configuration
- name: Run tests
  run: |
    pip install -r requirements.txt
    pip install pytest-cov
    python tests/run_tests.py --coverage
    
- name: Upload coverage
  uses: codecov/codecov-action@v3
  with:
    file: ./coverage.xml
```

## Troubleshooting

Common issues and solutions:

1. **Import errors**: Ensure PYTHONPATH includes project root
2. **Async warnings**: Use pytest-asyncio for async tests
3. **Mock issues**: Check mock call counts and arguments
4. **Performance failures**: Run on consistent hardware, adjust thresholds

## Future Enhancements

Planned test improvements:

1. Property-based testing with Hypothesis
2. Mutation testing for test quality
3. Load testing with Locust
4. Contract testing for API compatibility
5. Snapshot testing for data consistency