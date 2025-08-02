-- Migration 008 Rollback: Remove Comprehensive RLS Policies
-- Purpose: Emergency rollback for RLS policy implementation
-- WARNING: This rollback removes all security isolation - use only in emergency
-- Date: 2025-07-30
-- Author: Supabase Schema Architect

-- =============================================================================
-- EMERGENCY ROLLBACK - REMOVES ALL RLS SECURITY
-- =============================================================================

-- WARNING: This rollback will remove ALL user data isolation security.
-- Only use this in emergency situations where RLS is causing system failures.
-- After rollback, users will be able to access other users' data.

BEGIN;

-- =============================================================================
-- STEP 1: DROP ALL USER ISOLATION POLICIES
-- =============================================================================

-- PORTFOLIOS TABLE POLICIES
DROP POLICY IF EXISTS "portfolios_user_isolation_select" ON public.portfolios;
DROP POLICY IF EXISTS "portfolios_user_isolation_insert" ON public.portfolios;
DROP POLICY IF EXISTS "portfolios_user_isolation_update" ON public.portfolios;
DROP POLICY IF EXISTS "portfolios_user_isolation_delete" ON public.portfolios;
DROP POLICY IF EXISTS "portfolios_service_role_access" ON public.portfolios;

-- TRANSACTIONS TABLE POLICIES
DROP POLICY IF EXISTS "transactions_user_isolation_select" ON public.transactions;
DROP POLICY IF EXISTS "transactions_user_isolation_insert" ON public.transactions;
DROP POLICY IF EXISTS "transactions_user_isolation_update" ON public.transactions;
DROP POLICY IF EXISTS "transactions_user_isolation_delete" ON public.transactions;
DROP POLICY IF EXISTS "transactions_service_role_access" ON public.transactions;

-- HOLDINGS TABLE POLICIES
DROP POLICY IF EXISTS "holdings_user_isolation_select" ON public.holdings;
DROP POLICY IF EXISTS "holdings_user_isolation_insert" ON public.holdings;
DROP POLICY IF EXISTS "holdings_user_isolation_update" ON public.holdings;
DROP POLICY IF EXISTS "holdings_user_isolation_delete" ON public.holdings;
DROP POLICY IF EXISTS "holdings_service_role_access" ON public.holdings;

-- WATCHLIST TABLE POLICIES
DROP POLICY IF EXISTS "watchlist_user_isolation_select" ON public.watchlist;
DROP POLICY IF EXISTS "watchlist_user_isolation_insert" ON public.watchlist;
DROP POLICY IF EXISTS "watchlist_user_isolation_update" ON public.watchlist;
DROP POLICY IF EXISTS "watchlist_user_isolation_delete" ON public.watchlist;
DROP POLICY IF EXISTS "watchlist_service_role_access" ON public.watchlist;

-- PRICE_ALERTS TABLE POLICIES
DROP POLICY IF EXISTS "price_alerts_user_isolation_select" ON public.price_alerts;
DROP POLICY IF EXISTS "price_alerts_user_isolation_insert" ON public.price_alerts;
DROP POLICY IF EXISTS "price_alerts_user_isolation_update" ON public.price_alerts;
DROP POLICY IF EXISTS "price_alerts_user_isolation_delete" ON public.price_alerts;
DROP POLICY IF EXISTS "price_alerts_service_role_access" ON public.price_alerts;

-- USER_PROFILES TABLE POLICIES
DROP POLICY IF EXISTS "user_profiles_user_isolation_select" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_user_isolation_insert" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_user_isolation_update" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_user_isolation_delete" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_service_role_access" ON public.user_profiles;

-- USER_DIVIDENDS TABLE POLICIES
DROP POLICY IF EXISTS "user_dividends_user_isolation_select" ON public.user_dividends;
DROP POLICY IF EXISTS "user_dividends_user_isolation_insert" ON public.user_dividends;
DROP POLICY IF EXISTS "user_dividends_user_isolation_update" ON public.user_dividends;
DROP POLICY IF EXISTS "user_dividends_user_isolation_delete" ON public.user_dividends;
DROP POLICY IF EXISTS "user_dividends_service_role_access" ON public.user_dividends;

-- PORTFOLIO_CACHES TABLE POLICIES
DROP POLICY IF EXISTS "portfolio_caches_user_isolation_select" ON public.portfolio_caches;
DROP POLICY IF EXISTS "portfolio_caches_user_isolation_insert" ON public.portfolio_caches;
DROP POLICY IF EXISTS "portfolio_caches_user_isolation_update" ON public.portfolio_caches;
DROP POLICY IF EXISTS "portfolio_caches_user_isolation_delete" ON public.portfolio_caches;
DROP POLICY IF EXISTS "portfolio_caches_service_role_access" ON public.portfolio_caches;

-- PORTFOLIO_METRICS_CACHE TABLE POLICIES
DROP POLICY IF EXISTS "portfolio_metrics_cache_user_isolation_select" ON public.portfolio_metrics_cache;
DROP POLICY IF EXISTS "portfolio_metrics_cache_user_isolation_insert" ON public.portfolio_metrics_cache;
DROP POLICY IF EXISTS "portfolio_metrics_cache_user_isolation_update" ON public.portfolio_metrics_cache;
DROP POLICY IF EXISTS "portfolio_metrics_cache_user_isolation_delete" ON public.portfolio_metrics_cache;
DROP POLICY IF EXISTS "portfolio_metrics_cache_service_role_access" ON public.portfolio_metrics_cache;

-- USER_CURRENCY_CACHE TABLE POLICIES
DROP POLICY IF EXISTS "user_currency_cache_user_isolation_select" ON public.user_currency_cache;
DROP POLICY IF EXISTS "user_currency_cache_user_isolation_insert" ON public.user_currency_cache;
DROP POLICY IF EXISTS "user_currency_cache_user_isolation_update" ON public.user_currency_cache;
DROP POLICY IF EXISTS "user_currency_cache_user_isolation_delete" ON public.user_currency_cache;
DROP POLICY IF EXISTS "user_currency_cache_service_role_access" ON public.user_currency_cache;

-- AUDIT_LOG TABLE POLICIES
DROP POLICY IF EXISTS "audit_log_user_isolation_select" ON public.audit_log;
DROP POLICY IF EXISTS "audit_log_service_role_access" ON public.audit_log;

-- RATE_LIMITS TABLE POLICIES
DROP POLICY IF EXISTS "rate_limits_user_isolation_select" ON public.rate_limits;
DROP POLICY IF EXISTS "rate_limits_user_isolation_insert" ON public.rate_limits;
DROP POLICY IF EXISTS "rate_limits_user_isolation_update" ON public.rate_limits;
DROP POLICY IF EXISTS "rate_limits_user_isolation_delete" ON public.rate_limits;
DROP POLICY IF EXISTS "rate_limits_service_role_access" ON public.rate_limits;

-- DIVIDEND_SYNC_STATE TABLE POLICIES
DROP POLICY IF EXISTS "dividend_sync_state_user_isolation_select" ON public.dividend_sync_state;
DROP POLICY IF EXISTS "dividend_sync_state_user_isolation_insert" ON public.dividend_sync_state;
DROP POLICY IF EXISTS "dividend_sync_state_user_isolation_update" ON public.dividend_sync_state;
DROP POLICY IF EXISTS "dividend_sync_state_user_isolation_delete" ON public.dividend_sync_state;
DROP POLICY IF EXISTS "dividend_sync_state_service_role_access" ON public.dividend_sync_state;

-- =============================================================================
-- STEP 2: DROP PUBLIC DATA POLICIES
-- =============================================================================

-- HISTORICAL_PRICES TABLE POLICIES
DROP POLICY IF EXISTS "historical_prices_authenticated_select" ON public.historical_prices;
DROP POLICY IF EXISTS "historical_prices_service_role_access" ON public.historical_prices;

-- STOCKS TABLE POLICIES
DROP POLICY IF EXISTS "stocks_authenticated_select" ON public.stocks;
DROP POLICY IF EXISTS "stocks_service_role_access" ON public.stocks;

-- COMPANY_FINANCIALS TABLE POLICIES
DROP POLICY IF EXISTS "company_financials_authenticated_select" ON public.company_financials;
DROP POLICY IF EXISTS "company_financials_service_role_access" ON public.company_financials;

-- FOREX_RATES TABLE POLICIES
DROP POLICY IF EXISTS "forex_rates_authenticated_select" ON public.forex_rates;
DROP POLICY IF EXISTS "forex_rates_service_role_access" ON public.forex_rates;

-- =============================================================================
-- STEP 3: DISABLE ROW LEVEL SECURITY ON ALL TABLES
-- =============================================================================

-- User-owned tables
ALTER TABLE public.portfolios DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.holdings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlist DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_alerts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_dividends DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_caches DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_metrics_cache DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_currency_cache DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.dividend_sync_state DISABLE ROW LEVEL SECURITY;

-- Public data tables
ALTER TABLE public.historical_prices DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.stocks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_financials DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.forex_rates DISABLE ROW LEVEL SECURITY;

-- =============================================================================
-- STEP 4: DROP RLS OPTIMIZATION INDEXES (OPTIONAL - ONLY IF CAUSING ISSUES)
-- =============================================================================

-- Uncomment these lines only if the RLS indexes are causing performance issues
-- and you need to remove them as part of the rollback

-- DROP INDEX CONCURRENTLY IF EXISTS idx_portfolios_user_id_rls;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_transactions_user_id_rls;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_holdings_user_id_rls;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_watchlist_user_id_rls;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_price_alerts_user_id_rls;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_user_profiles_user_id_rls;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_user_dividends_user_id_rls;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_portfolio_caches_user_id_rls;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_portfolio_metrics_cache_user_id_rls;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_audit_log_user_id_rls;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_rate_limits_user_id_rls;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_historical_prices_symbol_rls;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_stocks_symbol_rls;

-- =============================================================================
-- STEP 5: DROP VALIDATION FUNCTIONS
-- =============================================================================

DROP FUNCTION IF EXISTS public.validate_rls_policies();
DROP FUNCTION IF EXISTS public.test_rls_enforcement();

-- =============================================================================
-- STEP 6: LOG ROLLBACK IN AUDIT TRAIL
-- =============================================================================

INSERT INTO public.audit_log (
    user_id,
    action,
    table_name,
    old_data,
    new_data
) VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,  -- System user
    'SECURITY_ROLLBACK_008',
    'ALL_USER_TABLES',
    '{"rls_enabled": true, "policies": 65}'::jsonb,
    '{"rls_enabled": false, "policies": 0, "rollback_date": "2025-07-30", "warning": "ALL SECURITY REMOVED"}'::jsonb
);

COMMIT;

-- =============================================================================
-- ROLLBACK VALIDATION AND WARNING
-- =============================================================================

SELECT 
    'CRITICAL SECURITY WARNING' as status,
    'ALL RLS POLICIES HAVE BEEN REMOVED' as warning,
    'Users can now access other users data' as security_risk,
    'Re-run Migration 008 to restore security ASAP' as action_required;

-- Verify rollback completed
SELECT 
    COUNT(*) as remaining_policies,
    CASE 
        WHEN COUNT(*) = 0 THEN 'ROLLBACK SUCCESSFUL - ALL POLICIES REMOVED'
        ELSE 'ROLLBACK INCOMPLETE - ' || COUNT(*) || ' POLICIES REMAIN'
    END as rollback_status
FROM pg_policies 
WHERE schemaname = 'public' 
AND (policyname LIKE '%user_isolation%' OR policyname LIKE '%service_role_access%');

-- Check RLS status
SELECT 
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity THEN 'WARNING: RLS still enabled'
        ELSE 'RLS disabled'
    END as status
FROM pg_tables 
WHERE schemaname = 'public'
AND tablename IN (
    'portfolios', 'transactions', 'holdings', 'watchlist', 'price_alerts',
    'user_profiles', 'user_dividends', 'portfolio_caches', 'portfolio_metrics_cache',
    'user_currency_cache', 'audit_log', 'rate_limits', 'dividend_sync_state',
    'historical_prices', 'stocks', 'company_financials', 'forex_rates'
)
ORDER BY tablename;