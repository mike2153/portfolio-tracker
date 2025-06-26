# 🧪 End-to-End Test Suite

## Overview
This E2E test suite validates the entire financial dashboard application using **REAL** services:
- ✅ Real Supabase authentication & database
- ✅ Real Django backend with PostgreSQL
- ✅ Real Alpha Vantage API calls
- ✅ Real frontend React components
- ✅ Real user interaction simulation

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Playwright    │───▶│   Frontend      │───▶│   Backend API   │
│   E2E Tests     │    │   (Next.js)     │    │   (Django)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Test Data     │    │   Supabase      │    │  Alpha Vantage  │
│   Seeding       │    │   (Auth + DB)   │    │      API        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Test Environment Setup

### 1. Test Databases
- **Supabase Test Project**: Separate test instance
- **Django Test DB**: PostgreSQL test database
- **Transaction Data**: Real test transactions with actual tickers

### 2. API Configuration
- **Alpha Vantage**: Test API key with rate limiting
- **Authentication**: Real Supabase JWT tokens
- **CORS**: Configured for test domains

### 3. Test Data
- **Real Stock Tickers**: AAPL, MSFT, GOOGL, TSLA, etc.
- **Realistic Transactions**: Buy/sell/dividend history
- **Time-based Data**: Historical transactions over 1+ years

## Test Scenarios

### 🔐 Authentication Tests
- User registration flow
- Login/logout cycles
- Session persistence
- Token refresh

### 📊 Dashboard KPI Tests
- Portfolio value calculation with real prices
- IRR calculation with time-weighted returns
- Dividend yield from actual dividend data
- Portfolio beta vs real market indices

### 📈 Financial Calculations
- Real Alpha Vantage price fetching
- Historical data integration
- Market benchmark comparisons
- Currency conversion (if applicable)

### 🎯 User Interface Tests
- KPI box rendering with real data
- Chart displays with actual performance
- Loading states and error handling
- Mobile responsiveness

### 🔄 Data Flow Tests
- Transaction creation → Portfolio update
- Price updates → KPI recalculation
- Real-time data refresh
- Cache invalidation

## Running the Tests

```bash
# Setup test environment
npm run test:e2e:setup

# Run full E2E suite
npm run test:e2e

# Run specific test category
npm run test:e2e:dashboard
npm run test:e2e:auth
npm run test:e2e:transactions

# Run with real API calls (slower)
npm run test:e2e:real-api

# Run in CI/CD pipeline
npm run test:e2e:ci
```

## Test Data Management

### Seed Realistic Data
```typescript
// Create 1 year of realistic transaction history
await seedTestTransactions({
  userId: testUser.id,
  tickers: ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA'],
  timespan: '365 days',
  transactionTypes: ['BUY', 'SELL', 'DIVIDEND'],
  investmentAmount: 50000 // $50k test portfolio
});
```

### Cleanup After Tests
```typescript
// Clean up test data
await cleanupTestData(testUser.id);
await deleteTestUser(testUser.id);
```

## Expected Results

### ✅ What Should Pass
- KPI boxes show real calculated values (not zeros)
- API calls return actual market data
- Authentication flows work end-to-end
- Charts display real performance data
- Error handling works with real API failures

### 📊 Performance Benchmarks
- Dashboard load time: < 3 seconds
- API response time: < 2 seconds
- KPI calculation: < 1 second
- Chart rendering: < 1 second

## Monitoring & Debugging

### Real-time Logs
- Backend Django logs
- Frontend console logs
- API request/response traces
- Database query logs
- Alpha Vantage API usage

### Test Reports
- Detailed HTML reports
- Screenshot capture on failures
- Video recordings of test runs
- Performance metrics
- API call statistics

## CI/CD Integration

### GitHub Actions
```yaml
name: E2E Test Suite
on: [push, pull_request]
jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup test environment
      - name: Run E2E tests with real APIs
      - name: Upload test reports
```

## Cost Management

### API Usage Limits
- Alpha Vantage: 5 calls/minute, 500/day (free tier)
- Supabase: Test project limits
- Database: Cleanup after tests

### Test Optimization
- Cache API responses during test runs
- Use test data where possible
- Limit real API calls to critical paths
- Parallel test execution with rate limiting 