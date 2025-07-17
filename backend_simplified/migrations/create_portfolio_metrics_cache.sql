-- Portfolio Metrics Cache Table Migration
-- This table stores cached portfolio metrics with SQL-based TTL management
-- Author: Portfolio Tracker Team
-- Date: 2025-01-17

-- Create the portfolio metrics cache table
CREATE TABLE IF NOT EXISTS public.portfolio_metrics_cache (
    -- Primary key components
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    cache_key VARCHAR(255) NOT NULL,
    
    -- Cache metadata
    cache_version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    last_accessed TIMESTAMPTZ DEFAULT NOW(),
    hit_count INTEGER DEFAULT 0,
    
    -- Cache content
    metrics_json JSONB NOT NULL,
    computation_metadata JSONB DEFAULT '{}',
    
    -- Cache invalidation tracking
    dependencies JSONB DEFAULT '[]', -- Array of dependent entities
    invalidated_at TIMESTAMPTZ DEFAULT NULL,
    invalidation_reason TEXT,
    
    -- Performance tracking
    computation_time_ms INTEGER,
    cache_size_bytes INTEGER GENERATED ALWAYS AS (pg_column_size(metrics_json)) STORED,
    
    -- Constraints
    PRIMARY KEY (user_id, cache_key),
    CONSTRAINT check_positive_hit_count CHECK (hit_count >= 0),
    CONSTRAINT check_positive_computation_time CHECK (computation_time_ms IS NULL OR computation_time_ms >= 0),
    CONSTRAINT check_valid_expiration CHECK (expires_at > created_at)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_portfolio_metrics_expires_at 
    ON portfolio_metrics_cache(expires_at) 
    WHERE invalidated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_portfolio_metrics_last_accessed 
    ON portfolio_metrics_cache(last_accessed);

CREATE INDEX IF NOT EXISTS idx_portfolio_metrics_dependencies 
    ON portfolio_metrics_cache USING GIN(dependencies);

CREATE INDEX IF NOT EXISTS idx_portfolio_metrics_user_active 
    ON portfolio_metrics_cache(user_id, expires_at) 
    WHERE invalidated_at IS NULL;

-- Enable Row Level Security
ALTER TABLE portfolio_metrics_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can only read their own cache entries
CREATE POLICY "Users read own cache" ON portfolio_metrics_cache
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own cache entries
CREATE POLICY "Users insert own cache" ON portfolio_metrics_cache
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own cache entries
CREATE POLICY "Users update own cache" ON portfolio_metrics_cache
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Service role has full access for maintenance
CREATE POLICY "Service role full access" ON portfolio_metrics_cache
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- Cache Invalidation Functions and Triggers
-- ============================================================================

-- Function to invalidate portfolio cache on data changes
CREATE OR REPLACE FUNCTION invalidate_portfolio_cache()
RETURNS TRIGGER AS $$
DECLARE
    affected_user_id UUID;
    affected_symbols TEXT[];
BEGIN
    -- For transactions table changes
    IF TG_TABLE_NAME = 'transactions' THEN
        affected_user_id := COALESCE(NEW.user_id, OLD.user_id);
        affected_symbols := ARRAY[COALESCE(NEW.symbol, OLD.symbol)];
        
        -- Invalidate all cache entries for this user
        UPDATE portfolio_metrics_cache
        SET invalidated_at = NOW(),
            invalidation_reason = 'Transaction ' || TG_OP || ': ' || array_to_string(affected_symbols, ',')
        WHERE user_id = affected_user_id
          AND invalidated_at IS NULL;
          
    -- For price updates
    ELSIF TG_TABLE_NAME = 'historical_prices' THEN
        affected_symbols := ARRAY[COALESCE(NEW.symbol, OLD.symbol)];
        
        -- Invalidate caches with price dependencies
        UPDATE portfolio_metrics_cache
        SET invalidated_at = NOW(),
            invalidation_reason = 'Price update: ' || array_to_string(affected_symbols, ',')
        WHERE invalidated_at IS NULL
          AND dependencies @> jsonb_build_array(
              jsonb_build_object(
                  'type', 'prices',
                  'symbol', ANY(affected_symbols)
              )
          );
    
    -- For dividend updates
    ELSIF TG_TABLE_NAME = 'user_dividends' THEN
        affected_user_id := COALESCE(NEW.user_id, OLD.user_id);
        
        -- Invalidate dividend-related caches
        UPDATE portfolio_metrics_cache
        SET invalidated_at = NOW(),
            invalidation_reason = 'Dividend ' || TG_OP
        WHERE user_id = affected_user_id
          AND invalidated_at IS NULL
          AND dependencies @> jsonb_build_array(
              jsonb_build_object(
                  'type', 'dividends',
                  'user_id', affected_user_id::text
              )
          );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for cache invalidation
CREATE TRIGGER trigger_invalidate_cache_on_transaction
    AFTER INSERT OR UPDATE OR DELETE ON transactions
    FOR EACH ROW EXECUTE FUNCTION invalidate_portfolio_cache();

CREATE TRIGGER trigger_invalidate_cache_on_price
    AFTER INSERT OR UPDATE ON historical_prices
    FOR EACH ROW EXECUTE FUNCTION invalidate_portfolio_cache();

CREATE TRIGGER trigger_invalidate_cache_on_dividend
    AFTER INSERT OR UPDATE OR DELETE ON user_dividends
    FOR EACH ROW EXECUTE FUNCTION invalidate_portfolio_cache();

-- ============================================================================
-- Maintenance Functions
-- ============================================================================

-- Function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_portfolio_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete entries that are expired or invalidated more than 1 day ago
    DELETE FROM portfolio_metrics_cache
    WHERE expires_at < NOW() - INTERVAL '1 day'
       OR invalidated_at < NOW() - INTERVAL '1 day';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Log cleanup activity
    RAISE NOTICE 'Cleaned up % expired cache entries', deleted_count;
    
    -- Update table statistics for query planner
    ANALYZE portfolio_metrics_cache;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Monitoring Views
-- ============================================================================

-- View for cache performance metrics
CREATE OR REPLACE VIEW portfolio_cache_performance AS
SELECT 
    DATE_TRUNC('hour', created_at) as hour,
    COUNT(*) as total_entries,
    COUNT(*) FILTER (WHERE hit_count > 0) as entries_with_hits,
    SUM(hit_count) as total_hits,
    AVG(hit_count) as avg_hits_per_entry,
    AVG(computation_time_ms) as avg_computation_ms,
    AVG(cache_size_bytes) as avg_cache_size_bytes,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(*) FILTER (WHERE invalidated_at IS NOT NULL) as invalidated_entries
FROM portfolio_metrics_cache
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY 1
ORDER BY 1 DESC;

-- View for current cache status
CREATE OR REPLACE VIEW portfolio_cache_status AS
SELECT 
    COUNT(*) as total_entries,
    COUNT(*) FILTER (WHERE expires_at > NOW() AND invalidated_at IS NULL) as active_entries,
    COUNT(*) FILTER (WHERE expires_at <= NOW()) as expired_entries,
    COUNT(*) FILTER (WHERE invalidated_at IS NOT NULL) as invalidated_entries,
    SUM(cache_size_bytes) / 1024 / 1024 as total_size_mb,
    MAX(created_at) as last_cache_write,
    MAX(last_accessed) as last_cache_read
FROM portfolio_metrics_cache;

-- Grant permissions for monitoring views
GRANT SELECT ON portfolio_cache_performance TO authenticated;
GRANT SELECT ON portfolio_cache_status TO authenticated;

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON TABLE portfolio_metrics_cache IS 'Stores cached portfolio metrics with SQL-based TTL management and automatic invalidation';
COMMENT ON COLUMN portfolio_metrics_cache.cache_key IS 'Unique key for the cached metric, format: portfolio:v1:{type}:{params}';
COMMENT ON COLUMN portfolio_metrics_cache.dependencies IS 'JSON array of dependencies for cache invalidation (transactions, prices, dividends)';
COMMENT ON COLUMN portfolio_metrics_cache.computation_time_ms IS 'Time taken to compute the metrics in milliseconds';
COMMENT ON COLUMN portfolio_metrics_cache.cache_size_bytes IS 'Size of the cached JSON data in bytes';
COMMENT ON FUNCTION cleanup_expired_portfolio_cache() IS 'Removes expired and old invalidated cache entries, should be run daily';
COMMENT ON VIEW portfolio_cache_performance IS 'Hourly performance metrics for monitoring cache effectiveness';
COMMENT ON VIEW portfolio_cache_status IS 'Current status overview of the portfolio metrics cache';