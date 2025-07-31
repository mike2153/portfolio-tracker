-- Distributed Locking System for Portfolio Tracker
-- Provides database-based locking to prevent race conditions across multiple server instances
-- Uses PostgreSQL advisory locks for efficient distributed coordination

-- Create table to track distributed locks (for monitoring and debugging)
CREATE TABLE IF NOT EXISTS distributed_locks (
    id BIGSERIAL PRIMARY KEY,
    lock_name TEXT NOT NULL,
    acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    session_id TEXT,
    process_info JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient lock lookup
CREATE INDEX IF NOT EXISTS idx_distributed_locks_name_expires 
ON distributed_locks(lock_name, expires_at);

-- Clean up expired locks periodically
CREATE INDEX IF NOT EXISTS idx_distributed_locks_expires 
ON distributed_locks(expires_at) WHERE expires_at < NOW();

-- Function to acquire a distributed lock
CREATE OR REPLACE FUNCTION acquire_distributed_lock(
    p_lock_name TEXT,
    p_timeout_seconds INTEGER DEFAULT 300
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    lock_id BIGINT;
    expires_at TIMESTAMPTZ;
BEGIN
    -- Convert lock name to a hash for pg_advisory_lock (requires bigint)
    lock_id := ('x' || substr(md5(p_lock_name), 1, 15))::bit(60)::bigint;
    
    -- Calculate expiration time
    expires_at := NOW() + (p_timeout_seconds || ' seconds')::INTERVAL;
    
    -- Try to acquire PostgreSQL advisory lock (non-blocking)
    IF pg_try_advisory_lock(lock_id) THEN
        -- Record the lock for monitoring
        INSERT INTO distributed_locks (
            lock_name, 
            expires_at, 
            session_id,
            process_info
        ) VALUES (
            p_lock_name, 
            expires_at,
            current_setting('application_name', true),
            jsonb_build_object(
                'session_user', current_user,
                'backend_pid', pg_backend_pid(),
                'client_addr', inet_client_addr()::text
            )
        );
        
        RETURN TRUE;
    ELSE
        -- Lock is already held
        RETURN FALSE;
    END IF;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Log error and return false
        PERFORM pg_advisory_unlock(lock_id);
        RETURN FALSE;
END;
$$;

-- Function to release a distributed lock
CREATE OR REPLACE FUNCTION release_distributed_lock(
    p_lock_name TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    lock_id BIGINT;
    deleted_count INTEGER;
BEGIN
    -- Convert lock name to the same hash used in acquire
    lock_id := ('x' || substr(md5(p_lock_name), 1, 15))::bit(60)::bigint;
    
    -- Release the PostgreSQL advisory lock
    PERFORM pg_advisory_unlock(lock_id);
    
    -- Remove from tracking table
    DELETE FROM distributed_locks 
    WHERE lock_name = p_lock_name 
    AND session_id = current_setting('application_name', true);
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count > 0;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Ensure lock is released even if tracking update fails
        PERFORM pg_advisory_unlock(lock_id);
        RETURN FALSE;
END;
$$;

-- Function to check if a distributed lock is held
CREATE OR REPLACE FUNCTION check_distributed_lock(
    p_lock_name TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    lock_id BIGINT;
    lock_exists BOOLEAN;
BEGIN
    -- Convert lock name to hash
    lock_id := ('x' || substr(md5(p_lock_name), 1, 15))::bit(60)::bigint;
    
    -- Check if the advisory lock is held
    -- Note: This is a simplified check. In PostgreSQL, we can't directly check
    -- if a specific advisory lock is held by another session.
    -- We'll check our tracking table instead.
    
    SELECT EXISTS(
        SELECT 1 FROM distributed_locks 
        WHERE lock_name = p_lock_name 
        AND expires_at > NOW()
    ) INTO lock_exists;
    
    RETURN lock_exists;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$;

-- Function to clean up expired locks (should be called periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_distributed_locks()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    cleaned_count INTEGER;
    expired_lock RECORD;
    lock_id BIGINT;
BEGIN
    cleaned_count := 0;
    
    -- Find and clean expired locks
    FOR expired_lock IN 
        SELECT lock_name FROM distributed_locks 
        WHERE expires_at < NOW()
    LOOP
        -- Convert to lock ID and release
        lock_id := ('x' || substr(md5(expired_lock.lock_name), 1, 15))::bit(60)::bigint;
        PERFORM pg_advisory_unlock(lock_id);
        cleaned_count := cleaned_count + 1;
    END LOOP;
    
    -- Remove expired records from tracking table
    DELETE FROM distributed_locks WHERE expires_at < NOW();
    
    RETURN cleaned_count;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN cleaned_count;
END;
$$;

-- Enhanced dividend sync lock functions (compatible with existing code)
CREATE OR REPLACE FUNCTION acquire_dividend_sync_lock(
    p_sync_type TEXT, -- 'global' or 'user_<user_id>'
    p_timeout_seconds INTEGER DEFAULT 300
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN acquire_distributed_lock('dividend_sync_' || p_sync_type, p_timeout_seconds);
END;
$$;

CREATE OR REPLACE FUNCTION release_dividend_sync_lock(
    p_sync_type TEXT -- 'global' or 'user_<user_id>'
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN release_distributed_lock('dividend_sync_' || p_sync_type);
END;
$$;

-- Grant necessary permissions
GRANT SELECT, INSERT, DELETE ON distributed_locks TO authenticated;
GRANT USAGE ON SEQUENCE distributed_locks_id_seq TO authenticated;
GRANT EXECUTE ON FUNCTION acquire_distributed_lock TO authenticated;
GRANT EXECUTE ON FUNCTION release_distributed_lock TO authenticated;
GRANT EXECUTE ON FUNCTION check_distributed_lock TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_distributed_locks TO authenticated;
GRANT EXECUTE ON FUNCTION acquire_dividend_sync_lock TO authenticated;
GRANT EXECUTE ON FUNCTION release_dividend_sync_lock TO authenticated;

-- Add RLS policies for the distributed_locks table
ALTER TABLE distributed_locks ENABLE ROW LEVEL SECURITY;

-- Allow users to see only their own locks (based on session info)
CREATE POLICY "Users can view their own locks" ON distributed_locks
    FOR SELECT TO authenticated
    USING (
        session_id = current_setting('application_name', true) OR
        auth.uid()::text = ANY(SELECT jsonb_array_elements_text(process_info->'user_ids'))
    );

-- Allow service role to manage all locks
CREATE POLICY "Service role can manage all locks" ON distributed_locks
    FOR ALL TO service_role
    USING (true);

-- Create a view for monitoring active locks
CREATE OR REPLACE VIEW active_distributed_locks AS
SELECT 
    lock_name,
    acquired_at,
    expires_at,
    expires_at - NOW() as time_remaining,
    session_id,
    process_info,
    CASE 
        WHEN expires_at < NOW() THEN 'EXPIRED'
        WHEN expires_at - NOW() < INTERVAL '1 minute' THEN 'EXPIRING_SOON'
        ELSE 'ACTIVE'
    END as status
FROM distributed_locks
WHERE expires_at > NOW() - INTERVAL '1 hour'  -- Show recent locks for debugging
ORDER BY acquired_at DESC;

-- Grant access to the monitoring view
GRANT SELECT ON active_distributed_locks TO authenticated;