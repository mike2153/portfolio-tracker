-- =====================================================
-- QUICK DROP SCRIPT - UNUSED TABLES ONLY
-- =====================================================
-- ⚠️  WARNING: NO BACKUPS - USE ONLY IF YOU'RE CERTAIN
-- =====================================================

-- Drop legacy business tables
DROP TABLE IF EXISTS public.holdings CASCADE;
DROP TABLE IF EXISTS public.portfolios CASCADE; 
DROP TABLE IF EXISTS public.stocks CASCADE;
DROP TABLE IF EXISTS public.price_alerts CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Drop redundant cache tables
DROP TABLE IF EXISTS public.market_holidays_cache CASCADE;
DROP TABLE IF EXISTS public.price_quote_cache CASCADE;
DROP TABLE IF EXISTS public.portfolio_metrics_cache CASCADE;
DROP TABLE IF EXISTS public.price_update_sessions CASCADE;

-- Drop unused feature tables
DROP TABLE IF EXISTS public.rate_limits CASCADE;
DROP TABLE IF EXISTS public.symbol_exchanges CASCADE;
DROP TABLE IF EXISTS public.dividend_sync_state CASCADE;
DROP TABLE IF EXISTS public.global_dividend_sync_state CASCADE;

-- Show remaining tables
SELECT 'Remaining tables:' as status;
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;