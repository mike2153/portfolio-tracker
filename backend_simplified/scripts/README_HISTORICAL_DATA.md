# Historical Price Data Management

## Overview

This system fetches and stores **complete historical price data** for all stocks that users have transactions for. The data is stored in the database for fast portfolio calculations and price lookups.

## Key Features

- **Database-First Approach**: Historical prices are stored in PostgreSQL for fast access
- **Complete Data**: Fetches ALL available historical data from Alpha Vantage (not just recent data)
- **Smart Caching**: Only fetches from Alpha Vantage when data is missing
- **Portfolio Calculations**: Enables accurate portfolio performance calculations
- **Transaction Price Lookup**: Auto-populates transaction forms with historical closing prices

## Database Schema

The `historical_prices` table stores daily price data:

```sql
CREATE TABLE historical_prices (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    open DECIMAL(12, 4) NOT NULL,
    high DECIMAL(12, 4) NOT NULL,
    low DECIMAL(12, 4) NOT NULL,
    close DECIMAL(12, 4) NOT NULL,
    adjusted_close DECIMAL(12, 4) NOT NULL,
    volume BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(symbol, date)
);
```

## Setup Instructions

### 1. Database Migration

Run the database migration to create the historical prices table:

```bash
# Apply the schema changes
psql -d your_database < supabase/schema.sql
```

### 2. Seed Historical Data

Use the seeding script to populate historical data for all symbols that users have transactions for:

```bash
# Navigate to the scripts directory
cd backend_simplified/scripts

# Seed all symbols (recommended for initial setup)
python seed_historical_data.py

# Seed a specific symbol
python seed_historical_data.py --symbol AAPL

# Dry run to see what would be done
python seed_historical_data.py --dry-run

# Force update even if data exists
python seed_historical_data.py --force
```

### 3. Monitor Progress

The seeding script creates detailed logs:

```bash
# Check the log file
tail -f historical_data_seed.log
```

## API Usage

### Frontend API Client

```typescript
// Auto-populate transaction form with historical price
const response = await front_api_client.front_api_get_historical_price({
  symbol: 'AAPL',
  date: '2024-01-15'
});

if (response.ok && response.data?.success) {
  const closingPrice = response.data.price_data.close;
  setFormField('purchase_price', closingPrice.toString());
}
```

### Backend API Endpoint

```
GET /api/historical_price/{symbol}?date=2024-01-15
```

Response:
```json
{
  "success": true,
  "symbol": "AAPL",
  "requested_date": "2024-01-15",
  "actual_date": "2024-01-15",
  "is_exact_date": true,
  "price_data": {
    "open": 185.00,
    "high": 188.50,
    "low": 184.25,
    "close": 187.25,
    "adjusted_close": 187.25,
    "volume": 45678900
  },
  "message": "Historical price for AAPL on 2024-01-15"
}
```

## Data Flow

1. **User enters transaction**: Selects ticker and date in transaction form
2. **Frontend calls API**: `front_api_get_historical_price(symbol, date)`
3. **Backend checks database**: Uses `get_historical_price_for_date()` function
4. **If data exists**: Returns price immediately from database
5. **If data missing**: Fetches FULL historical data from Alpha Vantage and stores in database
6. **Returns result**: Price data with exact date or closest trading day

## Rate Limiting

- Alpha Vantage allows 5 API calls per minute
- The seeding script automatically waits 15 seconds between calls
- Database-first approach minimizes API calls

## Maintenance

### Daily Updates

Set up a cron job to update prices daily:

```bash
# Add to crontab (run at 6 PM EST after market close)
0 18 * * 1-5 cd /path/to/backend_simplified/scripts && python seed_historical_data.py
```

### Add New Symbols

When users add transactions for new symbols, the system automatically:
1. Detects the new symbol on first price lookup
2. Fetches complete historical data from the earliest transaction date
3. Stores data in database for future use

## Troubleshooting

### Common Issues

1. **Rate Limiting**: If you hit Alpha Vantage rate limits, wait and retry
2. **Missing Data**: Some symbols may not have data for certain dates (weekends, holidays)
3. **Large Datasets**: Initial seeding may take time for symbols with long histories

### Logs

Check logs for detailed information:

```bash
# Backend logs
tail -f backend_simplified/app.log

# Seeding logs
tail -f backend_simplified/scripts/historical_data_seed.log

# Frontend console logs (in browser dev tools)
# Look for "PRICE LOOKUP REQUEST" and "PRICE LOOKUP SUCCESS" entries
```

### Database Queries

Check data coverage:

```sql
-- See which symbols have data
SELECT symbol, COUNT(*) as days, MIN(date) as earliest, MAX(date) as latest 
FROM historical_prices 
GROUP BY symbol 
ORDER BY symbol;

-- Check coverage for specific symbol
SELECT COUNT(*) as total_days, MIN(date) as earliest, MAX(date) as latest 
FROM historical_prices 
WHERE symbol = 'AAPL';
```

## Performance

- **Database lookups**: ~1-5ms
- **Alpha Vantage API calls**: ~500-2000ms
- **Full symbol seeding**: ~2-5 minutes per symbol (due to rate limits)

The database-first approach provides significant performance improvements for repeated lookups. 