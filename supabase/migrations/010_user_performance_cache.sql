-- ============================================================================
-- Migration 010: Revolutionary User Performance Cache System
-- ============================================================================
-- This migration creates a high-performance caching layer that will transform
-- portfolio calculation performance from seconds to milliseconds.
--
-- KEY INNOVATIONS:
-- 1. JSONB structure optimized for flexible data evolution
-- 2. Intelligent TTL based on market status and user activity
-- 3. Dependency tracking for smart invalidation
-- 4. Background refresh job coordination
-- 5. Performance analytics for continuous optimization
-- ============================================================================

-- ============================================================================
-- Core Cache Table: user_performance
-- ============================================================================

CREATE TABLE public.user_performance (
    -- Primary identifier with CASCADE delete for data safety
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- === COMPREHENSIVE PORTFOLIO DATA (JSONB for maximum flexibility) ===
    -- Structure: Each JSONB column contains a complete data domain
    -- This allows for atomic updates and flexible schema evolution
    
    -- Portfolio holdings and allocations
    portfolio_data JSONB NOT NULL DEFAULT '{
        "holdings": [],
        "total_value": 0,
        "total_cost": 0,
        "total_gain_loss": 0,
        "total_gain_loss_percent": 0,
        "currency": "USD"
    }'::jsonb,
    
    -- Performance metrics and analytics
    performance_data JSONB NOT NULL DEFAULT '{
        "xirr": null,
        "sharpe_ratio": null,
        "volatility": null,
        "max_drawdown": null,
        "daily_change": 0,
        "daily_change_percent": 0,
        "ytd_return": 0,
        "ytd_return_percent": 0
    }'::jsonb,
    
    -- Asset allocation breakdown
    allocation_data JSONB NOT NULL DEFAULT '{
        "by_symbol": [],
        "by_sector": {},
        "by_region": {},
        "by_currency": {},
        "top_holdings": []
    }'::jsonb,
    
    -- Dividend information
    dividend_data JSONB NOT NULL DEFAULT '{
        "total_received": 0,
        "ytd_received": 0,
        "pending_amount": 0,
        "recent_dividends": [],
        "upcoming_payments": [],
        "yield_estimate": null
    }'::jsonb,
    
    -- Transaction summaries
    transactions_summary JSONB NOT NULL DEFAULT '{
        "total_transactions": 0,
        "last_transaction_date": null,
        "buy_count": 0,
        "sell_count": 0,
        "dividend_count": 0,
        "realized_gains": 0
    }'::jsonb,
    
    -- Time series data for charts (compressed format)
    time_series_data JSONB NOT NULL DEFAULT '{
        "portfolio_values": [],
        "benchmark_values": [],
        "date_range": {"start": null, "end": null},
        "data_points": 0
    }'::jsonb,
    
    -- === CACHE MANAGEMENT METADATA ===
    
    -- Timestamps for cache lifecycle management
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    cache_version INTEGER DEFAULT 1 NOT NULL,
    
    -- Data integrity and change detection
    data_hash VARCHAR(64) NOT NULL, -- SHA256 of input data for change detection
    
    -- === PERFORMANCE TRACKING ===
    
    -- Computation metrics for optimization
    calculation_time_ms INTEGER CHECK (calculation_time_ms IS NULL OR calculation_time_ms >= 0),
    last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    access_count INTEGER DEFAULT 0 CHECK (access_count >= 0),
    
    -- === DATA FRESHNESS INDICATORS ===
    
    -- Track data dependencies for intelligent invalidation
    last_transaction_date DATE, -- Used to detect when recalculation is needed
    last_price_update TIMESTAMP WITH TIME ZONE, -- Track price data freshness
    last_dividend_sync TIMESTAMP WITH TIME ZONE, -- Track dividend data freshness
    
    -- === CACHE OPTIMIZATION METADATA ===
    
    -- Track cache effectiveness
    cache_hit_rate DECIMAL(5,4) DEFAULT 0.0000 CHECK (cache_hit_rate >= 0 AND cache_hit_rate <= 1),
    invalidation_reason TEXT, -- Track why cache was invalidated for optimization
    
    -- Market status when calculated (affects TTL)
    market_status_at_calculation JSONB DEFAULT '{
        "is_open": false,
        "session": "closed",
        "timezone": "America/New_York"
    }'::jsonb,
    
    -- Dependency tracking for cascade invalidation
    dependencies JSONB DEFAULT '{
        "symbols": [],
        "price_dates": {},
        "external_data_sources": []
    }'::jsonb,
    
    -- User activity tracking for TTL optimization
    user_activity_score INTEGER DEFAULT 0 CHECK (user_activity_score >= 0),
    last_portfolio_change TIMESTAMP WITH TIME ZONE,
    
    -- Background job coordination
    refresh_job_id UUID, -- Track background refresh jobs
    refresh_in_progress BOOLEAN DEFAULT false,
    refresh_started_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata for analytics and debugging
    metadata JSONB DEFAULT '{
        "calculation_method": "standard",
        "data_completeness": {},
        "warnings": [],
        "debug_info": {}
    }'::jsonb
);

-- ============================================================================
-- Performance Optimization Indexes
-- ============================================================================

-- Primary cache lookup index (most frequent query)
-- Note: Removed WHERE clause with NOW() as it's not immutable for index predicates
CREATE INDEX idx_user_performance_cache_lookup 
ON public.user_performance (user_id, expires_at DESC);

-- Stale cache detection and cleanup
-- Note: Removed WHERE clause with NOW() as it's not immutable for index predicates
CREATE INDEX idx_user_performance_stale_cleanup 
ON public.user_performance (expires_at);

-- Background job coordination
CREATE INDEX idx_user_performance_refresh_jobs 
ON public.user_performance (refresh_in_progress, refresh_started_at) 
WHERE refresh_in_progress = true;

-- Data dependency tracking for smart invalidation
CREATE INDEX idx_user_performance_dependency_tracking 
ON public.user_performance USING GIN (dependencies);

-- Performance analytics queries
CREATE INDEX idx_user_performance_analytics 
ON public.user_performance (calculated_at DESC, calculation_time_ms, access_count);

-- User activity-based TTL optimization
CREATE INDEX idx_user_performance_activity_ttl 
ON public.user_performance (user_activity_score DESC, last_accessed DESC);

-- Cache effectiveness tracking
CREATE INDEX idx_user_performance_effectiveness 
ON public.user_performance (cache_hit_rate DESC, access_count DESC) 
WHERE access_count > 0;

-- ============================================================================
-- Cache Management Functions
-- ============================================================================

-- Calculate intelligent TTL based on market status and user activity
CREATE OR REPLACE FUNCTION calculate_cache_ttl(
    p_user_id UUID,
    p_market_is_open BOOLEAN DEFAULT false,
    p_user_activity_score INTEGER DEFAULT 0
) RETURNS INTERVAL
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    base_ttl INTERVAL;
    activity_multiplier DECIMAL;
    weekend_check BOOLEAN;
BEGIN
    -- Check if it's weekend
    weekend_check := EXTRACT(DOW FROM NOW()) IN (0, 6); -- Sunday = 0, Saturday = 6
    
    -- Base TTL calculation
    IF weekend_check THEN
        base_ttl := INTERVAL '24 hours'; -- Long TTL on weekends
    ELSIF p_market_is_open THEN
        base_ttl := INTERVAL '15 minutes'; -- Short TTL during market hours
    ELSE
        base_ttl := INTERVAL '2 hours'; -- Medium TTL after market close
    END IF;
    
    -- Activity-based adjustment
    -- High activity users get shorter TTL for fresher data
    -- Low activity users get longer TTL for efficiency
    activity_multiplier := CASE 
        WHEN p_user_activity_score >= 100 THEN 0.5  -- Very active: 50% of base TTL
        WHEN p_user_activity_score >= 50 THEN 0.75   -- Active: 75% of base TTL
        WHEN p_user_activity_score >= 10 THEN 1.0    -- Normal: 100% of base TTL
        ELSE 1.5                                      -- Inactive: 150% of base TTL
    END;
    
    RETURN base_ttl * activity_multiplier;
END;
$$;

-- Function to check if cache is valid and fresh
CREATE OR REPLACE FUNCTION is_cache_valid(
    p_user_id UUID,
    p_check_dependencies BOOLEAN DEFAULT true
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    cache_record RECORD;
    latest_transaction_date DATE;
    price_update_needed BOOLEAN := false;
BEGIN
    -- Get cache record
    SELECT * INTO cache_record 
    FROM public.user_performance 
    WHERE user_id = p_user_id;
    
    -- No cache exists
    IF NOT FOUND THEN
        RETURN false;
    END IF;
    
    -- Check expiration
    IF cache_record.expires_at <= NOW() THEN
        RETURN false;
    END IF;
    
    -- Skip dependency check if not requested
    IF NOT p_check_dependencies THEN
        RETURN true;
    END IF;
    
    -- Check if new transactions exist
    SELECT MAX(date) INTO latest_transaction_date
    FROM public.transactions
    WHERE user_id = p_user_id;
    
    IF latest_transaction_date IS NOT NULL AND 
       (cache_record.last_transaction_date IS NULL OR 
        latest_transaction_date > cache_record.last_transaction_date) THEN
        RETURN false;
    END IF;
    
    -- Check if price updates are needed (simplified check)
    -- In production, this would check against price update timestamps
    IF cache_record.last_price_update IS NOT NULL AND 
       cache_record.last_price_update < NOW() - INTERVAL '1 hour' THEN
        -- Additional price freshness logic would go here
        -- For now, we assume prices are acceptable if not too old
        NULL;
    END IF;
    
    RETURN true;
END;
$$;

-- Function to invalidate cache with reason tracking
CREATE OR REPLACE FUNCTION invalidate_user_cache(
    p_user_id UUID,
    p_reason TEXT DEFAULT 'manual_invalidation'
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.user_performance 
    SET 
        expires_at = NOW() - INTERVAL '1 second',
        invalidation_reason = p_reason,
        metadata = jsonb_set(
            COALESCE(metadata, '{}'::jsonb),
            '{invalidated_at}',
            to_jsonb(NOW()::text)
        )
    WHERE user_id = p_user_id;
    
    RETURN FOUND;
END;
$$;

-- Function to update cache statistics
CREATE OR REPLACE FUNCTION update_cache_stats(
    p_user_id UUID,
    p_access_type TEXT DEFAULT 'read'
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.user_performance 
    SET 
        access_count = access_count + 1,
        last_accessed = NOW(),
        cache_hit_rate = CASE 
            WHEN access_count = 0 THEN 1.0000
            ELSE LEAST(1.0000, (cache_hit_rate * access_count + 1.0) / (access_count + 1))
        END
    WHERE user_id = p_user_id;
END;
$$;

-- Background job coordination function
CREATE OR REPLACE FUNCTION start_cache_refresh_job(
    p_user_id UUID,
    p_job_id UUID DEFAULT gen_random_uuid()
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if refresh is already in progress
    IF EXISTS (
        SELECT 1 FROM public.user_performance 
        WHERE user_id = p_user_id 
        AND refresh_in_progress = true 
        AND refresh_started_at > NOW() - INTERVAL '30 minutes'
    ) THEN
        -- Return existing job ID or NULL if can't determine
        RETURN NULL;
    END IF;
    
    -- Mark refresh as in progress
    UPDATE public.user_performance 
    SET 
        refresh_in_progress = true,
        refresh_started_at = NOW(),
        refresh_job_id = p_job_id
    WHERE user_id = p_user_id;
    
    -- Insert record if doesn't exist
    IF NOT FOUND THEN
        INSERT INTO public.user_performance (
            user_id, 
            expires_at, 
            data_hash, 
            refresh_in_progress, 
            refresh_started_at, 
            refresh_job_id
        ) VALUES (
            p_user_id, 
            NOW() - INTERVAL '1 second', -- Expired
            'initial', 
            true, 
            NOW(), 
            p_job_id
        );
    END IF;
    
    RETURN p_job_id;
END;
$$;

-- Complete cache refresh job
CREATE OR REPLACE FUNCTION complete_cache_refresh_job(
    p_user_id UUID,
    p_job_id UUID,
    p_success BOOLEAN DEFAULT true
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.user_performance 
    SET 
        refresh_in_progress = false,
        refresh_job_id = NULL,
        metadata = jsonb_set(
            COALESCE(metadata, '{}'::jsonb),
            '{last_refresh_result}',
            jsonb_build_object(
                'success', p_success,
                'completed_at', NOW(),
                'job_id', p_job_id
            )
        )
    WHERE user_id = p_user_id 
    AND refresh_job_id = p_job_id;
    
    RETURN FOUND;
END;
$$;

-- Cleanup expired cache entries and stale refresh jobs
CREATE OR REPLACE FUNCTION cleanup_performance_cache(
    p_max_age INTERVAL DEFAULT '7 days'
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    -- Clean up very old cache entries
    DELETE FROM public.user_performance 
    WHERE expires_at < NOW() - p_max_age;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Clean up stale refresh jobs
    UPDATE public.user_performance 
    SET 
        refresh_in_progress = false,
        refresh_job_id = NULL,
        metadata = jsonb_set(
            COALESCE(metadata, '{}'::jsonb),
            '{refresh_cleanup}',
            jsonb_build_object(
                'cleaned_at', NOW(),
                'reason', 'stale_job_timeout'
            )
        )
    WHERE refresh_in_progress = true 
    AND refresh_started_at < NOW() - INTERVAL '1 hour';
    
    RETURN deleted_count;
END;
$$;

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on the cache table
ALTER TABLE public.user_performance ENABLE ROW LEVEL SECURITY;

-- Users can only access their own performance cache
CREATE POLICY "Users can view own performance cache" ON public.user_performance
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

-- Users can insert their own performance cache
CREATE POLICY "Users can insert own performance cache" ON public.user_performance
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own performance cache
CREATE POLICY "Users can update own performance cache" ON public.user_performance
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own performance cache
CREATE POLICY "Users can delete own performance cache" ON public.user_performance
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- Service role can manage all performance cache entries
CREATE POLICY "Service role can manage all performance cache" ON public.user_performance
    FOR ALL TO service_role
    USING (true);

-- ============================================================================
-- Grant Permissions
-- ============================================================================

-- Grant table permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_performance TO authenticated;
GRANT ALL ON public.user_performance TO service_role;

-- Grant function permissions
GRANT EXECUTE ON FUNCTION calculate_cache_ttl TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION is_cache_valid TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION invalidate_user_cache TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION update_cache_stats TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION start_cache_refresh_job TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION complete_cache_refresh_job TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION cleanup_performance_cache TO service_role;

-- ============================================================================
-- Monitoring Views
-- ============================================================================

-- View for cache performance monitoring
CREATE OR REPLACE VIEW cache_performance_stats AS
SELECT 
    user_id,
    calculated_at,
    expires_at,
    expires_at - NOW() as time_to_expiry,
    calculation_time_ms,
    access_count,
    cache_hit_rate,
    user_activity_score,
    last_accessed,
    CASE 
        WHEN expires_at <= NOW() THEN 'EXPIRED'
        WHEN expires_at - NOW() < INTERVAL '5 minutes' THEN 'EXPIRING_SOON'
        WHEN refresh_in_progress THEN 'REFRESHING'
        ELSE 'VALID'
    END as cache_status,
    invalidation_reason,
    refresh_in_progress,
    refresh_started_at,
    (metadata->>'calculation_method')::text as calculation_method
FROM public.user_performance
ORDER BY last_accessed DESC;

-- View for cache effectiveness analysis
CREATE OR REPLACE VIEW cache_effectiveness_analysis AS
SELECT 
    COUNT(*) as total_cache_entries,
    COUNT(*) FILTER (WHERE expires_at > NOW()) as valid_entries,
    COUNT(*) FILTER (WHERE expires_at <= NOW()) as expired_entries,
    COUNT(*) FILTER (WHERE refresh_in_progress) as refreshing_entries,
    AVG(calculation_time_ms) as avg_calculation_time_ms,
    AVG(access_count) as avg_access_count,
    AVG(cache_hit_rate) as avg_cache_hit_rate,
    AVG(user_activity_score) as avg_user_activity_score,
    COUNT(*) FILTER (WHERE last_accessed > NOW() - INTERVAL '1 hour') as recently_accessed,
    COUNT(*) FILTER (WHERE last_accessed > NOW() - INTERVAL '1 day') as accessed_today
FROM public.user_performance;

-- Grant view permissions
GRANT SELECT ON cache_performance_stats TO authenticated, service_role;
GRANT SELECT ON cache_effectiveness_analysis TO service_role;

-- ============================================================================
-- Background Job Support
-- ============================================================================

-- Table for tracking background cache refresh jobs
CREATE TABLE public.cache_refresh_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    job_type VARCHAR(50) NOT NULL DEFAULT 'full_refresh',
    status VARCHAR(20) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    priority INTEGER DEFAULT 0 CHECK (priority >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    retry_count INTEGER DEFAULT 0 CHECK (retry_count >= 0),
    max_retries INTEGER DEFAULT 3 CHECK (max_retries >= 0)
);

-- Index for job queue processing
CREATE INDEX idx_cache_refresh_jobs_queue 
ON public.cache_refresh_jobs (status, priority DESC, created_at ASC)
WHERE status IN ('pending', 'running');

-- Index for job monitoring
CREATE INDEX idx_cache_refresh_jobs_monitoring 
ON public.cache_refresh_jobs (user_id, created_at DESC);

-- Enable RLS on refresh jobs table
ALTER TABLE public.cache_refresh_jobs ENABLE ROW LEVEL SECURITY;

-- RLS policies for refresh jobs
CREATE POLICY "Users can view own refresh jobs" ON public.cache_refresh_jobs
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all refresh jobs" ON public.cache_refresh_jobs
    FOR ALL TO service_role
    USING (true);

-- Grant permissions on refresh jobs table
GRANT SELECT ON public.cache_refresh_jobs TO authenticated;
GRANT ALL ON public.cache_refresh_jobs TO service_role;

-- ============================================================================
-- Migration Completion
-- ============================================================================

-- Log successful migration
INSERT INTO public.audit_log (
    user_id, 
    action, 
    table_name, 
    new_data
) VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid, -- System UUID
    'MIGRATION_APPLIED',
    'user_performance',
    jsonb_build_object(
        'migration', '010_user_performance_cache',
        'applied_at', NOW(),
        'description', 'Revolutionary user performance cache system deployed'
    )
);

-- Update schema version (if version tracking exists)
-- This would be project-specific implementation

COMMENT ON TABLE public.user_performance IS 
'Revolutionary performance cache system for portfolio calculations. 
Provides millisecond-response dashboard loading through intelligent 
JSONB-based caching with market-aware TTL and dependency tracking.';

COMMENT ON TABLE public.cache_refresh_jobs IS 
'Background job queue for asynchronous cache refresh operations. 
Enables non-blocking cache updates during market hours.';