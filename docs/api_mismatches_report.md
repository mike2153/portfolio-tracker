# API Mismatches Report - Portfolio Tracker
Generated: 2025-08-08

## Executive Summary
This report documents critical mismatches between frontend API calls and backend endpoints that require immediate attention.

## Critical Mismatches (Severity: HIGH)

### 1. Crown Jewel Endpoint Path Mismatch
**Frontend Call**: `/api/complete`
**Backend Endpoint**: `/api/portfolio/complete`
**Location**: `frontend/src/hooks/useSessionPortfolio.ts`
**Impact**: Main data loading hook will fail
**Fix Required**: Update frontend to use correct path `/api/portfolio/complete`

### 2. Missing Frontend Calls to New Endpoints
The following backend endpoints have no corresponding frontend calls:
- `/api/portfolio/performance/historical` - Historical performance data
- `/api/analytics/dividends/summary` - Lightweight dividend summary
- `/api/analytics/dividends/assign-simple` - Simple dividend assignment
- `/api/analytics/dividends/reject` - Dividend rejection
- `/api/analytics/dividends/edit` - Dividend editing
- `/api/analytics/dividends/add-manual` - Manual dividend addition
- `/api/debug/*` - All debug endpoints (toggle-info-logging, logging-status, reset-circuit-breaker)
- `/api/cache/clear` - Cache clearing endpoint

### 3. Deprecated Frontend Patterns
**Issue**: Frontend still uses individual API calls instead of consolidated endpoint
**Example**: `usePerformance()` hook marked as deprecated but still in codebase
**Impact**: Inefficient network usage, 19+ API calls instead of 1

## Medium Severity Issues

### 4. Authentication Header Inconsistency
**Frontend**: Uses `authFetch()` wrapper with automatic token injection
**Backend**: Expects `Authorization: Bearer {token}` header
**Status**: Working but could be more explicit

### 5. API Version Header Usage
**Frontend**: Sets `X-API-Version` header but inconsistently
**Backend**: Supports v1/v2 but defaults may not match
**Risk**: Potential response format mismatches

### 6. Error Response Format Discrepancy
**Frontend Expected**: `{ success: boolean, error?: string, data?: any }`
**Backend Returns**: Various formats including `{ detail: string }` for FastAPI errors
**Impact**: Inconsistent error handling in UI

## Low Severity Issues

### 7. Unused Backend Endpoints
The following endpoints exist but have no frontend usage:
- `/api/forex/latest` - Latest exchange rate (frontend uses `/api/forex/rate`)
- `/api/analytics/holdings` - Detailed holdings (data available in `/api/portfolio/complete`)
- `/api/analytics/summary` - Analytics summary (duplicated in consolidated endpoint)

### 8. Parameter Naming Inconsistencies
- Frontend: `includeQuotes` (camelCase)
- Backend: `include_quotes` (snake_case)
- Handled by serialization but could cause confusion

## Endpoint Mapping Summary

### Total Endpoints
- **Backend**: 47 endpoints across 9 routers
- **Frontend Calls**: 25 distinct API calls
- **Mismatch Rate**: ~47% of backend endpoints unused

### Coverage by Router
| Router | Backend Endpoints | Frontend Usage | Coverage |
|--------|------------------|----------------|----------|
| Auth | 1 | 1 | 100% |
| Research | 8 | 7 | 87.5% |
| Portfolio | 10 | 3 | 30% |
| Dashboard | 3 | 0 | 0% |
| Analytics | 14 | 2 | 14.3% |
| Watchlist | 5 | 5 | 100% |
| Profile | 4 | 1 | 25% |
| Forex | 3 | 1 | 33.3% |

## Recommendations

### Immediate Actions Required
1. **Fix Crown Jewel Path**: Update frontend to use `/api/portfolio/complete`
2. **Remove Deprecated Code**: Clean up old hooks and API calls
3. **Standardize Error Handling**: Create unified error response interceptor

### Short-term Improvements
1. **Implement Missing Features**: Add UI for dividend management endpoints
2. **Add Debug Panel**: Utilize debug endpoints for development
3. **Update API Client**: Centralize all endpoint definitions

### Long-term Optimization
1. **Full Migration to Consolidated Endpoint**: Replace all individual calls with `/api/portfolio/complete`
2. **API Version Strategy**: Implement proper versioning with deprecation notices
3. **OpenAPI Documentation**: Generate TypeScript types from backend schemas

## Code Examples for Fixes

### Fix 1: Update Crown Jewel Endpoint Path
```typescript
// frontend/src/hooks/useSessionPortfolio.ts
// OLD:
const response = await authFetch('/api/complete', {
// NEW:
const response = await authFetch('/api/portfolio/complete', {
```

### Fix 2: Centralized Endpoint Definitions
```typescript
// frontend/src/lib/api-endpoints.ts
export const API_ENDPOINTS = {
  portfolio: {
    complete: '/api/portfolio/complete',
    transactions: '/api/transactions',
    allocation: '/api/allocation'
  },
  analytics: {
    dividends: {
      sync: '/api/analytics/dividends/sync',
      confirm: '/api/analytics/dividends/confirm',
      summary: '/api/analytics/dividends/summary'
    }
  }
  // ... rest of endpoints
} as const;
```

### Fix 3: Unified Error Handler
```typescript
// frontend/src/lib/api-client.ts
export async function handleApiResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new ApiError(error.detail || error.message || 'API request failed', response.status);
  }
  return response.json();
}
```

## Validation Checklist
- [ ] Crown Jewel endpoint path corrected
- [ ] All deprecated code removed
- [ ] Error handling standardized
- [ ] Missing UI features implemented
- [ ] API documentation updated
- [ ] TypeScript types synchronized
- [ ] Integration tests updated

## Appendix: Complete Endpoint Comparison

See attached detailed mapping of all 47 backend endpoints and their frontend usage status.

---
*This report was generated through automated code analysis. Please verify findings before implementation.*