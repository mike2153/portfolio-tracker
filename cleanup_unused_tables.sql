-- =====================================================
-- PORTFOLIO TRACKER: UNUSED TABLE CLEANUP SCRIPT
-- =====================================================
-- WARNING: This script will permanently delete tables and all their data.
-- ALWAYS create backups before running this script in production!
-- 
-- Run this in the following order:
-- 1. Create backups (see backup section below)
-- 2. Test in development environment first
-- 3. Run DROP commands
-- 4. Verify application still works
-- =====================================================

-- =====================================================
-- STEP 1: CREATE BACKUPS (Run this first!)
-- =====================================================

-- Backup potentially useful data before dropping
CREATE TABLE IF NOT EXISTS backup_holdings_cleanup AS SELECT * FROM public.holdings;
CREATE TABLE IF NOT EXISTS backup_portfolios_cleanup AS SELECT * FROM public.portfolios;
CREATE TABLE IF NOT EXISTS backup_stocks_cleanup AS SELECT * FROM public.stocks;
CREATE TABLE IF NOT EXISTS backup_price_alerts_cleanup AS SELECT * FROM public.price_alerts;
CREATE TABLE IF NOT EXISTS backup_users_cleanup AS SELECT * FROM public.users;

-- =====================================================
-- STEP 2: DROP UNUSED CORE TABLES
-- =====================================================

-- Legacy business tables (not found in active code)
DROP TABLE IF EXISTS public.holdings CASCADE;
DROP TABLE IF EXISTS public.portfolios CASCADE;
DROP TABLE IF EXISTS public.stocks CASCADE;
DROP TABLE IF EXISTS public.price_alerts CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- =====================================================
-- STEP 3: DROP REDUNDANT CACHE TABLES
-- =====================================================

-- Duplicate/unused cache tables
DROP TABLE IF EXISTS public.market_holidays_cache CASCADE;
DROP TABLE IF EXISTS public.price_quote_cache CASCADE;
DROP TABLE IF EXISTS public.portfolio_metrics_cache CASCADE;
DROP TABLE IF EXISTS public.price_update_sessions CASCADE;

-- =====================================================
-- STEP 4: DROP UNUSED FEATURE TABLES
-- =====================================================

-- Rate limiting (feature not implemented)
DROP TABLE IF EXISTS public.rate_limits CASCADE;

-- Symbol exchange mapping (not used in code)
DROP TABLE IF EXISTS public.symbol_exchanges CASCADE;

-- Legacy dividend sync state tables
DROP TABLE IF EXISTS public.dividend_sync_state CASCADE;
DROP TABLE IF EXISTS public.global_dividend_sync_state CASCADE;

-- =====================================================
-- STEP 5: VERIFY REMAINING TABLES
-- =====================================================

-- Run this to see what tables remain
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- =====================================================
-- EXPECTED REMAINING TABLES (23 active tables):
-- =====================================================
/*
api_cache
api_usage
audit_log
cache_refresh_jobs
circuit_breaker_state
company_financials
distributed_locks
forex_rates
historical_prices
market_holidays
market_info_cache
portfolio_caches
previous_day_price_cache
price_request_cache
price_update_log
stock_symbols
transactions
user_currency_cache
user_dividends
user_performance
user_performance_cache
user_profiles
watchlist
*/

-- =====================================================
-- STEP 6: CLEANUP BACKUP TABLES (Optional - run later)
-- =====================================================

-- After confirming everything works, you can remove backups:
-- DROP TABLE IF EXISTS backup_holdings_cleanup;
-- DROP TABLE IF EXISTS backup_portfolios_cleanup;
-- DROP TABLE IF EXISTS backup_stocks_cleanup;
-- DROP TABLE IF EXISTS backup_price_alerts_cleanup;
-- DROP TABLE IF EXISTS backup_users_cleanup;

-- =====================================================
-- ROLLBACK SCRIPT (Emergency use only)
-- =====================================================

-- If something breaks, you can restore from backups:
/*
CREATE TABLE public.holdings AS SELECT * FROM backup_holdings_cleanup;
CREATE TABLE public.portfolios AS SELECT * FROM backup_portfolios_cleanup;
CREATE TABLE public.stocks AS SELECT * FROM backup_stocks_cleanup;
CREATE TABLE public.price_alerts AS SELECT * FROM backup_price_alerts_cleanup;
CREATE TABLE public.users AS SELECT * FROM backup_users_cleanup;
*/