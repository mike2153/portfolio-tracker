-- Migration: Create index_series_cache table for pre-computed index simulation data
-- Purpose: Cache "what-if-SPY" series per user to eliminate 300ms compute latency
-- Author: Index Caching System Implementation
-- Date: 2025-01-04

-- Create the index_series_cache table
CREATE TABLE IF NOT EXISTS index_series_cache (
    user_id UUID NOT NULL,
    benchmark VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    value DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Primary key ensures uniqueness per user+benchmark+date
    PRIMARY KEY (user_id, benchmark, date)
);

-- Create optimized index for range queries (most common access pattern)
-- This supports WHERE user_id = ? AND benchmark = ? AND date BETWEEN ? AND ?
CREATE INDEX IF NOT EXISTS idx_cache_user_benchmark_date_range 
ON index_series_cache (user_id, benchmark, date);

-- Create index for cleanup operations (find old cache entries)
CREATE INDEX IF NOT EXISTS idx_cache_created_at 
ON index_series_cache (created_at);

-- Add comments for documentation
COMMENT ON TABLE index_series_cache IS 'Pre-computed index simulation cache. Stores daily portfolio values for "what if user bought benchmark" scenarios.';
COMMENT ON COLUMN index_series_cache.user_id IS 'User UUID from auth.users';
COMMENT ON COLUMN index_series_cache.benchmark IS 'Index ticker symbol (SPY, QQQ, A200, etc.)';
COMMENT ON COLUMN index_series_cache.date IS 'Trading date for this data point';
COMMENT ON COLUMN index_series_cache.value IS 'Simulated portfolio value in USD on this date';
COMMENT ON COLUMN index_series_cache.created_at IS 'When this cache entry was generated';

-- Create RLS policies to ensure users can only see their own cache data
ALTER TABLE index_series_cache ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only read their own cache data
CREATE POLICY "Users can read own index cache" ON index_series_cache
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Service role can manage all cache data (for background worker)
CREATE POLICY "Service role can manage all cache data" ON index_series_cache
    FOR ALL
    TO service_role
    USING (true);

-- Grant necessary permissions
GRANT ALL ON index_series_cache TO postgres;
GRANT SELECT ON index_series_cache TO anon;
GRANT ALL ON index_series_cache TO authenticated;
GRANT ALL ON index_series_cache TO service_role;

-- Log migration completion
INSERT INTO schema_migrations (version, applied_at) 
VALUES ('001_create_index_series_cache', NOW())
ON CONFLICT (version) DO NOTHING;