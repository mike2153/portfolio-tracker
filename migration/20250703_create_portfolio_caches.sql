-- Migration: Create portfolio_caches table for performance optimization
-- Date: 2025-07-03
-- Purpose: Cache portfolio vs benchmark performance data to meet <200ms requirement

-- Create portfolio_caches table
CREATE TABLE IF NOT EXISTS public.portfolio_caches (
    user_id UUID NOT NULL,
    benchmark TEXT NOT NULL DEFAULT 'SPY',
    range TEXT NOT NULL, -- '7D', '1M', '3M', '1Y', 'YTD', 'MAX'
    as_of_date DATE NOT NULL, -- Last trading day included in the calculation
    portfolio_values JSONB NOT NULL, -- [{"d":"2024-01-02","v":12345.67}, ...]
    index_values JSONB NOT NULL, -- [{"d":"2024-01-02","v":12345.67}, ...]
    metadata JSONB DEFAULT '{}', -- Additional metadata (calculation params, etc.)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Primary key: one cache entry per user/benchmark/range combination
    PRIMARY KEY (user_id, benchmark, range),
    
    -- Foreign key to auth.users
    CONSTRAINT portfolio_caches_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Row Level Security (RLS) - users can only access their own cache entries
ALTER TABLE public.portfolio_caches ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can read their own cache entries
CREATE POLICY "Users can read own portfolio caches" ON public.portfolio_caches
    FOR SELECT
    USING (auth.uid() = user_id);

-- RLS Policy: Users can insert their own cache entries
CREATE POLICY "Users can insert own portfolio caches" ON public.portfolio_caches
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own cache entries
CREATE POLICY "Users can update own portfolio caches" ON public.portfolio_caches
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can delete their own cache entries
CREATE POLICY "Users can delete own portfolio caches" ON public.portfolio_caches
    FOR DELETE
    USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_portfolio_caches_user_benchmark 
    ON public.portfolio_caches(user_id, benchmark);
    
CREATE INDEX IF NOT EXISTS idx_portfolio_caches_updated_at 
    ON public.portfolio_caches(updated_at);
    
CREATE INDEX IF NOT EXISTS idx_portfolio_caches_as_of_date 
    ON public.portfolio_caches(as_of_date);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_portfolio_caches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at on updates
CREATE TRIGGER trigger_update_portfolio_caches_updated_at
    BEFORE UPDATE ON public.portfolio_caches
    FOR EACH ROW
    EXECUTE FUNCTION update_portfolio_caches_updated_at();

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolio_caches TO authenticated;

-- Comments for documentation
COMMENT ON TABLE public.portfolio_caches IS 'Caches portfolio vs benchmark performance calculations for optimization';
COMMENT ON COLUMN public.portfolio_caches.user_id IS 'User who owns this cache entry';
COMMENT ON COLUMN public.portfolio_caches.benchmark IS 'Benchmark ticker (SPY, QQQ, A200, URTH, etc.)';
COMMENT ON COLUMN public.portfolio_caches.range IS 'Time range for the calculation (7D, 1M, 3M, 1Y, YTD, MAX)';
COMMENT ON COLUMN public.portfolio_caches.as_of_date IS 'Last trading day included in this calculation';
COMMENT ON COLUMN public.portfolio_caches.portfolio_values IS 'Time series of portfolio values as JSON array';
COMMENT ON COLUMN public.portfolio_caches.index_values IS 'Time series of simulated index portfolio values as JSON array';
COMMENT ON COLUMN public.portfolio_caches.metadata IS 'Additional calculation metadata and parameters';