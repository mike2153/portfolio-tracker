-- Migration: Create session-aware price tracking and market holiday tables
-- Date: 2025-07-16
-- Purpose: Track market sessions to detect missed price updates and pre-load market holidays

-- Create price_update_log table to track last successful price updates per symbol
CREATE TABLE IF NOT EXISTS public.price_update_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol VARCHAR(10) NOT NULL,
    exchange VARCHAR(50),
    last_update_time TIMESTAMPTZ NOT NULL,
    last_session_date DATE, -- Last market session we have data for
    update_trigger VARCHAR(50), -- 'user_login', 'scheduled', 'manual', etc
    sessions_updated INTEGER DEFAULT 0,
    api_calls_made INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint: one log entry per symbol
    UNIQUE(symbol)
);

-- Create market_holidays table for pre-calculated holidays
CREATE TABLE IF NOT EXISTS public.market_holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exchange VARCHAR(50) NOT NULL,
    holiday_date DATE NOT NULL,
    holiday_name VARCHAR(100),
    market_status VARCHAR(20) DEFAULT 'closed', -- 'closed', 'early_close', 'late_open'
    early_close_time TIME, -- For early close days
    late_open_time TIME, -- For late open days
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint: one holiday per exchange per date
    UNIQUE(exchange, holiday_date)
);

-- Create symbol_exchanges table to map symbols to their primary exchange
CREATE TABLE IF NOT EXISTS public.symbol_exchanges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol VARCHAR(10) NOT NULL,
    exchange VARCHAR(50) NOT NULL,
    exchange_timezone VARCHAR(50), -- e.g., 'America/New_York'
    market_open_time TIME DEFAULT '09:30:00',
    market_close_time TIME DEFAULT '16:00:00',
    has_pre_market BOOLEAN DEFAULT true,
    has_after_hours BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint: one entry per symbol
    UNIQUE(symbol)
);

-- Row Level Security (RLS) - price_update_log is internal system table, no RLS needed
-- Market holidays and symbol exchanges are public data, no RLS needed

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_price_update_log_symbol_time 
    ON public.price_update_log(symbol, last_update_time DESC);
    
CREATE INDEX IF NOT EXISTS idx_price_update_log_last_session 
    ON public.price_update_log(last_session_date DESC);
    
CREATE INDEX IF NOT EXISTS idx_price_update_log_trigger 
    ON public.price_update_log(update_trigger);

CREATE INDEX IF NOT EXISTS idx_market_holidays_exchange_date 
    ON public.market_holidays(exchange, holiday_date);
    
CREATE INDEX IF NOT EXISTS idx_market_holidays_date 
    ON public.market_holidays(holiday_date);

CREATE INDEX IF NOT EXISTS idx_symbol_exchanges_symbol 
    ON public.symbol_exchanges(symbol);
    
CREATE INDEX IF NOT EXISTS idx_symbol_exchanges_exchange 
    ON public.symbol_exchanges(exchange);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_price_tracking_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to automatically update updated_at on updates
CREATE TRIGGER trigger_update_price_update_log_updated_at
    BEFORE UPDATE ON public.price_update_log
    FOR EACH ROW
    EXECUTE FUNCTION update_price_tracking_updated_at();

CREATE TRIGGER trigger_update_symbol_exchanges_updated_at
    BEFORE UPDATE ON public.symbol_exchanges
    FOR EACH ROW
    EXECUTE FUNCTION update_price_tracking_updated_at();

-- Function to get missed market sessions for a symbol
CREATE OR REPLACE FUNCTION get_missed_sessions(
    p_symbol VARCHAR,
    p_last_update TIMESTAMPTZ,
    p_exchange VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    session_date DATE,
    market_open TIMESTAMPTZ,
    market_close TIMESTAMPTZ,
    is_holiday BOOLEAN
) AS $$
DECLARE
    v_exchange VARCHAR;
    v_timezone VARCHAR;
    v_open_time TIME;
    v_close_time TIME;
    v_current_date DATE;
    v_end_date DATE;
BEGIN
    -- Get exchange info for symbol
    IF p_exchange IS NULL THEN
        SELECT exchange, exchange_timezone, market_open_time, market_close_time
        INTO v_exchange, v_timezone, v_open_time, v_close_time
        FROM symbol_exchanges
        WHERE symbol = p_symbol;
    ELSE
        v_exchange := p_exchange;
        -- Default to NYSE times if not found
        v_timezone := COALESCE(
            (SELECT exchange_timezone FROM symbol_exchanges WHERE exchange = p_exchange LIMIT 1),
            'America/New_York'
        );
        v_open_time := '09:30:00';
        v_close_time := '16:00:00';
    END IF;
    
    -- If no exchange found, default to NYSE
    IF v_exchange IS NULL THEN
        v_exchange := 'NYSE';
        v_timezone := 'America/New_York';
        v_open_time := '09:30:00';
        v_close_time := '16:00:00';
    END IF;
    
    -- Start from day after last update
    v_current_date := DATE(p_last_update AT TIME ZONE v_timezone) + INTERVAL '1 day';
    v_end_date := DATE(NOW() AT TIME ZONE v_timezone);
    
    -- Loop through each day
    WHILE v_current_date <= v_end_date LOOP
        -- Skip weekends
        IF EXTRACT(DOW FROM v_current_date) NOT IN (0, 6) THEN
            -- Check if it's a holiday
            IF NOT EXISTS (
                SELECT 1 FROM market_holidays 
                WHERE exchange = v_exchange 
                AND holiday_date = v_current_date
                AND market_status = 'closed'
            ) THEN
                -- Return this as a missed session
                RETURN QUERY
                SELECT 
                    v_current_date,
                    (v_current_date + v_open_time) AT TIME ZONE v_timezone,
                    (v_current_date + v_close_time) AT TIME ZONE v_timezone,
                    EXISTS (
                        SELECT 1 FROM market_holidays 
                        WHERE exchange = v_exchange 
                        AND holiday_date = v_current_date
                    );
            END IF;
        END IF;
        
        v_current_date := v_current_date + INTERVAL '1 day';
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- View to get symbols that need price updates
CREATE OR REPLACE VIEW symbols_needing_update AS
SELECT DISTINCT
    t.symbol,
    COALESCE(pul.last_update_time, '2020-01-01'::timestamptz) as last_update,
    COALESCE(se.exchange, 'NYSE') as exchange,
    COUNT(*) OVER (PARTITION BY t.symbol) as transaction_count
FROM transactions t
LEFT JOIN price_update_log pul ON t.symbol = pul.symbol
LEFT JOIN symbol_exchanges se ON t.symbol = se.symbol
WHERE t.symbol IS NOT NULL
ORDER BY transaction_count DESC, t.symbol;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.price_update_log TO authenticated;
GRANT SELECT ON public.market_holidays TO authenticated;
GRANT SELECT ON public.symbol_exchanges TO authenticated;
GRANT SELECT ON symbols_needing_update TO authenticated;

-- Comments for documentation
COMMENT ON TABLE public.price_update_log IS 'Tracks last successful price update for each symbol to detect missed market sessions';
COMMENT ON COLUMN public.price_update_log.symbol IS 'Stock symbol';
COMMENT ON COLUMN public.price_update_log.last_update_time IS 'Timestamp of last successful price update';
COMMENT ON COLUMN public.price_update_log.last_session_date IS 'Date of last market session we have price data for';
COMMENT ON COLUMN public.price_update_log.update_trigger IS 'What triggered this update (user_login, scheduled, manual)';
COMMENT ON COLUMN public.price_update_log.sessions_updated IS 'Number of market sessions updated in this batch';
COMMENT ON COLUMN public.price_update_log.api_calls_made IS 'Number of API calls made for this update';

COMMENT ON TABLE public.market_holidays IS 'Pre-calculated market holidays for all supported exchanges';
COMMENT ON COLUMN public.market_holidays.exchange IS 'Exchange code (NYSE, NASDAQ, TSX, LSE, ASX, etc.)';
COMMENT ON COLUMN public.market_holidays.holiday_date IS 'Date of the holiday';
COMMENT ON COLUMN public.market_holidays.market_status IS 'Market status: closed, early_close, late_open';

COMMENT ON TABLE public.symbol_exchanges IS 'Maps stock symbols to their primary exchange and trading hours';
COMMENT ON COLUMN public.symbol_exchanges.exchange_timezone IS 'Timezone of the exchange (e.g., America/New_York)';
COMMENT ON COLUMN public.symbol_exchanges.has_pre_market IS 'Whether this symbol trades in pre-market hours';
COMMENT ON COLUMN public.symbol_exchanges.has_after_hours IS 'Whether this symbol trades in after-hours';

-- Insert some common US market holidays for 2025-2026 as initial data
INSERT INTO public.market_holidays (exchange, holiday_date, holiday_name) VALUES
-- NYSE/NASDAQ holidays for 2025
('NYSE', '2025-01-01', 'New Year''s Day'),
('NYSE', '2025-01-20', 'Martin Luther King Jr. Day'),
('NYSE', '2025-02-17', 'Presidents Day'),
('NYSE', '2025-04-18', 'Good Friday'),
('NYSE', '2025-05-26', 'Memorial Day'),
('NYSE', '2025-06-19', 'Juneteenth'),
('NYSE', '2025-07-04', 'Independence Day'),
('NYSE', '2025-09-01', 'Labor Day'),
('NYSE', '2025-11-27', 'Thanksgiving Day'),
('NYSE', '2025-12-25', 'Christmas Day'),
-- Copy for NASDAQ
('NASDAQ', '2025-01-01', 'New Year''s Day'),
('NASDAQ', '2025-01-20', 'Martin Luther King Jr. Day'),
('NASDAQ', '2025-02-17', 'Presidents Day'),
('NASDAQ', '2025-04-18', 'Good Friday'),
('NASDAQ', '2025-05-26', 'Memorial Day'),
('NASDAQ', '2025-06-19', 'Juneteenth'),
('NASDAQ', '2025-07-04', 'Independence Day'),
('NASDAQ', '2025-09-01', 'Labor Day'),
('NASDAQ', '2025-11-27', 'Thanksgiving Day'),
('NASDAQ', '2025-12-25', 'Christmas Day')
ON CONFLICT (exchange, holiday_date) DO NOTHING;