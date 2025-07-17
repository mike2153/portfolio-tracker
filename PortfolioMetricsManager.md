Of course. Here is the updated architecture design document for the `PortfolioMetricsManager`, incorporating our refined 5-step plan and the decision to use a SQL-based cache instead of Redis.

-----

# 📊 Portfolio Metrics Manager - Architecture & Refactoring Plan

## 📋 Executive Summary

This document outlines a comprehensive refactoring plan for the Portfolio Tracker application's backend. The central goal is to create a robust, efficient, and maintainable architecture by consolidating scattered logic into a set of services with clear, single responsibilities.

The cornerstone of this new architecture will be a centralized **`PortfolioMetricsManager`**. This service will serve as the single source of truth for all portfolio performance calculations, orchestrating calls to specialized services for financial math (`PortfolioCalculator`) and price data (`PriceManager`), while implementing a persistent caching layer to ensure high performance.

## 🎯 Objectives

1.  **Centralization**: Create one authoritative service for all portfolio calculations.
2.  **Simplicity & Maintainability**: Drastically reduce the number of services and eliminate redundant code. Each service will have a single, well-defined responsibility.
3.  **Accuracy**: Fix critical flaws in the existing cost basis and performance calculations to ensure all user-facing metrics are correct.
4.  **Performance**: Implement an intelligent, persistent caching layer for calculated portfolio metrics to minimize database load and API calls, resulting in a faster user experience.
5.  **Consistency**: Ensure uniform data structures and calculation methods across the entire application by using unified Pydantic response models.

## 🏗️ Current Architecture Analysis

### Identified Issues

1.  **Scattered Logic**: Price and market status logic is spread across three different services (`CurrentPriceManager`, `PriceDataService`, `MarketStatusService`), causing confusion and inefficiency.
2.  **Inaccurate Calculations**: The current cost basis calculation after a sale is incorrect, leading to inaccurate P\&L reporting. The IRR calculation is an oversimplified placeholder.
3.  **No Caching for Calculated Metrics**: Complex portfolio calculations are performed from scratch on every request, creating a significant performance bottleneck.
4.  **Complex API Routes**: API endpoints contain business logic, making them "thick" and difficult to maintain.

## 🚀 Proposed New Architecture: The 5-Step Plan

### New Service Structure

```
backend_simplified/
└── services/
    ├── portfolio_metrics_manager.py  # NEW: The main entry point for portfolio data.
    ├── portfolio_calculator.py       # REFACTORED: The engine for all financial math.
    ├── price_manager.py              # NEW: The single source for all price data.
    ├── dividend_service.py           # REFACTORED: Integrated with the new managers.
    └── financials_service.py         # Unchanged: Manages company financial statements.
```

### Enhanced Data Flow

```mermaid
graph TD
    A[Frontend Request] --> B{API Route};
    B --> C[PortfolioMetricsManager];
    C --> D{Metrics Cache (Supabase)};
    D -- Cache Hit --> G[Response];
    D -- Cache Miss --> E[PortfolioCalculator];
    E --> F[PriceManager];
    F --> H[Supabase / Alpha Vantage];
    E --> G;
    C --> G;
```

-----

## 💻 Implementation Details

### **Step 1: Create the `PriceManager`**

This service will become the sole gatekeeper for all price and market data.

  * **Responsibilities**:
      * Fetching real-time and historical prices from Alpha Vantage.
      * Checking market open/closed status.
      * Managing the database cache for raw price data to minimize API calls.
  * **Action**: Create `services/price_manager.py` by merging all logic from `current_price_manager.py`, `price_data_service.py`, and `market_status_service.py`. Then, delete the three old files.

### **Step 2: Create the `PortfolioMetricsManager`**

This service will orchestrate all portfolio calculations.

  * **Responsibilities**:
      * Providing a single public method (`get_portfolio_metrics`) for the API routes to call.
      * Managing a **persistent cache for final, calculated portfolio metrics** using a Supabase SQL table (e.g., `portfolio_metrics_cache`).
      * Orchestrating `asyncio` tasks to call the `PortfolioCalculator` and `DividendService` in parallel.
  * **Action**: Create `services/portfolio_metrics_manager.py` as detailed in the original design document, but **replace the Redis cache with a SQL-based cache**.

### **Step 3: Fix and Consolidate the `PortfolioCalculator`**

This service will be the dedicated engine for all financial mathematics.

  * **Responsibilities**:
      * Calculating holdings, cost basis, and realized/unrealized P\&L using the **correct FIFO method**.
      * Calculating time-series performance data.
      * Calculating a true, cash-flow-aware **XIRR**.
  * **Action**:
      * Merge the logic from `portfolio_service.py` into `portfolio_calculator.py`.
      * **Crucially, delete the incorrect `_process_transactions` function and exclusively use the `_process_transactions_with_realized_gains` method for all calculations**.
      * Delete `portfolio_service.py`.

### **Step 4: Update API Routes**

The API endpoints will become simple and "thin."

  * **Responsibilities**:
      * Handling incoming HTTP requests and user authentication.
      * Making a single call to the `PortfolioMetricsManager`.
      * Formatting the final response to the user.
  * **Action**: Refactor the route handlers in `backend_api_dashboard.py` and `backend_api_analytics.py` to remove all complex logic and delegate work to the `PortfolioMetricsManager`.

### **Step 5: Refactor the `DividendService`**

The `DividendService` will be integrated into the new architecture.

  * **Responsibilities**:
      * Managing all business logic related to dividends (syncing, confirming, rejecting).
  * **Action**:
      * Remove all direct database and Alpha Vantage calls from `dividend_service.py`.
      * Update its methods to receive necessary data (like transaction history) from the `PortfolioMetricsManager` and to request dividend price history from the `PriceManager`.

-----

## 🧪 Testing and Migration

  * **Testing**: Each new service will be accompanied by unit tests to validate its logic, especially for the `PortfolioCalculator`'s financial math and the `PortfolioMetricsManager`'s caching strategy.
  * **Migration**: The refactoring will be implemented using feature flags or a parallel-run approach, allowing us to validate the new system's accuracy and performance against the old one before making the final switch.

## 🎯 Success Metrics

1.  **Performance**: Achieve a \>80% cache hit rate for the `PortfolioMetricsManager`, leading to a \>50% reduction in API response times for cached requests.
2.  **Accuracy**: All portfolio P\&L metrics must match the results of the corrected FIFO-based calculation.
3.  **Code Simplification**: The total line count of the `services` directory should be reduced, and the API routes should contain minimal business logic.
4.  **Maintainability**: The new structure should make it demonstrably easier and faster to add a new portfolio metric in the future.