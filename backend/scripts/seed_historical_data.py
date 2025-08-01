#!/usr/bin/env python3
"""
Historical Data Seeding Script

This script fetches and stores historical price data for all symbols
that users have transactions for. It's designed to run as a one-time
setup and periodic maintenance task.

Usage:
    python seed_historical_data.py [--symbol SYMBOL] [--force]

Options:
    --symbol SYMBOL  Only process specific symbol
    --force         Force update even if data exists
    --dry-run       Show what would be done without actually doing it

Features:
- Fetches FULL historical data from Alpha Vantage
- Stores data in database for fast portfolio calculations
- Respects API rate limits
- Extensive logging for debugging
- Can be run incrementally
"""

import asyncio
import argparse
import logging
import sys
import os
from datetime import datetime, timedelta
from typing import List, Dict, Any

# Add backend directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from vantage_api.vantage_api_quotes import vantage_api_fetch_and_store_historical_data
from supa_api.supa_api_historical_prices import (
    supa_api_get_symbols_needing_historical_data,
    supa_api_check_historical_data_coverage
)
from debug_logger import DebugLogger

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('historical_data_seed.log'),
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger(__name__)

class HistoricalDataSeeder:
    """
    Handles seeding of historical price data for portfolio calculations
    """
    
    def __init__(self, force_update: bool = False, dry_run: bool = False):
        self.force_update = force_update
        self.dry_run = dry_run
        self.processed_symbols = 0
        self.skipped_symbols = 0
        self.failed_symbols = 0
        
        logger.info(f"""
========== HISTORICAL DATA SEEDING START ==========
TIMESTAMP: {datetime.now().isoformat()}
FORCE_UPDATE: {force_update}
DRY_RUN: {dry_run}
=============================================="""
        )
    
    async def seed_all_symbols(self) -> Dict[str, Any]:
        """
        Seed historical data for all symbols that users have transactions for
        """
        try:
            # Get all symbols needing historical data
            symbols_data = await supa_api_get_symbols_needing_historical_data()
            
            logger.info(f"[SEEDER] Found {len(symbols_data)} symbols needing historical data")
            
            if not symbols_data:
                logger.info("[SEEDER] No symbols found that need historical data")
                return {
                    'success': True,
                    'message': 'No symbols to process',
                    'symbols_processed': 0
                }
            
            results = []
            
            for symbol_info in symbols_data:
                symbol = symbol_info['symbol']
                earliest_date = symbol_info['earliest_transaction_date']
                
                logger.info(f"""
========== PROCESSING SYMBOL ==========
SYMBOL: {symbol}
EARLIEST_TRANSACTION: {earliest_date}
====================================="""
                )
                
                if self.dry_run:
                    logger.info(f"[DRY RUN] Would process {symbol} from {earliest_date}")
                    self.processed_symbols += 1
                    continue
                
                try:
                    # Check if we already have sufficient data
                    if not self.force_update:
                        coverage = await supa_api_check_historical_data_coverage(
                            symbol, 
                            earliest_date, 
                            datetime.now().date().strftime('%Y-%m-%d')
                        )
                        
                        if coverage['has_complete_coverage']:
                            logger.info(f"[SEEDER] {symbol} already has complete coverage ({coverage['coverage_percentage']:.1f}%), skipping")
                            self.skipped_symbols += 1
                            continue
                    
                    # Fetch and store historical data
                    result = await vantage_api_fetch_and_store_historical_data(symbol, earliest_date)
                    
                    if result['success']:
                        logger.info(f"[SEEDER] ✅ Successfully processed {symbol}: {result['records_stored']} records stored")
                        self.processed_symbols += 1
                        results.append({
                            'symbol': symbol,
                            'success': True,
                            'records_stored': result['records_stored'],
                            'date_range': result.get('date_range')
                        })
                    else:
                        logger.error(f"[SEEDER] ❌ Failed to process {symbol}: {result.get('error', 'Unknown error')}")
                        self.failed_symbols += 1
                        results.append({
                            'symbol': symbol,
                            'success': False,
                            'error': result.get('error')
                        })
                    
                    # Rate limiting - wait between requests
                    await asyncio.sleep(15)  # Alpha Vantage allows 5 calls per minute
                    
                except Exception as e:
                    logger.error(f"[SEEDER] ❌ Exception processing {symbol}: {e}")
                    self.failed_symbols += 1
                    results.append({
                        'symbol': symbol,
                        'success': False,
                        'error': str(e)
                    })
            
            summary = {
                'success': True,
                'symbols_processed': self.processed_symbols,
                'symbols_skipped': self.skipped_symbols,
                'symbols_failed': self.failed_symbols,
                'total_symbols': len(symbols_data),
                'results': results
            }
            
            logger.info(f"""
========== SEEDING SUMMARY ==========
TOTAL SYMBOLS: {len(symbols_data)}
PROCESSED: {self.processed_symbols}
SKIPPED: {self.skipped_symbols}
FAILED: {self.failed_symbols}
SUCCESS RATE: {(self.processed_symbols / len(symbols_data) * 100):.1f}%
=================================="""
            )
            
            return summary
            
        except Exception as e:
            logger.error(f"[SEEDER] Fatal error in seed_all_symbols: {e}")
            raise
    
    async def seed_single_symbol(self, symbol: str) -> Dict[str, Any]:
        """
        Seed historical data for a single symbol
        """
        logger.info(f"""
========== SINGLE SYMBOL SEEDING ==========
SYMBOL: {symbol}
FORCE_UPDATE: {self.force_update}
DRY_RUN: {self.dry_run}
======================================="""
        )
        
        try:
            if self.dry_run:
                logger.info(f"[DRY RUN] Would fetch historical data for {symbol}")
                return {'success': True, 'message': 'Dry run completed'}
            
            # Check current coverage
            today = datetime.now().date().strftime('%Y-%m-%d')
            five_years_ago = (datetime.now().date() - timedelta(days=5*365)).strftime('%Y-%m-%d')
            
            if not self.force_update:
                coverage = await supa_api_check_historical_data_coverage(symbol, five_years_ago, today)
                
                if coverage['has_complete_coverage']:
                    logger.info(f"[SEEDER] {symbol} already has complete coverage ({coverage['coverage_percentage']:.1f}%)")
                    return {
                        'success': True,
                        'message': f'{symbol} already has complete data',
                        'coverage': coverage
                    }
            
            # Fetch and store data
            result = await vantage_api_fetch_and_store_historical_data(symbol, five_years_ago)
            
            if result['success']:
                logger.info(f"[SEEDER] ✅ Successfully seeded {symbol}: {result['records_stored']} records")
                return result
            else:
                logger.error(f"[SEEDER] ❌ Failed to seed {symbol}: {result.get('error')}")
                return result
                
        except Exception as e:
            logger.error(f"[SEEDER] Exception seeding {symbol}: {e}")
            return {
                'success': False,
                'symbol': symbol,
                'error': str(e)
            }

async def main() -> None:
    """Main entry point for the script"""
    parser = argparse.ArgumentParser(description='Seed historical price data for portfolio calculations')
    parser.add_argument('--symbol', type=str, help='Only process specific symbol')
    parser.add_argument('--force', action='store_true', help='Force update even if data exists')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be done without doing it')
    
    args = parser.parse_args()
    
    seeder = HistoricalDataSeeder(
        force_update=args.force,
        dry_run=args.dry_run
    )
    
    try:
        if args.symbol:
            # Process single symbol
            result = await seeder.seed_single_symbol(args.symbol.upper())
            
            if result['success']:
                logger.info(f"✅ Successfully processed {args.symbol}")
                print(f"✅ Success: {result.get('message', 'Historical data seeded')}")
            else:
                logger.error(f"❌ Failed to process {args.symbol}: {result.get('error')}")
                print(f"❌ Error: {result.get('error')}")
                sys.exit(1)
        else:
            # Process all symbols
            result = await seeder.seed_all_symbols()
            
            if result['success']:
                print(f"""
✅ Historical Data Seeding Complete!

📊 Summary:
- Total symbols: {result['total_symbols']}
- Processed: {result['symbols_processed']}
- Skipped: {result['symbols_skipped']}
- Failed: {result['symbols_failed']}
- Success rate: {(result['symbols_processed'] / result['total_symbols'] * 100):.1f}%

Check historical_data_seed.log for detailed logs.
                """)
            else:
                print(f"❌ Seeding failed: {result.get('error')}")
                sys.exit(1)
                
    except KeyboardInterrupt:
        logger.info("Seeding interrupted by user")
        print("\n⚠️ Seeding interrupted. Check logs for progress.")
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        print(f"❌ Fatal error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main()) 