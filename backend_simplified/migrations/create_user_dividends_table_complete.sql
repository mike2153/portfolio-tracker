-- Complete user_dividends table schema for dividend tracking system
-- This table stores both global dividends (user_id = NULL) and user-specific dividend records

-- Drop table if it exists (be careful in production!)
DROP TABLE IF EXISTS user_dividends CASCADE;

-- Create the complete user_dividends table
CREATE TABLE user_dividends (
    -- Primary key
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Stock and user identification
    symbol VARCHAR(10) NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL for global dividends
    
    -- Dividend core data
    ex_date DATE NOT NULL,
    pay_date DATE,
    declaration_date DATE,
    record_date DATE,
    
    -- Amount information
    amount DECIMAL(15,8) NOT NULL, -- Per-share amount (high precision for crypto/stocks)
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- User-specific ownership data (only for user-specific records)
    shares_held_at_ex_date DECIMAL(15,6), -- NULL for global dividends
    current_holdings DECIMAL(15,6), -- Current shares held by user
    total_amount DECIMAL(15,2), -- Total dividend amount for user (amount * shares_held_at_ex_date)
    
    -- Status and confirmation
    confirmed BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'confirmed', 'edited'
    
    -- Metadata
    dividend_type VARCHAR(10) DEFAULT 'cash', -- 'cash', 'stock', 'drp'
    source VARCHAR(20) DEFAULT 'alpha_vantage', -- 'alpha_vantage', 'manual', 'broker'
    notes TEXT,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_amount CHECK (amount > 0),
    CONSTRAINT valid_shares CHECK (shares_held_at_ex_date IS NULL OR shares_held_at_ex_date >= 0),
    CONSTRAINT valid_current_holdings CHECK (current_holdings IS NULL OR current_holdings >= 0),
    CONSTRAINT valid_total_amount CHECK (total_amount IS NULL OR total_amount >= 0),
    CONSTRAINT valid_currency CHECK (currency IN ('USD', 'EUR', 'GBP', 'CAD', 'AUD')),
    CONSTRAINT valid_dividend_type CHECK (dividend_type IN ('cash', 'stock', 'drp')),
    CONSTRAINT valid_source CHECK (source IN ('alpha_vantage', 'manual', 'broker')),
    CONSTRAINT valid_status CHECK (status IN ('pending', 'confirmed', 'edited'))
);

-- Create indexes for performance
CREATE INDEX idx_user_dividends_symbol ON user_dividends(symbol);
CREATE INDEX idx_user_dividends_user_id ON user_dividends(user_id);
CREATE INDEX idx_user_dividends_ex_date ON user_dividends(ex_date);
CREATE INDEX idx_user_dividends_symbol_ex_date ON user_dividends(symbol, ex_date);
CREATE INDEX idx_user_dividends_user_symbol ON user_dividends(user_id, symbol);
CREATE INDEX idx_user_dividends_confirmed ON user_dividends(confirmed);
CREATE INDEX idx_user_dividends_global ON user_dividends(symbol, ex_date) WHERE user_id IS NULL;
CREATE INDEX idx_user_dividends_created_at ON user_dividends(created_at);

-- Create unique constraint for global dividends (prevent duplicates)
CREATE UNIQUE INDEX idx_user_dividends_global_unique 
ON user_dividends(symbol, ex_date, amount) 
WHERE user_id IS NULL;

-- Create unique constraint for user-specific dividends
CREATE UNIQUE INDEX idx_user_dividends_user_unique 
ON user_dividends(user_id, symbol, ex_date) 
WHERE user_id IS NOT NULL;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_user_dividends_updated_at 
    BEFORE UPDATE ON user_dividends 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE user_dividends ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can see global dividends (user_id IS NULL) and their own dividends
CREATE POLICY "user_dividends_select_policy" ON user_dividends
    FOR SELECT USING (
        user_id IS NULL OR user_id = auth.uid()
    );

-- RLS Policy: Users can insert their own dividends, service role can insert global dividends
CREATE POLICY "user_dividends_insert_policy" ON user_dividends
    FOR INSERT WITH CHECK (
        user_id = auth.uid() OR auth.role() = 'service_role'
    );

-- RLS Policy: Users can update their own dividends
CREATE POLICY "user_dividends_update_policy" ON user_dividends
    FOR UPDATE USING (
        user_id = auth.uid()
    );

-- RLS Policy: Users can delete their own dividends
CREATE POLICY "user_dividends_delete_policy" ON user_dividends
    FOR DELETE USING (
        user_id = auth.uid()
    );

-- Grant permissions
GRANT ALL ON user_dividends TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_dividends TO authenticated;

-- Add helpful comments
COMMENT ON TABLE user_dividends IS 'Stores dividend information - global dividends have user_id=NULL, user-specific dividends have user_id set';
COMMENT ON COLUMN user_dividends.user_id IS 'NULL for global dividends, set for user-specific dividend records';
COMMENT ON COLUMN user_dividends.shares_held_at_ex_date IS 'Shares user held at ex-dividend date (NULL for global dividends)';
COMMENT ON COLUMN user_dividends.total_amount IS 'Total dividend amount for user (amount * shares_held_at_ex_date)';
COMMENT ON COLUMN user_dividends.confirmed IS 'TRUE if user has confirmed receiving this dividend';
COMMENT ON COLUMN user_dividends.source IS 'Source of dividend data: alpha_vantage, manual, or broker';