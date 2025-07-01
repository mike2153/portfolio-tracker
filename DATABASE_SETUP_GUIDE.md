# Database Setup Guide - Historical Prices

## Overview

The historical prices functionality requires database schema changes that **do NOT run automatically** with Docker builds. You need to apply these changes manually to your Supabase database.

## 🚀 Quick Setup (Recommended)

### Option 1: Using the Migration Script (Easiest)

```bash
# 1. Install dependencies
cd backend_simplified
pip install -r requirements.txt

# 2. Set environment variables
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# 3. Apply all migrations
cd scripts
python apply_migrations.py

# 4. Verify it worked
python apply_migrations.py --dry-run
```

### Option 2: Manual SQL Application

```bash
# Copy the SQL from the migration file and run it in Supabase Dashboard
# Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/sql
# Copy contents of: supabase/migrations/20250102000000_add_historical_prices.sql
# Paste and run in SQL editor
```

## 📋 Detailed Setup Options

### 1. Supabase Dashboard (Manual)

1. **Go to your Supabase project dashboard**
   - Visit: `https://supabase.com/dashboard/project/YOUR_PROJECT_ID`

2. **Open SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Copy and run migration**
   ```sql
   -- Copy the entire contents of this file:
   -- supabase/migrations/20250102000000_add_historical_prices.sql
   -- Paste here and click "Run"
   ```

4. **Verify tables created**
   ```sql
   -- Check if table exists
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_name = 'historical_prices';
   
   -- Check if function exists
   SELECT routine_name 
   FROM information_schema.routines 
   WHERE routine_name = 'get_historical_price_for_date';
   ```

### 2. Command Line with psql

```bash
# Connect directly to your Supabase database
psql "postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT.supabase.co:5432/postgres"

# Run the migration
\i supabase/migrations/20250102000000_add_historical_prices.sql

# Verify
\dt historical_prices
\df get_historical_price_for_date
```

### 3. Using Our Migration Script

```bash
cd backend_simplified/scripts

# Check what would be applied (dry run)
python apply_migrations.py --dry-run

# Apply all pending migrations
python apply_migrations.py

# Apply specific migration file
python apply_migrations.py --migration-file ../supabase/migrations/20250102000000_add_historical_prices.sql

# Force reapply (if needed)
python apply_migrations.py --force
```

## 🐳 Docker Integration

### The schema changes do NOT run automatically with Docker builds

**Why?** Supabase is an external managed service. Docker only builds your application code, not your database schema.

### Making it part of deployment process

#### Option A: Add to docker-compose startup

```yaml
# docker-compose.yml
version: '3.8'
services:
  backend:
    build: ./backend_simplified
    environment:
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
    command: >
      sh -c "
        python scripts/apply_migrations.py &&
        uvicorn main:app --host 0.0.0.0 --port 8000
      "
```

#### Option B: Separate migration container

```yaml
# docker-compose.yml
version: '3.8'
services:
  migrate:
    build: ./backend_simplified
    environment:
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
    command: python scripts/apply_migrations.py
    
  backend:
    build: ./backend_simplified
    depends_on:
      - migrate
    # ... rest of backend config
```

#### Option C: Init container pattern

```yaml
# docker-compose.yml
version: '3.8'
services:
  backend:
    build: ./backend_simplified
    init: true
    environment:
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
    entrypoint: >
      sh -c "
        echo 'Running database migrations...' &&
        python scripts/apply_migrations.py &&
        echo 'Starting application...' &&
        uvicorn main:app --host 0.0.0.0 --port 8000
      "
```

## 🔧 Environment Variables Setup

Create a `.env` file or set these environment variables:

```bash
# .env file
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

# Or for direct database connection
DATABASE_URL=postgresql://postgres:your-password@db.your-project.supabase.co:5432/postgres
```

### Finding your Supabase credentials:

1. **Go to your Supabase project settings**
   - `https://supabase.com/dashboard/project/YOUR_PROJECT/settings/api`

2. **Copy the values:**
   - Project URL → `SUPABASE_URL`
   - service_role key → `SUPABASE_SERVICE_ROLE_KEY`
   - anon public key → `SUPABASE_ANON_KEY`

## ✅ Verification Steps

After applying the migration, verify everything works:

### 1. Check Database Tables

```sql
-- In Supabase SQL Editor
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_name IN ('historical_prices', 'applied_migrations');
```

### 2. Test the Function

```sql
-- Test the price lookup function
SELECT * FROM get_historical_price_for_date('AAPL', '2024-01-15');
```

### 3. Test API Endpoint

```bash
# Test the historical price API
curl "http://localhost:8000/api/historical_price/AAPL?date=2024-01-15"
```

### 4. Seed Some Test Data

```bash
cd backend_simplified/scripts

# Seed data for AAPL (as a test)
python seed_historical_data.py --symbol AAPL

# Check if data was stored
# In Supabase SQL Editor:
# SELECT COUNT(*) FROM historical_prices WHERE symbol = 'AAPL';
```

## 🚨 Troubleshooting

### Common Issues:

1. **"Permission denied" errors**
   ```bash
   # Make sure you're using the service_role key, not anon key
   echo $SUPABASE_SERVICE_ROLE_KEY
   ```

2. **"Table already exists" errors**
   ```bash
   # Check if already applied
   python apply_migrations.py --dry-run
   ```

3. **Connection errors**
   ```bash
   # Test connection
   python -c "
   import asyncio
   import asyncpg
   import os
   async def test():
       conn = await asyncpg.connect(os.getenv('DATABASE_URL'))
       print('✅ Connection successful!')
       await conn.close()
   asyncio.run(test())
   "
   ```

4. **Migration script not found**
   ```bash
   # Make sure you're in the right directory
   ls -la supabase/migrations/
   ls -la backend_simplified/scripts/
   ```

## 🎯 Next Steps

After applying the database changes:

1. **Seed historical data**:
   ```bash
   cd backend_simplified/scripts
   python seed_historical_data.py
   ```

2. **Test the transaction form**:
   - Go to your frontend
   - Add a new transaction
   - Select a ticker (e.g., "AAPL")
   - Select a date (e.g., "2024-01-15")
   - Watch the price auto-populate!

3. **Monitor logs**:
   ```bash
   # Check seeding logs
   tail -f backend_simplified/scripts/historical_data_seed.log
   
   # Check migration logs
   tail -f backend_simplified/scripts/migrations.log
   ```

## 📞 Need Help?

If you run into issues:

1. Check the logs first: `tail -f backend_simplified/scripts/migrations.log`
2. Verify your environment variables are set correctly
3. Make sure your Supabase service role key has database access
4. Try the dry-run option first: `python apply_migrations.py --dry-run` 