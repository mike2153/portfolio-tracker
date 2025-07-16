#!/usr/bin/env python3
"""
Check if the new session-aware tables exist in the database
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from supa_api.supa_api_client import get_supa_service_client

def check_tables():
    """Check if required tables exist"""
    supa = get_supa_service_client()
    
    tables_to_check = [
        'price_update_log',
        'market_holidays',
        'symbol_exchanges'
    ]
    
    print("Checking database tables...")
    
    for table in tables_to_check:
        try:
            # Try to query the table
            result = supa.table(table).select('*').limit(1).execute()
            print(f"✅ Table '{table}' exists")
        except Exception as e:
            print(f"❌ Table '{table}' does not exist or error: {e}")
    
    print("\nIf tables are missing, run the migration:")
    print("psql $DATABASE_URL -f migration/20250716_session_aware_price_tracking.sql")

if __name__ == "__main__":
    check_tables()