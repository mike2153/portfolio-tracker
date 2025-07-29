# API Fix Plan for Portfolio Tracker

## Executive Summary
This document outlines fixes for 10 critical API issues identified in the Portfolio Tracker system. Each fix includes specific implementation details, affected files, testing requirements, and migration strategies to ensure backward compatibility.

## API Versioning Strategy
- **Current State**: Mixed implementation of v1/v2 versioning via `X-API-Version` header
- **Target State**: Consistent v2 API with proper deprecation of v1
- **Migration Period**: 3 months with dual support
- **Version Header**: `X-API-Version: v2` (default to v2 after migration)

---

## Issue 1: Duplicate Dividend Routes

### Description
Routes defined in both main analytics router and refactored module causing routing conflicts and unpredictable behavior.

### API Changes Needed
1. Consolidate all dividend routes into single module
2. Remove duplicate route definitions
3. Ensure consistent response formats across all dividend endpoints

### Affected Endpoints
- `/api/analytics/dividends` (GET)
- `/api/analytics/dividends/confirm` (POST)
- `/api/analytics/dividends/sync` (POST)
- `/api/analytics/dividends/sync-all` (POST)
- `/api/analytics/dividends/reject` (POST)
- `/api/analytics/dividends/edit` (POST)

### Affected Files
- `backend_simplified/backend_api_routes/backend_api_analytics.py`
- `backend_simplified/backend_api_routes/backend_api_analytics_dividend_refactored.py` (if exists)
- `backend_simplified/main.py` (route registration)

### API Tests Required
```python
# Test route uniqueness
def test_dividend_routes_no_duplicates():
    routes = app.routes
    dividend_paths = [r.path for r in routes if 'dividends' in r.path]
    assert len(dividend_paths) == len(set(dividend_paths))

# Test consistent response format
def test_dividend_endpoints_v2_format():
    headers = {"X-API-Version": "v2"}
    response = client.get("/api/analytics/dividends", headers=headers)
    assert "metadata" in response.json()
    assert "timestamp" in response.json()["metadata"]
```

### Implementation Time
- **Estimated**: 4 hours
- **Tasks**: Route consolidation (2h), Testing (1h), Documentation (1h)

### Breaking Changes
- None if consolidation maintains same API contracts
- Migration: Update internal route registration only

---

## Issue 2: Missing Type Validation in User Profile

### Description
User profile update endpoint accepts `Optional[str]` for required fields, allowing None values that create incomplete profiles.

### API Changes Needed
1. Change all required fields from `Optional[str]` to `str`
2. Add Pydantic model validation for profile updates
3. Implement proper error responses for missing required fields

### Affected Endpoints
- `/api/profile` (PUT)
- `/api/profile/complete` (POST)

### Affected Files
- `backend_simplified/backend_api_routes/backend_api_user_profile.py`
- `backend_simplified/models/validation_models.py`
- `backend_simplified/supa_api/supa_api_user_profile.py`

### API Tests Required
```python
# Test required field validation
def test_profile_update_required_fields():
    data = {"first_name": None, "last_name": "Doe"}
    response = client.put("/api/profile", json=data)
    assert response.status_code == 422
    assert "first_name" in response.json()["details"][0]["field"]

# Test complete profile validation
def test_profile_complete_all_fields():
    data = {
        "first_name": "John",
        "last_name": "Doe",
        "country": "US",
        "base_currency": "USD"
    }
    response = client.post("/api/profile/complete", json=data)
    assert response.status_code == 200
```

### Implementation Time
- **Estimated**: 3 hours
- **Tasks**: Model updates (1h), Validation logic (1h), Testing (1h)

### Breaking Changes
- **Yes**: Requests with None values will now fail
- **Migration**: 
  - Add deprecation warning in v1 for None values
  - v2 enforces strict validation
  - Client update required to ensure non-null values

---

## Issue 3: Inconsistent Error Response Formats

### Description
Some endpoints return v1 format errors even when v2 is requested via header, causing frontend to handle multiple error formats.

### API Changes Needed
1. Implement consistent error middleware
2. Ensure all error responses respect API version header
3. Standardize error response structure

### Affected Endpoints
- All endpoints (global issue)

### Affected Files
- `backend_simplified/middleware/error_handler.py`
- `backend_simplified/utils/response_factory.py`
- All route files for error handling updates

### API Tests Required
```python
# Test v2 error format consistency
def test_error_format_v2_consistency():
    headers = {"X-API-Version": "v2"}
    # Test 404
    response = client.get("/api/nonexistent", headers=headers)
    assert response.json()["success"] == False
    assert "metadata" in response.json()
    assert "timestamp" in response.json()["metadata"]
    
    # Test validation error
    response = client.post("/api/transactions", json={}, headers=headers)
    assert "details" in response.json()
    assert isinstance(response.json()["details"], list)
```

### Implementation Time
- **Estimated**: 6 hours
- **Tasks**: Middleware update (2h), Route updates (3h), Testing (1h)

### Breaking Changes
- None if v1 format maintained for v1 requests
- **Migration**: Gradual with version header support

---

## Issue 4: Race Condition in Price Updates

### Description
Dashboard endpoint triggers background price updates without await, causing potential data inconsistency.

### API Changes Needed
1. Implement proper async/await for background tasks
2. Add task status tracking
3. Return update status in response metadata

### Affected Endpoints
- `/api/dashboard` (GET)
- `/api/portfolio` (GET)

### Affected Files
- `backend_simplified/backend_api_routes/backend_api_dashboard.py`
- `backend_simplified/services/price_manager.py`

### API Tests Required
```python
# Test price update completion
async def test_dashboard_price_update_race_condition():
    # Force stale cache
    await clear_price_cache()
    
    response = await client.get("/api/dashboard?force_refresh=true")
    assert response.json()["metadata"]["price_update_status"] in ["completed", "in_progress"]
    
    # Verify prices are actually updated
    await asyncio.sleep(1)
    response2 = await client.get("/api/dashboard")
    assert response2.json()["metadata"]["cache_status"] == "hit"
```

### Implementation Time
- **Estimated**: 4 hours
- **Tasks**: Async logic fix (2h), Status tracking (1h), Testing (1h)

### Breaking Changes
- None, internal implementation change only
- **Migration**: Transparent to clients

---

## Issue 5: JWT Token Forwarding Inconsistency

### Description
Not all Supabase operations properly forward user tokens for RLS, causing potential security bypasses or operation failures.

### API Changes Needed
1. Implement consistent token forwarding helper
2. Audit all Supabase operations for proper token usage
3. Add token validation middleware

### Affected Endpoints
- All endpoints that interact with Supabase

### Affected Files
- `backend_simplified/supa_api/*.py` (all files)
- `backend_simplified/utils/auth_helpers.py`

### API Tests Required
```python
# Test RLS enforcement
def test_rls_token_forwarding():
    # Create two users
    user1_token = create_test_user("user1")
    user2_token = create_test_user("user2")
    
    # User1 creates transaction
    headers1 = {"Authorization": f"Bearer {user1_token}"}
    response1 = client.post("/api/transactions", json=transaction_data, headers=headers1)
    transaction_id = response1.json()["data"]["id"]
    
    # User2 tries to access user1's transaction
    headers2 = {"Authorization": f"Bearer {user2_token}"}
    response2 = client.get(f"/api/transactions/{transaction_id}", headers=headers2)
    assert response2.status_code == 404  # RLS should prevent access
```

### Implementation Time
- **Estimated**: 8 hours
- **Tasks**: Helper implementation (2h), Audit & fixes (4h), Testing (2h)

### Breaking Changes
- None if RLS already properly configured
- **Migration**: Security enhancement, no client changes

---

## Issue 6: Cache Invalidation Gap

### Description
Transaction CRUD operations only invalidate user cache, not related data like dividends, causing stale data in related endpoints.

### API Changes Needed
1. Implement cascading cache invalidation
2. Add cache dependency tracking
3. Create cache invalidation groups

### Affected Endpoints
- `/api/transactions` (POST, PUT, DELETE)
- `/api/analytics/dividends` (GET)
- `/api/portfolio` (GET)

### Affected Files
- `backend_simplified/backend_api_routes/backend_api_portfolio.py`
- `backend_simplified/services/cache_manager.py` (new file)

### API Tests Required
```python
# Test cascading cache invalidation
def test_transaction_cache_invalidation_cascade():
    # Get initial dividend data
    response1 = client.get("/api/analytics/dividends")
    initial_dividends = response1.json()["data"]
    
    # Add transaction for dividend stock
    transaction_data = {"symbol": "AAPL", "type": "Buy", ...}
    client.post("/api/transactions", json=transaction_data)
    
    # Verify dividend cache invalidated
    response2 = client.get("/api/analytics/dividends")
    assert response2.json()["metadata"]["cache_status"] == "miss"
```

### Implementation Time
- **Estimated**: 6 hours
- **Tasks**: Cache manager (3h), Integration (2h), Testing (1h)

### Breaking Changes
- None, performance improvement only
- **Migration**: Transparent

---

## Issue 7: Decimal/Float Mixing

### Description
Financial calculations convert Decimal to float, causing potential precision loss in monetary calculations.

### API Changes Needed
1. Enforce Decimal usage throughout financial calculations
2. Update JSON serialization to handle Decimal properly
3. Add validation for numeric precision

### Affected Endpoints
- All endpoints handling financial data

### Affected Files
- `backend_simplified/services/portfolio_calculator.py`
- `backend_simplified/services/price_manager.py`
- `backend_simplified/models/validation_models.py`

### API Tests Required
```python
# Test decimal precision
def test_financial_calculation_precision():
    # Test with problematic float values
    transaction_data = {
        "symbol": "BRK.A",
        "price": "542831.99",  # Large value
        "quantity": "0.001",   # Small fraction
        "commission": "0.01"
    }
    response = client.post("/api/transactions", json=transaction_data)
    
    # Verify precision maintained
    portfolio = client.get("/api/portfolio").json()
    holding = next(h for h in portfolio["data"]["holdings"] if h["symbol"] == "BRK.A")
    assert holding["total_value"] == "542.83"  # Exact calculation
```

### Implementation Time
- **Estimated**: 5 hours
- **Tasks**: Decimal enforcement (2h), Serialization (1h), Testing (2h)

### Breaking Changes
- Possible if clients parse numeric values incorrectly
- **Migration**: 
  - v1: Numbers as float JSON
  - v2: Numbers as string JSON for precision
  - Add "numeric_format" in metadata

---

## Issue 8: Missing Pagination in Holdings

### Description
Portfolio and analytics endpoints return all holdings without pagination, causing performance issues for large portfolios.

### API Changes Needed
1. Implement cursor-based pagination
2. Add default and maximum page sizes
3. Include pagination metadata in responses

### Affected Endpoints
- `/api/portfolio` (GET)
- `/api/analytics/holdings` (GET)
- `/api/transactions` (GET)

### Affected Files
- `backend_simplified/backend_api_routes/backend_api_portfolio.py`
- `backend_simplified/backend_api_routes/backend_api_analytics.py`

### API Tests Required
```python
# Test pagination
def test_holdings_pagination():
    # Create 50 holdings
    for i in range(50):
        create_test_transaction(f"TEST{i}")
    
    # Test default page size
    response = client.get("/api/portfolio")
    assert len(response.json()["data"]["holdings"]) == 20  # default
    assert response.json()["metadata"]["has_next"] == True
    assert "next_cursor" in response.json()["metadata"]
    
    # Test with cursor
    next_cursor = response.json()["metadata"]["next_cursor"]
    response2 = client.get(f"/api/portfolio?cursor={next_cursor}")
    assert len(response2.json()["data"]["holdings"]) == 20
```

### Implementation Time
- **Estimated**: 8 hours
- **Tasks**: Pagination logic (4h), API updates (2h), Testing (2h)

### Breaking Changes
- **Yes** for v2 (paginated by default)
- **Migration**:
  - v1: Return all results (deprecated)
  - v2: Paginated with option for `page_size=all`
  - Add deprecation warning for large result sets in v1

---

## Issue 9: Incomplete Market Info Handling

### Description
Transaction creation fails silently when market info fetch fails, resulting in missing timezone/market data for international stocks.

### API Changes Needed
1. Add market info validation
2. Implement fallback for market data
3. Return warnings for incomplete market info

### Affected Endpoints
- `/api/transactions` (POST)
- `/api/stock_overview` (GET)

### Affected Files
- `backend_simplified/backend_api_routes/backend_api_portfolio.py`
- `backend_simplified/services/market_info_service.py`

### API Tests Required
```python
# Test market info fallback
def test_transaction_market_info_fallback():
    # Mock market info failure
    with mock.patch('market_info_service.get_market_info', side_effect=Exception):
        transaction_data = {
            "symbol": "INTL.L",  # International stock
            "price": "100.00",
            "quantity": "10"
        }
        response = client.post("/api/transactions", json=transaction_data)
        
        assert response.status_code == 201
        assert response.json()["metadata"]["warnings"] == ["Market info unavailable, using defaults"]
        assert response.json()["data"]["market"] == "UNKNOWN"
```

### Implementation Time
- **Estimated**: 4 hours
- **Tasks**: Fallback logic (2h), Warning system (1h), Testing (1h)

### Breaking Changes
- None, adds warnings only
- **Migration**: Transparent, clients can optionally handle warnings

---

## Issue 10: Debug Endpoints in Production

### Description
Debug endpoints accessible with just authentication, posing security risk in production environments.

### API Changes Needed
1. Add environment-based endpoint registration
2. Implement admin role requirement
3. Add rate limiting to debug endpoints

### Affected Endpoints
- `/api/debug/toggle-info-logging` (POST)
- `/api/debug/logging-status` (GET)
- `/api/debug/reset-circuit-breaker` (POST)

### Affected Files
- `backend_simplified/main.py`
- `backend_simplified/backend_api_routes/backend_api_dashboard.py`
- `backend_simplified/utils/auth_helpers.py`

### API Tests Required
```python
# Test debug endpoint protection
def test_debug_endpoints_production_disabled():
    with mock.patch.dict(os.environ, {"ENVIRONMENT": "production"}):
        response = client.post("/api/debug/toggle-info-logging")
        assert response.status_code == 404
        
# Test debug endpoint admin requirement
def test_debug_endpoints_require_admin():
    with mock.patch.dict(os.environ, {"ENVIRONMENT": "development"}):
        # Regular user
        response = client.post("/api/debug/toggle-info-logging", headers=user_headers)
        assert response.status_code == 403
        
        # Admin user
        response = client.post("/api/debug/toggle-info-logging", headers=admin_headers)
        assert response.status_code == 200
```

### Implementation Time
- **Estimated**: 3 hours
- **Tasks**: Environment check (1h), Role validation (1h), Testing (1h)

### Breaking Changes
- **Yes** for production environments
- **Migration**:
  - Add `ENABLE_DEBUG_ENDPOINTS=true` for development
  - Production defaults to disabled
  - Admin role required when enabled

---

## Implementation Priority

### Phase 1 (Week 1) - Critical Security & Data Integrity
1. **Issue 5**: JWT Token Forwarding (8h)
2. **Issue 10**: Debug Endpoints Security (3h)
3. **Issue 7**: Decimal/Float Precision (5h)

### Phase 2 (Week 2) - API Consistency
4. **Issue 3**: Error Response Formats (6h)
5. **Issue 1**: Duplicate Routes (4h)
6. **Issue 2**: Type Validation (3h)

### Phase 3 (Week 3) - Performance & Reliability
7. **Issue 4**: Race Conditions (4h)
8. **Issue 6**: Cache Invalidation (6h)
9. **Issue 8**: Pagination (8h)

### Phase 4 (Week 4) - Enhancement
10. **Issue 9**: Market Info Handling (4h)

**Total Estimated Time**: 51 hours

---

## Backward Compatibility Strategy

### Version Support Timeline
- **Months 1-3**: Full dual version support (v1 and v2)
- **Month 4**: v1 deprecated with warnings
- **Month 6**: v1 endpoints removed

### Client Migration Guide
1. Add `X-API-Version: v2` header to all requests
2. Update error handling for v2 format
3. Handle pagination in listing endpoints
4. Parse numeric values as strings for precision
5. Check for warnings in metadata

### Deprecation Warnings
```json
{
  "success": true,
  "data": {...},
  "metadata": {
    "deprecation_warning": "API v1 will be discontinued on 2024-07-01. Please migrate to v2.",
    "migration_guide": "https://docs.portfolio-tracker.com/api/migration"
  }
}
```

---

## Documentation Requirements

### API Documentation Updates
1. OpenAPI/Swagger spec for v2
2. Migration guide with examples
3. Breaking changes changelog
4. Updated authentication guide
5. Error handling guide

### Internal Documentation
1. Architecture decision records (ADRs)
2. Testing strategy document
3. Performance benchmarks
4. Security audit results

---

## Success Metrics

### Technical Metrics
- Zero v1/v2 response format mismatches
- 100% test coverage for API endpoints
- < 100ms p95 response time for paginated endpoints
- Zero precision loss in financial calculations

### Business Metrics
- 90% client migration to v2 within 3 months
- 50% reduction in API-related support tickets
- Zero security incidents from API vulnerabilities

---

## Risk Mitigation

### Rollback Strategy
1. Feature flags for each fix
2. Canary deployment with 5% traffic
3. Automated rollback on error rate > 1%
4. Database migration compatibility

### Monitoring & Alerts
1. API version usage metrics
2. Error rate by endpoint and version
3. Response time percentiles
4. Cache hit rates
5. Precision loss detection

---

## Conclusion

This comprehensive fix plan addresses all 10 identified API issues with a focus on maintaining backward compatibility while improving security, consistency, and performance. The phased approach allows for gradual implementation with minimal disruption to existing clients.

The total implementation time of 51 hours can be distributed across 4 weeks with proper testing and documentation. Success depends on clear communication with API consumers and careful monitoring during the migration period.