-- =====================================================
-- FIX USER PERFORMANCE SCHEMA - ADD MISSING CACHE_KEY
-- =====================================================

-- Step 1: Add the missing cache_key column
ALTER TABLE public.user_performance 
ADD COLUMN IF NOT EXISTS cache_key VARCHAR(255) NOT NULL DEFAULT 'dashboard_default';

-- Step 2: Drop the existing primary key constraint
ALTER TABLE public.user_performance 
DROP CONSTRAINT IF EXISTS user_performance_pkey;

-- Step 3: Create new composite primary key
ALTER TABLE public.user_performance 
ADD CONSTRAINT user_performance_pkey PRIMARY KEY (user_id, cache_key);

-- Step 4: Add index for cache lookups
CREATE INDEX IF NOT EXISTS idx_user_performance_cache_expires 
ON public.user_performance (user_id, cache_key, expires_at);

-- Step 5: Add index for cleanup operations
CREATE INDEX IF NOT EXISTS idx_user_performance_expires_cleanup 
ON public.user_performance (expires_at);

-- Step 6: Update RLS policies to work with new schema
DROP POLICY IF EXISTS "user_performance_select_policy" ON public.user_performance;
DROP POLICY IF EXISTS "user_performance_insert_policy" ON public.user_performance;
DROP POLICY IF EXISTS "user_performance_update_policy" ON public.user_performance;
DROP POLICY IF EXISTS "user_performance_delete_policy" ON public.user_performance;

-- Recreate RLS policies
CREATE POLICY "user_performance_select_policy" ON public.user_performance
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_performance_insert_policy" ON public.user_performance
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_performance_update_policy" ON public.user_performance
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "user_performance_delete_policy" ON public.user_performance
    FOR DELETE USING (auth.uid() = user_id);

-- Step 7: Create missing portfolio_metrics_cache table (referenced in error logs)
CREATE TABLE IF NOT EXISTS public.portfolio_metrics_cache (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    cache_key VARCHAR(255) NOT NULL,
    metrics_data JSONB NOT NULL DEFAULT '{}',
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    cache_version INTEGER DEFAULT 1 NOT NULL,
    PRIMARY KEY (user_id, cache_key)
);

-- Add RLS policies for portfolio_metrics_cache
ALTER TABLE public.portfolio_metrics_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "portfolio_metrics_cache_select_policy" ON public.portfolio_metrics_cache
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "portfolio_metrics_cache_insert_policy" ON public.portfolio_metrics_cache
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "portfolio_metrics_cache_update_policy" ON public.portfolio_metrics_cache
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "portfolio_metrics_cache_delete_policy" ON public.portfolio_metrics_cache
    FOR DELETE USING (auth.uid() = user_id);

-- Step 8: Fix price_request_cache table (missing cache_key)
ALTER TABLE public.price_request_cache 
ADD COLUMN IF NOT EXISTS cache_key VARCHAR(255);

-- Update existing records to have a cache_key
UPDATE public.price_request_cache 
SET cache_key = CONCAT('symbols_', symbols_hash, '_', date_from, '_', date_to)
WHERE cache_key IS NULL;

-- Make cache_key NOT NULL after updating existing records
ALTER TABLE public.price_request_cache 
ALTER COLUMN cache_key SET NOT NULL;

-- Add index for cache_key lookups
CREATE INDEX IF NOT EXISTS idx_price_request_cache_key 
ON public.price_request_cache (cache_key, expires_at);

-- Verification queries
SELECT 'user_performance columns:' as status;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_performance' AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT 'portfolio_metrics_cache created:' as status;
SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'portfolio_metrics_cache' AND table_schema = 'public'
) as table_exists;