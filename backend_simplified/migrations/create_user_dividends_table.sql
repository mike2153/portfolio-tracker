-- Migration: Create user_dividends table for dividend tracking
-- Created: 2025-07-10
-- Purpose: Track dividend payments for user portfolio holdings

-- Create user_dividends table
CREATE TABLE IF NOT EXISTS user_dividends (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    symbol VARCHAR(10) NOT NULL,
    ex_date DATE NOT NULL,
    pay_date DATE NOT NULL,
    amount DECIMAL(15,4) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD' NOT NULL,
    confirmed BOOLEAN DEFAULT false NOT NULL,
    dividend_type VARCHAR(20) DEFAULT 'cash' NOT NULL, -- 'cash', 'drp', 'stock'
    source VARCHAR(50) DEFAULT 'alpha_vantage' NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_dividends_user_id ON user_dividends(user_id);
CREATE INDEX IF NOT EXISTS idx_user_dividends_symbol ON user_dividends(symbol);
CREATE INDEX IF NOT EXISTS idx_user_dividends_pay_date ON user_dividends(pay_date DESC);
CREATE INDEX IF NOT EXISTS idx_user_dividends_confirmed ON user_dividends(confirmed);
CREATE INDEX IF NOT EXISTS idx_user_dividends_user_symbol ON user_dividends(user_id, symbol);

-- Create unique constraint to prevent duplicate dividends
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_dividends_unique 
ON user_dividends(user_id, symbol, ex_date, pay_date, amount);

-- Enable Row Level Security (RLS)
ALTER TABLE user_dividends ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for users to only access their own dividends
CREATE POLICY "Users can only access their own dividends" ON user_dividends
    FOR ALL USING (auth.uid() = user_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_dividends_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_dividends_updated_at
    BEFORE UPDATE ON user_dividends
    FOR EACH ROW
    EXECUTE FUNCTION update_user_dividends_updated_at();

-- Add comments for documentation
COMMENT ON TABLE user_dividends IS 'Tracks dividend payments for user portfolio holdings';
COMMENT ON COLUMN user_dividends.user_id IS 'Foreign key to auth.users table';
COMMENT ON COLUMN user_dividends.symbol IS 'Stock ticker symbol';
COMMENT ON COLUMN user_dividends.ex_date IS 'Ex-dividend date (when stock goes ex-dividend)';
COMMENT ON COLUMN user_dividends.pay_date IS 'Payment date (when dividend is paid)';
COMMENT ON COLUMN user_dividends.amount IS 'Dividend amount per share';
COMMENT ON COLUMN user_dividends.currency IS 'Currency code (USD, EUR, etc.)';
COMMENT ON COLUMN user_dividends.confirmed IS 'Whether user has confirmed receiving this dividend';
COMMENT ON COLUMN user_dividends.dividend_type IS 'Type of dividend: cash, drp (dividend reinvestment), stock';
COMMENT ON COLUMN user_dividends.source IS 'Data source: alpha_vantage, manual, etc.';
COMMENT ON COLUMN user_dividends.notes IS 'Optional user notes about this dividend';