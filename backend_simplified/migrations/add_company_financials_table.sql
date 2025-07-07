-- Company financials caching table for performance and cost optimization
CREATE TABLE IF NOT EXISTS company_financials (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    data_type VARCHAR(50) NOT NULL, -- 'overview', 'income', 'balance', 'cashflow'
    financial_data JSONB NOT NULL,
    last_updated TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(symbol, data_type)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_company_financials_symbol_type 
ON company_financials(symbol, data_type);

CREATE INDEX IF NOT EXISTS idx_company_financials_last_updated 
ON company_financials(last_updated DESC);

-- Function to check if data is fresh (configurable freshness window)
CREATE OR REPLACE FUNCTION is_financials_data_fresh(
    last_updated_timestamp TIMESTAMP,
    freshness_hours INTEGER DEFAULT 24
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN last_updated_timestamp > (NOW() - INTERVAL '1 hour' * freshness_hours);
END;
$$ LANGUAGE plpgsql;