# Portfolio Chart Implementation Documentation

## Overview

This document captures the complete implementation logic for the portfolio performance chart on the dashboard page. This includes all backend calculations, time series logic, index simulation, and frontend rendering. The purpose is to preserve the exact functionality in case any refactoring affects the chart behavior.

## Critical Components

### 1. Backend Performance Endpoint

**File:** `backend_simplified/backend_api_routes/backend_api_dashboard.py`  
**Endpoint:** `GET /api/dashboard/performance`

#### Request Parameters
```python
period: str = "1M"  # Options: 1D, 1W, 1M, 3M, 6M, 1Y, ALL
benchmark: str = "SPY"  # Options: SPY, QQQ, A200, URTH, VTI, VXUS
```

#### Core Logic Flow

```python
# 1. Validate benchmark
benchmark = benchmark.upper()
if not ISU.validate_benchmark(benchmark):
    raise HTTPException(status_code=400, detail=f"Unsupported benchmark: {benchmark}")

# 2. Calculate date range
start_date, end_date = portfolio_calculator._compute_date_range(period)

# 3. Parallel execution
portfolio_task = asyncio.create_task(
    portfolio_calculator.calculate_portfolio_time_series(uid, jwt, period)
)

# 4. Get rebalanced index series
index_series = await ISS.get_index_sim_series(
    user_id=uid,
    benchmark=benchmark,
    start_date=start_date,
    end_date=end_date,
    user_token=jwt
)

# 5. Await portfolio series
portfolio_result = await portfolio_task
```

#### Index-Only Fallback Mode

When no portfolio data exists:
```python
if portfolio_meta.get("no_data"):
    # Get index-only series
    index_only_series, index_only_meta = await portfolio_calculator.calculate_index_time_series(
        user_id=uid,
        user_token=jwt,
        range_key=period,
        benchmark=benchmark
    )
    
    return {
        "success": True,
        "period": period,
        "benchmark": benchmark,
        "portfolio_performance": [],  # Empty
        "benchmark_performance": index_only_chart_data,
        "metadata": {
            "no_data": False,
            "index_only": True,
            "reason": "no_portfolio_data",
            "user_guidance": "Add transactions to see portfolio comparison",
            "chart_type": "index_only_mode"
        },
        "performance_metrics": {
            "portfolio_return_pct": 0,
            "index_return_pct": calculated_index_return,
            "outperformance_pct": 0,
            "index_only_mode": True
        }
    }
```

#### Data Filtering and Alignment

```python
# Filter out zero values (non-trading days)
portfolio_series_filtered = []
zero_count = 0
for d, v in portfolio_series:
    decimal_value = _safe_decimal(v)
    if decimal_value > 0:
        portfolio_series_filtered.append((d, decimal_value))
    else:
        zero_count += 1

# Match index series to portfolio dates
portfolio_dates = {d for d, v in portfolio_series_dec}
index_chart_data = []
for d, v in final_index_series_dec:
    if d in portfolio_dates:
        chart_point = {"date": d.isoformat(), "value": float(v)}
        index_chart_data.append(chart_point)
```

### 2. Index Simulation Service

**File:** `backend_simplified/services/index_sim_service.py`  
**Method:** `get_index_sim_series`

#### Rebalanced Index Simulation Logic

```python
async def get_index_sim_series(
    user_id: str,
    benchmark: str,
    start_date: date,
    end_date: date,
    user_token: str
) -> List[Tuple[date, Decimal]]:
    """
    Simulates buying fractional shares of the benchmark index using the 
    same cash flows as the user's actual transactions.
    """
    
    # Step 1: Get user's portfolio value at start_date
    start_series, start_meta = await portfolio_calculator.calculate_portfolio_time_series(
        user_id=user_id,
        user_token=user_token,
        range_key="MAX"
    )
    
    # Find portfolio value at start date
    start_value = Decimal('0')
    for series_date, series_value in start_series:
        if series_date >= start_date:
            start_value = series_value
            break
    
    # Step 2: Get user transactions within date range
    transactions = _get_user_transactions_in_range(start_date, end_date)
    
    # Step 3: Get benchmark prices
    bench_prices = _get_benchmark_prices(benchmark, start_date, end_date)
    
    # Step 4: Simulate index purchases
    sim_data = _simulate_rebalanced_index(
        start_value=start_value,
        start_date=start_date,
        transactions=transactions,
        bench_prices=bench_prices
    )
    
    # Step 5: Generate daily series
    return _generate_daily_series(sim_data, start_date, end_date)
```

#### Cash Flow Simulation

```python
def _simulate_rebalanced_index(
    start_value: Decimal,
    start_date: date,
    transactions: List[Dict],
    bench_prices: Dict[date, Decimal]
) -> Dict[date, Tuple[Decimal, Decimal]]:
    """
    Tracks (shares, cash) for each date with a transaction.
    """
    sim_data = {}
    
    # Seed with starting portfolio value
    start_price = bench_prices.get(start_date, None)
    if start_price and start_value > 0:
        initial_shares = start_value / start_price
        sim_data[start_date] = (initial_shares, Decimal('0'))
    
    # Process each transaction
    for txn in transactions:
        txn_date = txn['date']
        price = bench_prices.get(txn_date)
        
        if not price:
            continue
            
        # Get current position
        shares, cash = _get_latest_position(sim_data, txn_date)
        
        # Apply transaction
        if txn['transaction_type'] in ['Buy', 'BUY']:
            # Buy index with the cash inflow
            cash_in = txn['quantity'] * txn['price']
            new_shares = cash_in / price
            shares += new_shares
        elif txn['transaction_type'] in ['Sell', 'SELL']:
            # Sell index shares
            cash_out = txn['quantity'] * txn['price']
            shares_to_sell = cash_out / price
            shares -= shares_to_sell
        
        sim_data[txn_date] = (shares, cash)
    
    return sim_data
```

### 3. Portfolio Time Series Calculation

**File:** `backend_simplified/services/portfolio_calculator.py`  
**Method:** `calculate_portfolio_time_series`

#### Core Calculation Logic

```python
async def calculate_portfolio_time_series(
    user_id: str,
    user_token: str,
    range_key: str = "1M",
    benchmark: Optional[str] = None
) -> Tuple[List[Tuple[date, Decimal]], Dict[str, Any]]:
    
    # Get date range
    start_date, end_date = _compute_date_range(range_key)
    
    # Get all transactions
    transactions = await supa_api_get_user_transactions(
        user_id=user_id,
        limit=10000,
        user_token=user_token
    )
    
    # Filter by date
    relevant_txns = [
        t for t in transactions 
        if datetime.strptime(t['date'], '%Y-%m-%d').date() <= end_date
    ]
    
    # Get historical prices
    symbols = list(set(t['symbol'] for t in relevant_txns))
    price_data = await price_manager.get_portfolio_prices_for_charts(
        symbols=symbols,
        start_date=start_date,
        end_date=end_date,
        user_token=user_token
    )
    
    # Build price lookup
    price_lookup = defaultdict(dict)
    for record in price_data:
        symbol = record['symbol']
        price_date = datetime.strptime(record['date'], '%Y-%m-%d').date()
        price_lookup[symbol][price_date] = Decimal(str(record['close']))
    
    # Calculate daily portfolio values
    time_series = []
    trading_days = _get_trading_days(start_date, end_date, range_key)
    
    for current_date in trading_days:
        holdings = _calculate_holdings_for_date(
            transactions=relevant_txns,
            target_date=current_date
        )
        
        portfolio_value = Decimal('0')
        for symbol, quantity in holdings.items():
            if quantity > 0:
                price = _get_price_for_date(
                    symbol, current_date, price_lookup[symbol]
                )
                if price:
                    portfolio_value += quantity * price
        
        if portfolio_value > 0:
            time_series.append((current_date, portfolio_value))
    
    # Remove leading zeros
    while time_series and time_series[0][1] == 0:
        time_series.pop(0)
    
    return time_series, metadata
```

#### Date Range Computation

```python
def _compute_date_range(range_key: str) -> Tuple[date, date]:
    today = date.today()
    
    if range_key == "7D":
        start_date = today - timedelta(days=7)
    elif range_key == "1M":
        start_date = today - timedelta(days=30)
    elif range_key == "3M":
        start_date = today - timedelta(days=90)
    elif range_key == "6M":
        start_date = today - timedelta(days=180)
    elif range_key == "1Y":
        start_date = today - timedelta(days=365)
    elif range_key == "YTD":
        start_date = date(today.year, 1, 1)
    elif range_key == "MAX":
        start_date = date(2020, 1, 1)
    else:
        start_date = today - timedelta(days=30)
    
    return start_date, today
```

#### Holdings Calculation for Specific Date

```python
def _calculate_holdings_for_date(
    transactions: List[Dict[str, Any]],
    target_date: date
) -> Dict[str, Decimal]:
    holdings = defaultdict(lambda: Decimal('0'))
    
    for txn in transactions:
        txn_date = datetime.strptime(txn['date'], '%Y-%m-%d').date()
        if txn_date > target_date:
            continue
        
        symbol = txn['symbol']
        quantity = Decimal(str(txn['quantity']))
        
        if txn['transaction_type'] in ['Buy', 'BUY']:
            holdings[symbol] += quantity
        elif txn['transaction_type'] in ['Sell', 'SELL']:
            holdings[symbol] -= quantity
    
    # Remove zero or negative holdings
    return {s: q for s, q in holdings.items() if q > 0}
```

### 4. Performance Metrics Calculation

```python
def calculate_performance_metrics(
    portfolio_series: List[Tuple[date, Decimal]], 
    index_series: List[Tuple[date, Decimal]]
) -> Dict[str, float]:
    
    if not portfolio_series or not index_series:
        return {
            "portfolio_return_pct": 0,
            "index_return_pct": 0,
            "outperformance_pct": 0
        }
    
    # Get start and end values
    portfolio_start = portfolio_series[0][1]
    portfolio_end = portfolio_series[-1][1]
    index_start = index_series[0][1]
    index_end = index_series[-1][1]
    
    # Calculate returns
    portfolio_return = 0
    if portfolio_start > 0:
        portfolio_return = ((portfolio_end - portfolio_start) / portfolio_start) * 100
    
    index_return = 0
    if index_start > 0:
        index_return = ((index_end - index_start) / index_start) * 100
    
    return {
        "portfolio_return_pct": float(portfolio_return),
        "index_return_pct": float(index_return),
        "outperformance_pct": float(portfolio_return - index_return)
    }
```

### 5. Response Format

#### Standard Response
```json
{
    "success": true,
    "period": "1M",
    "benchmark": "SPY",
    "portfolio_performance": [
        {"date": "2024-01-01", "value": 10000.00},
        {"date": "2024-01-02", "value": 10150.50}
    ],
    "benchmark_performance": [
        {"date": "2024-01-01", "value": 10000.00},
        {"date": "2024-01-02", "value": 10200.00}
    ],
    "metadata": {
        "trading_days_count": 20,
        "start_date": "2024-01-01",
        "end_date": "2024-01-31",
        "benchmark_name": "SPY",
        "calculation_timestamp": "2024-01-31T15:30:00Z",
        "chart_type": "discrete_trading_days"
    },
    "performance_metrics": {
        "portfolio_return_pct": 5.25,
        "index_return_pct": 4.75,
        "outperformance_pct": 0.50
    }
}
```

#### Index-Only Mode Response
```json
{
    "success": true,
    "period": "1M",
    "benchmark": "SPY",
    "portfolio_performance": [],
    "benchmark_performance": [
        {"date": "2024-01-01", "value": 450.00},
        {"date": "2024-01-02", "value": 452.50}
    ],
    "metadata": {
        "no_data": false,
        "index_only": true,
        "reason": "no_portfolio_data",
        "user_guidance": "Add transactions to see portfolio comparison",
        "chart_type": "index_only_mode"
    },
    "performance_metrics": {
        "portfolio_return_pct": 0,
        "index_return_pct": 2.5,
        "outperformance_pct": 0,
        "index_only_mode": true
    }
}
```

## Frontend Implementation Details

### Chart Component Key Features

1. **Data Alignment**: Ensures portfolio and benchmark series have same date range
2. **Percentage Mode**: Calculates returns from initial value
3. **Value Mode**: Shows absolute dollar amounts
4. **Index-Only Detection**: Checks metadata flags for special rendering
5. **User Guidance**: Displays helpful messages when no portfolio data

### Chart Configuration

```typescript
const chartOptions = {
    chart: {
        type: 'area',
        height: 400,
        toolbar: { show: false }
    },
    colors: ['#10b981', '#6b7280'], // Green for portfolio, gray for benchmark
    stroke: {
        curve: 'smooth',
        width: 2
    },
    fill: {
        type: 'gradient',
        gradient: {
            shadeIntensity: 1,
            opacityFrom: 0.4,
            opacityTo: 0.1
        }
    },
    xaxis: {
        type: 'datetime',
        labels: {
            datetimeUTC: false
        }
    },
    yaxis: {
        labels: {
            formatter: (value) => displayMode === 'percentage' 
                ? `${value.toFixed(2)}%` 
                : `$${value.toFixed(2)}`
        }
    }
}
```

## Critical Edge Cases Handled

1. **No Transactions**: Shows index-only mode with guidance
2. **Missing Prices**: Uses forward-fill from most recent available price
3. **Weekend/Holiday Dates**: Filtered out to show only trading days
4. **Zero Portfolio Values**: Removed from series to prevent chart distortion
5. **Mismatched Date Ranges**: Index series filtered to match portfolio dates
6. **Failed Calculations**: Fallback to cached or empty data with appropriate messaging

## Dependencies and Requirements

- Python `Decimal` type for all backend calculations
- JWT token for all database queries (RLS compliance)
- AsyncIO for parallel data fetching
- ApexCharts for frontend visualization
- React hooks for state management and memoization

This document preserves the complete implementation logic for the portfolio performance chart. Any changes to the system should maintain this exact functionality to ensure consistent user experience.