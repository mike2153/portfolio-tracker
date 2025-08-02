-- ============================================================================
-- Migration 010 ROLLBACK: User Performance Cache System
-- ============================================================================
-- This rollback migration safely removes the user performance cache system
-- while preserving data integrity and existing functionality.
--
-- SAFETY MEASURES:
-- 1. Data backup before deletion
-- 2. Graceful function removal
-- 3. Index cleanup
-- 4. RLS policy removal
-- 5. Permission revocation
-- ============================================================================

-- ============================================================================
-- Data Backup (Optional - for emergency recovery)
-- ============================================================================

-- Create backup table for cache data (if needed for analysis)
-- This is commented out by default to avoid unnecessary storage usage
/*
CREATE TABLE IF NOT EXISTS public.user_performance_backup_010 AS 
SELECT * FROM public.user_performance;

COMMENT ON TABLE public.user_performance_backup_010 IS 
'Backup of user_performance table before migration 010 rollback. 
Created: ' || NOW()::text || '. Safe to drop after verification.';
*/

-- ============================================================================
-- Remove Views
-- ============================================================================

DROP VIEW IF EXISTS cache_performance_stats;
DROP VIEW IF EXISTS cache_effectiveness_analysis;

-- ============================================================================
-- Remove Background Job Support
-- ============================================================================

-- Drop RLS policies for refresh jobs
DROP POLICY IF EXISTS "Users can view own refresh jobs" ON public.cache_refresh_jobs;
DROP POLICY IF EXISTS "Service role can manage all refresh jobs" ON public.cache_refresh_jobs;

-- Revoke permissions on refresh jobs table
REVOKE ALL ON public.cache_refresh_jobs FROM authenticated;
REVOKE ALL ON public.cache_refresh_jobs FROM service_role;

-- Drop indexes for refresh jobs
DROP INDEX IF EXISTS idx_cache_refresh_jobs_queue;
DROP INDEX IF EXISTS idx_cache_refresh_jobs_monitoring;

-- Drop refresh jobs table
DROP TABLE IF EXISTS public.cache_refresh_jobs;

-- ============================================================================
-- Remove Cache Management Functions
-- ============================================================================

-- Drop all cache management functions
DROP FUNCTION IF EXISTS calculate_cache_ttl(UUID, BOOLEAN, INTEGER);
DROP FUNCTION IF EXISTS is_cache_valid(UUID, BOOLEAN);
DROP FUNCTION IF EXISTS invalidate_user_cache(UUID, TEXT);
DROP FUNCTION IF EXISTS update_cache_stats(UUID, TEXT);
DROP FUNCTION IF EXISTS start_cache_refresh_job(UUID, UUID);
DROP FUNCTION IF EXISTS complete_cache_refresh_job(UUID, UUID, BOOLEAN);
DROP FUNCTION IF EXISTS cleanup_performance_cache(INTERVAL);

-- ============================================================================
-- Remove RLS Policies
-- ============================================================================

-- Drop all RLS policies for user_performance table
DROP POLICY IF EXISTS "Users can view own performance cache" ON public.user_performance;
DROP POLICY IF EXISTS "Users can insert own performance cache" ON public.user_performance;
DROP POLICY IF EXISTS "Users can update own performance cache" ON public.user_performance;
DROP POLICY IF EXISTS "Users can delete own performance cache" ON public.user_performance;
DROP POLICY IF EXISTS "Service role can manage all performance cache" ON public.user_performance;

-- ============================================================================
-- Remove Indexes
-- ============================================================================

-- Drop all performance indexes
DROP INDEX IF EXISTS idx_user_performance_cache_lookup;
DROP INDEX IF EXISTS idx_user_performance_stale_cleanup;
DROP INDEX IF EXISTS idx_user_performance_refresh_jobs;
DROP INDEX IF EXISTS idx_user_performance_dependency_tracking;
DROP INDEX IF EXISTS idx_user_performance_analytics;
DROP INDEX IF EXISTS idx_user_performance_activity_ttl;
DROP INDEX IF EXISTS idx_user_performance_effectiveness;

-- ============================================================================
-- Revoke Permissions
-- ============================================================================

-- Revoke all permissions on user_performance table
REVOKE ALL ON public.user_performance FROM authenticated;
REVOKE ALL ON public.user_performance FROM service_role;

-- ============================================================================
-- Remove Main Table
-- ============================================================================

-- Drop the main cache table
DROP TABLE IF EXISTS public.user_performance;

-- ============================================================================
-- Clean Up Audit Log
-- ============================================================================

-- Remove migration audit log entry (optional)
DELETE FROM public.audit_log 
WHERE action = 'MIGRATION_APPLIED' 
AND table_name = 'user_performance' 
AND (new_data->>'migration')::text = '010_user_performance_cache';

-- Add rollback audit log entry
INSERT INTO public.audit_log (
    user_id, 
    action, 
    table_name, 
    new_data
) VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid, -- System UUID
    'MIGRATION_ROLLED_BACK',
    'user_performance',
    jsonb_build_object(
        'migration', '010_user_performance_cache',
        'rolled_back_at', NOW(),
        'description', 'User performance cache system rolled back successfully'
    )
);

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Verify complete removal (these should return no rows/false)
DO $$
DECLARE
    table_exists BOOLEAN;
    function_count INTEGER;
    index_count INTEGER;
    policy_count INTEGER;
BEGIN
    -- Check if table was removed
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_performance'
    ) INTO table_exists;
    
    -- Check if functions were removed
    SELECT COUNT(*) INTO function_count
    FROM information_schema.routines 
    WHERE routine_schema = 'public' 
    AND routine_name LIKE '%cache%'
    AND routine_name IN (
        'calculate_cache_ttl',
        'is_cache_valid', 
        'invalidate_user_cache',
        'update_cache_stats',
        'start_cache_refresh_job',
        'complete_cache_refresh_job',
        'cleanup_performance_cache'
    );
    
    -- Check if indexes were removed
    SELECT COUNT(*) INTO index_count
    FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND indexname LIKE 'idx_user_performance%';
    
    -- Check if RLS policies were removed
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'user_performance';
    
    -- Raise notice with results
    RAISE NOTICE 'ROLLBACK VERIFICATION:';
    RAISE NOTICE 'Table exists: %', table_exists;
    RAISE NOTICE 'Functions remaining: %', function_count;
    RAISE NOTICE 'Indexes remaining: %', index_count;
    RAISE NOTICE 'Policies remaining: %', policy_count;
    
    IF table_exists OR function_count > 0 OR index_count > 0 OR policy_count > 0 THEN
        RAISE WARNING 'Rollback may not be complete. Manual cleanup may be required.';
    ELSE
        RAISE NOTICE 'Rollback completed successfully. All cache system components removed.';
    END IF;
END
$$;

-- ============================================================================
-- Rollback Completion
-- ============================================================================

COMMENT ON SCHEMA public IS 
COALESCE(
    obj_description('public'::regnamespace, 'pg_namespace'),
    ''
) || ' [Migration 010 user_performance_cache rolled back at ' || NOW()::text || ']';