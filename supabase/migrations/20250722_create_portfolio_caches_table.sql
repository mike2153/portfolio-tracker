-- Create portfolio_caches table for caching portfolio metrics
CREATE TABLE IF NOT EXISTS public.portfolio_caches (
    -- Primary key fields
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    cache_key TEXT NOT NULL,
    
    -- Cache data
    metrics_json JSONB NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_accessed TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Cache metadata
    hit_count INTEGER NOT NULL DEFAULT 0,
    cache_version INTEGER NOT NULL DEFAULT 1,
    dependencies JSONB,
    computation_time_ms INTEGER,
    
    -- Constraints
    PRIMARY KEY (user_id, cache_key),
    CONSTRAINT valid_expiry CHECK (expires_at > created_at),
    CONSTRAINT valid_hit_count CHECK (hit_count >= 0),
    CONSTRAINT valid_cache_version CHECK (cache_version > 0),
    CONSTRAINT valid_computation_time CHECK (computation_time_ms IS NULL OR computation_time_ms >= 0)
);

-- Create indexes for performance
CREATE INDEX idx_portfolio_caches_user_id ON public.portfolio_caches(user_id);
CREATE INDEX idx_portfolio_caches_expires_at ON public.portfolio_caches(expires_at);
CREATE INDEX idx_portfolio_caches_last_accessed ON public.portfolio_caches(last_accessed);

-- Enable Row Level Security
ALTER TABLE public.portfolio_caches ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only view their own cache entries
CREATE POLICY "Users can view their own cache entries"
    ON public.portfolio_caches
    FOR SELECT
    USING (auth.uid() = user_id);

-- RLS Policy: Users can only insert their own cache entries
CREATE POLICY "Users can insert their own cache entries"
    ON public.portfolio_caches
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can only update their own cache entries
CREATE POLICY "Users can update their own cache entries"
    ON public.portfolio_caches
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can only delete their own cache entries
CREATE POLICY "Users can delete their own cache entries"
    ON public.portfolio_caches
    FOR DELETE
    USING (auth.uid() = user_id);

-- Add comments for documentation
COMMENT ON TABLE public.portfolio_caches IS 'Caches for portfolio metrics to improve performance';
COMMENT ON COLUMN public.portfolio_caches.user_id IS 'User ID from auth.users table';
COMMENT ON COLUMN public.portfolio_caches.cache_key IS 'Unique key identifying the cached data type';
COMMENT ON COLUMN public.portfolio_caches.metrics_json IS 'Cached metrics data in JSON format';
COMMENT ON COLUMN public.portfolio_caches.created_at IS 'Timestamp when the cache entry was created';
COMMENT ON COLUMN public.portfolio_caches.expires_at IS 'Timestamp when the cache entry expires';
COMMENT ON COLUMN public.portfolio_caches.last_accessed IS 'Timestamp when the cache was last accessed';
COMMENT ON COLUMN public.portfolio_caches.hit_count IS 'Number of times this cache entry has been accessed';
COMMENT ON COLUMN public.portfolio_caches.cache_version IS 'Version number for cache invalidation';
COMMENT ON COLUMN public.portfolio_caches.dependencies IS 'JSON object tracking cache dependencies';
COMMENT ON COLUMN public.portfolio_caches.computation_time_ms IS 'Time taken to compute the cached data in milliseconds';