-- Migration 008 Validation Test Suite
-- Purpose: Comprehensive testing of RLS policy effectiveness and security
-- Date: 2025-07-30
-- Author: Supabase Schema Architect

-- =============================================================================
-- COMPREHENSIVE RLS VALIDATION TEST SUITE
-- =============================================================================

-- This test suite validates that Migration 008 successfully implemented
-- complete user data isolation through Row Level Security policies.

-- =============================================================================
-- TEST 1: VERIFY RLS IS ENABLED ON ALL REQUIRED TABLES
-- =============================================================================

SELECT 'TEST 1: RLS Enablement Verification' as test_name;

SELECT 
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity THEN '✓ PASS' 
        ELSE '✗ FAIL - RLS NOT ENABLED' 
    END as test_result
FROM pg_tables 
WHERE schemaname = 'public'
AND tablename IN (
    'portfolios', 'transactions', 'holdings', 'watchlist', 'price_alerts',
    'user_profiles', 'user_dividends', 'portfolio_caches', 'portfolio_metrics_cache',
    'user_currency_cache', 'audit_log', 'rate_limits', 'dividend_sync_state',
    'historical_prices', 'stocks', 'company_financials', 'forex_rates'
)
ORDER BY tablename;

-- =============================================================================
-- TEST 2: VERIFY ALL REQUIRED POLICIES EXIST
-- =============================================================================

SELECT 'TEST 2: Policy Existence Verification' as test_name;

WITH expected_policies AS (
    SELECT table_name, policy_type, expected_count FROM (VALUES
        ('portfolios', 'user_isolation', 4),
        ('portfolios', 'service_role', 1),
        ('transactions', 'user_isolation', 4),
        ('transactions', 'service_role', 1),
        ('holdings', 'user_isolation', 4),
        ('holdings', 'service_role', 1),
        ('watchlist', 'user_isolation', 4),
        ('watchlist', 'service_role', 1),
        ('price_alerts', 'user_isolation', 4),
        ('price_alerts', 'service_role', 1),
        ('user_profiles', 'user_isolation', 4),
        ('user_profiles', 'service_role', 1),
        ('user_dividends', 'user_isolation', 4),
        ('user_dividends', 'service_role', 1),
        ('portfolio_caches', 'user_isolation', 4),
        ('portfolio_caches', 'service_role', 1),
        ('portfolio_metrics_cache', 'user_isolation', 4),
        ('portfolio_metrics_cache', 'service_role', 1),
        ('user_currency_cache', 'user_isolation', 4),
        ('user_currency_cache', 'service_role', 1),
        ('audit_log', 'user_isolation', 1),
        ('audit_log', 'service_role', 1),
        ('rate_limits', 'user_isolation', 4),
        ('rate_limits', 'service_role', 1),
        ('dividend_sync_state', 'user_isolation', 4),
        ('dividend_sync_state', 'service_role', 1),
        ('historical_prices', 'authenticated', 1),
        ('historical_prices', 'service_role', 1),
        ('stocks', 'authenticated', 1),
        ('stocks', 'service_role', 1),
        ('company_financials', 'authenticated', 1),
        ('company_financials', 'service_role', 1),
        ('forex_rates', 'authenticated', 1),
        ('forex_rates', 'service_role', 1)
    ) AS t(table_name, policy_type, expected_count)
),
actual_policies AS (
    SELECT 
        tablename,
        CASE 
            WHEN policyname LIKE '%user_isolation%' THEN 'user_isolation'
            WHEN policyname LIKE '%service_role%' THEN 'service_role'
            WHEN policyname LIKE '%authenticated%' THEN 'authenticated'
            ELSE 'other'
        END as policy_type,
        COUNT(*) as actual_count
    FROM pg_policies 
    WHERE schemaname = 'public'
    GROUP BY tablename, policy_type
)
SELECT 
    ep.table_name,
    ep.policy_type,
    ep.expected_count,
    COALESCE(ap.actual_count, 0) as actual_count,
    CASE 
        WHEN COALESCE(ap.actual_count, 0) = ep.expected_count THEN '✓ PASS'
        ELSE '✗ FAIL - Expected: ' || ep.expected_count || ', Found: ' || COALESCE(ap.actual_count, 0)
    END as test_result
FROM expected_policies ep
LEFT JOIN actual_policies ap ON ep.table_name = ap.tablename AND ep.policy_type = ap.policy_type
ORDER BY ep.table_name, ep.policy_type;

-- =============================================================================
-- TEST 3: VERIFY USER ISOLATION POLICY LOGIC
-- =============================================================================

SELECT 'TEST 3: User Isolation Policy Logic Verification' as test_name;

SELECT 
    tablename,
    policyname,
    cmd as operation,
    CASE 
        WHEN (qual LIKE '%auth.uid()%user_id%' OR with_check LIKE '%auth.uid()%user_id%') THEN '✓ PASS'
        WHEN policyname LIKE '%service_role%' THEN '✓ PASS (Service Role)'
        ELSE '✗ FAIL - Missing auth.uid() = user_id check'
    END as test_result,
    qual as policy_condition
FROM pg_policies 
WHERE schemaname = 'public'
AND tablename IN (
    'portfolios', 'transactions', 'holdings', 'watchlist', 'price_alerts',
    'user_profiles', 'user_dividends', 'portfolio_caches', 'portfolio_metrics_cache',
    'user_currency_cache', 'audit_log', 'rate_limits', 'dividend_sync_state'
)
ORDER BY tablename, policyname;

-- =============================================================================
-- TEST 4: VERIFY PUBLIC DATA ACCESS POLICIES
-- =============================================================================

SELECT 'TEST 4: Public Data Access Policy Verification' as test_name;

SELECT 
    tablename,
    policyname,
    cmd as operation,
    CASE 
        WHEN qual LIKE '%authenticated%' THEN '✓ PASS (Authenticated Access)'
        WHEN qual LIKE '%service_role%' THEN '✓ PASS (Service Role)'
        ELSE '✗ FAIL - Incorrect access policy'
    END as test_result,
    qual as policy_condition
FROM pg_policies 
WHERE schemaname = 'public'
AND tablename IN ('historical_prices', 'stocks', 'company_financials', 'forex_rates')
ORDER BY tablename, policyname;

-- =============================================================================
-- TEST 5: VERIFY RLS OPTIMIZATION INDEXES EXIST
-- =============================================================================

SELECT 'TEST 5: RLS Optimization Index Verification' as test_name;

WITH expected_indexes AS (
    SELECT index_name FROM (VALUES
        ('idx_portfolios_user_id_rls'),
        ('idx_transactions_user_id_rls'),
        ('idx_holdings_user_id_rls'),
        ('idx_watchlist_user_id_rls'),
        ('idx_price_alerts_user_id_rls'),
        ('idx_user_profiles_user_id_rls'),
        ('idx_user_dividends_user_id_rls'),
        ('idx_portfolio_caches_user_id_rls'),
        ('idx_portfolio_metrics_cache_user_id_rls'),
        ('idx_audit_log_user_id_rls'),
        ('idx_rate_limits_user_id_rls'),
        ('idx_historical_prices_symbol_rls'),
        ('idx_stocks_symbol_rls')
    ) AS t(index_name)
)
SELECT 
    ei.index_name,
    CASE 
        WHEN i.indexname IS NOT NULL THEN '✓ PASS'
        ELSE '✗ FAIL - Index missing'
    END as test_result,
    COALESCE(i.tablename, 'N/A') as table_name
FROM expected_indexes ei
LEFT JOIN pg_indexes i ON ei.index_name = i.indexname AND i.schemaname = 'public'
ORDER BY ei.index_name;

-- =============================================================================
-- TEST 6: VERIFY VALIDATION FUNCTIONS EXIST AND WORK
-- =============================================================================

SELECT 'TEST 6: Validation Function Verification' as test_name;

-- Test validate_rls_policies function
SELECT 
    'validate_rls_policies' as function_name,
    CASE 
        WHEN COUNT(*) > 0 THEN '✓ PASS'
        ELSE '✗ FAIL - Function missing'
    END as test_result
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.proname = 'validate_rls_policies';

-- Test test_rls_enforcement function
SELECT 
    'test_rls_enforcement' as function_name,
    CASE 
        WHEN COUNT(*) > 0 THEN '✓ PASS'
        ELSE '✗ FAIL - Function missing'
    END as test_result
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.proname = 'test_rls_enforcement';

-- =============================================================================
-- TEST 7: RUN BUILT-IN VALIDATION FUNCTIONS
-- =============================================================================

SELECT 'TEST 7: Built-in Validation Function Results' as test_name;

-- Run the validation function if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'validate_rls_policies') THEN
        RAISE NOTICE 'Running validate_rls_policies():';
    END IF;
END $$;

SELECT * FROM public.validate_rls_policies();

-- Run the enforcement test function if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'test_rls_enforcement') THEN
        RAISE NOTICE 'Running test_rls_enforcement():';
    END IF;
END $$;

SELECT * FROM public.test_rls_enforcement();

-- =============================================================================
-- TEST 8: POLICY COUNT SUMMARY
-- =============================================================================

SELECT 'TEST 8: Policy Count Summary' as test_name;

SELECT 
    'Total RLS Policies Created' as metric,
    COUNT(*) as value,
    CASE 
        WHEN COUNT(*) >= 65 THEN '✓ PASS (Expected 65+)'
        ELSE '✗ FAIL (Expected 65+, Found ' || COUNT(*) || ')'
    END as test_result
FROM pg_policies 
WHERE schemaname = 'public';

SELECT 
    'User Isolation Policies' as metric,
    COUNT(*) as value,
    CASE 
        WHEN COUNT(*) >= 52 THEN '✓ PASS (Expected 52+)'
        ELSE '✗ FAIL (Expected 52+, Found ' || COUNT(*) || ')'
    END as test_result
FROM pg_policies 
WHERE schemaname = 'public'
AND policyname LIKE '%user_isolation%';

SELECT 
    'Service Role Policies' as metric,
    COUNT(*) as value,
    CASE 
        WHEN COUNT(*) >= 13 THEN '✓ PASS (Expected 13+)'
        ELSE '✗ FAIL (Expected 13+, Found ' || COUNT(*) || ')'
    END as test_result
FROM pg_policies 
WHERE schemaname = 'public'
AND policyname LIKE '%service_role%';

SELECT 
    'Public Access Policies' as metric,
    COUNT(*) as value,
    CASE 
        WHEN COUNT(*) >= 4 THEN '✓ PASS (Expected 4+)'
        ELSE '✗ FAIL (Expected 4+, Found ' || COUNT(*) || ')'
    END as test_result
FROM pg_policies 
WHERE schemaname = 'public'
AND policyname LIKE '%authenticated%';

-- =============================================================================
-- TEST 9: AUDIT LOG VERIFICATION
-- =============================================================================

SELECT 'TEST 9: Audit Log Verification' as test_name;

SELECT 
    'Migration Audit Entry' as metric,
    COUNT(*) as value,
    CASE 
        WHEN COUNT(*) > 0 THEN '✓ PASS'
        ELSE '✗ FAIL - Migration not logged'
    END as test_result
FROM public.audit_log 
WHERE action = 'SECURITY_MIGRATION_008'
AND table_name = 'ALL_USER_TABLES';

-- =============================================================================
-- FINAL TEST SUMMARY
-- =============================================================================

SELECT 'MIGRATION 008 VALIDATION SUMMARY' as summary;

WITH test_results AS (
    -- Count tables with RLS enabled
    SELECT 'tables_with_rls_enabled' as test, COUNT(*) as pass_count
    FROM pg_tables 
    WHERE schemaname = 'public'
    AND tablename IN (
        'portfolios', 'transactions', 'holdings', 'watchlist', 'price_alerts',
        'user_profiles', 'user_dividends', 'portfolio_caches', 'portfolio_metrics_cache',
        'user_currency_cache', 'audit_log', 'rate_limits', 'dividend_sync_state',
        'historical_prices', 'stocks', 'company_financials', 'forex_rates'
    )
    AND rowsecurity = true
    
    UNION ALL
    
    -- Count user isolation policies
    SELECT 'user_isolation_policies' as test, COUNT(*) as pass_count
    FROM pg_policies 
    WHERE schemaname = 'public'
    AND policyname LIKE '%user_isolation%'
    AND (qual LIKE '%auth.uid()%user_id%' OR cmd = 'SELECT')
    
    UNION ALL
    
    -- Count service role policies
    SELECT 'service_role_policies' as test, COUNT(*) as pass_count
    FROM pg_policies 
    WHERE schemaname = 'public'
    AND policyname LIKE '%service_role%'
    
    UNION ALL
    
    -- Count RLS indexes
    SELECT 'rls_optimization_indexes' as test, COUNT(*) as pass_count
    FROM pg_indexes
    WHERE schemaname = 'public'
    AND indexname LIKE '%_rls'
)
SELECT 
    test,
    pass_count,
    CASE test
        WHEN 'tables_with_rls_enabled' THEN CASE WHEN pass_count >= 17 THEN '✓ PASS' ELSE '✗ FAIL' END
        WHEN 'user_isolation_policies' THEN CASE WHEN pass_count >= 52 THEN '✓ PASS' ELSE '✗ FAIL' END
        WHEN 'service_role_policies' THEN CASE WHEN pass_count >= 13 THEN '✓ PASS' ELSE '✗ FAIL' END
        WHEN 'rls_optimization_indexes' THEN CASE WHEN pass_count >= 11 THEN '✓ PASS' ELSE '✗ FAIL' END
        ELSE 'UNKNOWN'
    END as status
FROM test_results
ORDER BY test;

-- Final security confirmation
SELECT 
    'SECURITY STATUS' as final_result,
    CASE 
        WHEN (
            SELECT COUNT(*) FROM pg_tables 
            WHERE schemaname = 'public' 
            AND tablename IN (
                'portfolios', 'transactions', 'holdings', 'watchlist', 'price_alerts',
                'user_profiles', 'user_dividends', 'portfolio_caches', 'portfolio_metrics_cache',
                'user_currency_cache', 'audit_log', 'rate_limits', 'dividend_sync_state'
            )
            AND rowsecurity = true
        ) >= 13 
        AND (
            SELECT COUNT(*) FROM pg_policies 
            WHERE schemaname = 'public' 
            AND policyname LIKE '%user_isolation%'
        ) >= 52
        THEN '🛡️ SECURE: All user tables protected with RLS'
        ELSE '⚠️ INSECURE: Migration incomplete or failed'
    END as security_status;