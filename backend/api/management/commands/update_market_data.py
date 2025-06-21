# backend/api/management/commands/update_market_data.py
import logging
import time
from datetime import datetime, date, timedelta
from decimal import Decimal
from typing import List, Dict, Any, Optional
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.conf import settings
from ...models import CachedDailyPrice, CachedCompanyFundamentals
from ...alpha_vantage_service import get_alpha_vantage_service
from ...services.metrics_calculator import calculate_advanced_metrics

logger = logging.getLogger(__name__)

# Popular stocks and ETFs to cache (configurable via settings)
DEFAULT_POPULAR_TICKERS = [
    # Major US Stocks
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META', 'NFLX',
    'JPM', 'V', 'JNJ', 'WMT', 'PG', 'UNH', 'HD', 'MA', 'DIS', 'ADBE',
    'CRM', 'VZ', 'KO', 'PFE', 'INTC', 'CSCO', 'ABT', 'PEP', 'TMO', 'COST',
    'AVGO', 'XOM', 'NKE', 'LLY', 'ABBV', 'ACN', 'TXN', 'QCOM', 'DHR', 'NEE',
    
    # Major ETFs
    'SPY', 'QQQ', 'IVV', 'VOO', 'VTI', 'IEFA', 'VEA', 'VWO', 'VTV', 'VUG',
    'IJH', 'IJR', 'VB', 'VO', 'VXF', 'VNQ', 'VYM', 'VXUS', 'BND', 'AGG',
    
    # International
    'ASML', 'TSM', 'NVO', 'BABA', 'TM', 'UL', 'SNY', 'RHHBY', 'SHOP', 'RY',
    
    # Popular individual stocks
    'AMD', 'CRM', 'PYPL', 'ROKU', 'ZM', 'DOCU', 'PTON', 'SQ', 'TWLO', 'OKTA'
]

class Command(BaseCommand):
    help = 'Update market data cache with daily prices and company fundamentals'

    def add_arguments(self, parser):
        parser.add_argument(
            '--symbols',
            type=str,
            help='Comma-separated list of symbols to update (default: popular stocks)',
        )
        parser.add_argument(
            '--skip-prices',
            action='store_true',
            help='Skip updating daily prices',
        )
        parser.add_argument(
            '--skip-fundamentals',
            action='store_true',
            help='Skip updating company fundamentals',
        )
        parser.add_argument(
            '--force-refresh',
            action='store_true',
            help='Force refresh all data regardless of cache age',
        )
        parser.add_argument(
            '--max-symbols',
            type=int,
            default=100,
            help='Maximum number of symbols to process in this run',
        )

    def handle(self, *args, **options):
        """Main command handler"""
        start_time = time.time()
        self.stdout.write(self.style.SUCCESS('Starting market data update...'))
        
        # Get symbols to process
        symbols = self._get_symbols_to_process(options)
        max_symbols = options['max_symbols']
        
        if len(symbols) > max_symbols:
            symbols = symbols[:max_symbols]
            self.stdout.write(
                self.style.WARNING(f'Limiting to {max_symbols} symbols for this run')
            )
        
        self.stdout.write(f'Processing {len(symbols)} symbols: {", ".join(symbols[:10])}{"..." if len(symbols) > 10 else ""}')
        
        # Initialize Alpha Vantage service
        try:
            av_service = get_alpha_vantage_service()
        except Exception as e:
            raise CommandError(f'Failed to initialize Alpha Vantage service: {e}')
        
        # Track statistics
        stats = {
            'symbols_processed': 0,
            'prices_updated': 0,
            'fundamentals_updated': 0,
            'errors': 0,
            'skipped': 0
        }
        
        # Process each symbol
        for i, symbol in enumerate(symbols, 1):
            self.stdout.write(f'Processing {symbol} ({i}/{len(symbols)})...')
            
            try:
                symbol_stats = self._process_symbol(
                    symbol, av_service, options
                )
                
                # Update overall stats
                stats['symbols_processed'] += 1
                stats['prices_updated'] += symbol_stats.get('prices_updated', 0)
                stats['fundamentals_updated'] += symbol_stats.get('fundamentals_updated', 0)
                
                # Rate limiting - small delay between symbols
                time.sleep(1.2)  # Just over 1 second to stay under 60/minute
                
            except Exception as e:
                logger.error(f'Error processing symbol {symbol}: {e}', exc_info=True)
                self.stdout.write(
                    self.style.ERROR(f'Error processing {symbol}: {e}')
                )
                stats['errors'] += 1
                continue
        
        # Print final statistics
        duration = time.time() - start_time
        self._print_final_stats(stats, duration)

    def _get_symbols_to_process(self, options: Dict[str, Any]) -> List[str]:
        """Get list of symbols to process"""
        if options['symbols']:
            symbols = [s.strip().upper() for s in options['symbols'].split(',')]
        else:
            # Use configured popular tickers or default
            symbols = getattr(settings, 'POPULAR_TICKERS', DEFAULT_POPULAR_TICKERS)
        
        return symbols

    def _process_symbol(
        self, 
        symbol: str, 
        av_service, 
        options: Dict[str, Any]
    ) -> Dict[str, int]:
        """Process a single symbol - update both prices and fundamentals"""
        stats = {'prices_updated': 0, 'fundamentals_updated': 0}
        
        # Update daily prices
        if not options['skip_prices']:
            try:
                prices_updated = self._update_daily_prices(
                    symbol, av_service, options['force_refresh']
                )
                stats['prices_updated'] = prices_updated
                self.stdout.write(f'  Updated {prices_updated} price records for {symbol}')
            except Exception as e:
                logger.error(f'Error updating prices for {symbol}: {e}')
                self.stdout.write(
                    self.style.ERROR(f'  Failed to update prices for {symbol}: {e}')
                )
        
        # Update company fundamentals
        if not options['skip_fundamentals']:
            try:
                fundamentals_updated = self._update_company_fundamentals(
                    symbol, av_service, options['force_refresh']
                )
                stats['fundamentals_updated'] = fundamentals_updated
                if fundamentals_updated:
                    self.stdout.write(f'  Updated fundamentals for {symbol}')
                else:
                    self.stdout.write(f'  Fundamentals for {symbol} already current')
            except Exception as e:
                logger.error(f'Error updating fundamentals for {symbol}: {e}')
                self.stdout.write(
                    self.style.ERROR(f'  Failed to update fundamentals for {symbol}: {e}')
                )
        
        return stats

    def _update_daily_prices(
        self, 
        symbol: str, 
        av_service, 
        force_refresh: bool = False
    ) -> int:
        """Update daily prices for a symbol"""
        # Find the latest date we have cached
        latest_cached = CachedDailyPrice.objects.filter(
            symbol=symbol
        ).order_by('-date').first()
        
        if latest_cached and not force_refresh:
            # Only fetch new data since the latest cached date
            days_since_update = (date.today() - latest_cached.date).days
            if days_since_update <= 1:
                # Data is current
                return 0
        
        # Fetch historical data from Alpha Vantage
        historical_data = av_service.get_daily_adjusted(symbol, outputsize='compact')
        
        if not historical_data or 'data' not in historical_data:
            logger.warning(f'No historical data returned for {symbol}')
            return 0
        
        # Prepare records for bulk creation
        new_records = []
        update_count = 0
        
        for item in historical_data['data']:
            price_date = datetime.strptime(item['date'], '%Y-%m-%d').date()
            
            # Skip if we already have this date (unless force refresh)
            if not force_refresh and latest_cached and price_date <= latest_cached.date:
                continue
            
            try:
                new_records.append(CachedDailyPrice(
                    symbol=symbol,
                    date=price_date,
                    open=Decimal(str(item['open'])),
                    high=Decimal(str(item['high'])),
                    low=Decimal(str(item['low'])),
                    close=Decimal(str(item['close'])),
                    adjusted_close=Decimal(str(item['adjusted_close'])),
                    volume=int(item['volume']),
                    dividend_amount=Decimal(str(item.get('dividend_amount', '0.00')))
                ))
                update_count += 1
            except (ValueError, KeyError) as e:
                logger.warning(f'Invalid data for {symbol} on {item["date"]}: {e}')
                continue
        
        # Bulk create new records
        if new_records:
            with transaction.atomic():
                CachedDailyPrice.objects.bulk_create(
                    new_records, 
                    ignore_conflicts=True
                )
        
        return update_count

    def _update_company_fundamentals(
        self, 
        symbol: str, 
        av_service, 
        force_refresh: bool = False
    ) -> int:
        """Update company fundamentals for a symbol"""
        # Check if we need to update
        cached_fundamentals = CachedCompanyFundamentals.objects.filter(
            symbol=symbol
        ).first()
        
        if cached_fundamentals and not force_refresh:
            # Check if data is fresh (last 24 hours)
            hours_since_update = (
                datetime.now() - cached_fundamentals.last_updated.replace(tzinfo=None)
            ).total_seconds() / 3600
            
            if hours_since_update < 24:
                return 0  # Data is current
        
        # Fetch all required data for advanced metrics
        try:
            overview = av_service.get_company_overview(symbol)
            if not overview:
                logger.warning(f'No overview data for {symbol}')
                return 0
            
            # Fetch financial statements for advanced metrics
            income_statement = av_service.get_income_statement(symbol)
            balance_sheet = av_service.get_balance_sheet(symbol)
            cash_flow = av_service.get_cash_flow(symbol)
            
            # Calculate advanced metrics
            advanced_metrics = calculate_advanced_metrics(
                overview=overview,
                income_annual=income_statement.get('annual_reports', []) if income_statement else [],
                income_quarterly=income_statement.get('quarterly_reports', []) if income_statement else [],
                balance_annual=balance_sheet.get('annual_reports', []) if balance_sheet else [],
                balance_quarterly=balance_sheet.get('quarterly_reports', []) if balance_sheet else [],
                cash_flow_annual=cash_flow.get('annual_reports', []) if cash_flow else [],
                cash_flow_quarterly=cash_flow.get('quarterly_reports', []) if cash_flow else []
            )
            
            # Combine overview and advanced metrics
            combined_data = {
                'overview': overview,
                'advanced_metrics': advanced_metrics,
                'last_calculated': datetime.now().isoformat()
            }
            
            # Extract key metrics for direct fields
            market_cap = overview.get('MarketCapitalization')
            pe_ratio = advanced_metrics.get('valuation', {}).get('pe_ratio')
            pb_ratio = advanced_metrics.get('valuation', {}).get('pb_ratio')
            dividend_yield = overview.get('DividendYield')
            
            # Update or create the record
            with transaction.atomic():
                CachedCompanyFundamentals.objects.update_or_create(
                    symbol=symbol,
                    defaults={
                        'last_updated': datetime.now(),
                        'data': combined_data,
                        'market_capitalization': Decimal(str(market_cap)) if market_cap else None,
                        'pe_ratio': Decimal(str(pe_ratio)) if pe_ratio else None,
                        'pb_ratio': Decimal(str(pb_ratio)) if pb_ratio else None,
                        'dividend_yield': Decimal(str(dividend_yield)) if dividend_yield else None,
                    }
                )
            
            return 1
            
        except Exception as e:
            logger.error(f'Error fetching fundamental data for {symbol}: {e}')
            raise

    def _print_final_stats(self, stats: Dict[str, int], duration: float):
        """Print final statistics"""
        self.stdout.write('\n' + '='*50)
        self.stdout.write(self.style.SUCCESS('Market Data Update Complete'))
        self.stdout.write('='*50)
        self.stdout.write(f'Duration: {duration:.1f} seconds')
        self.stdout.write(f'Symbols processed: {stats["symbols_processed"]}')
        self.stdout.write(f'Price records updated: {stats["prices_updated"]}')
        self.stdout.write(f'Fundamentals updated: {stats["fundamentals_updated"]}')
        if stats['errors']:
            self.stdout.write(self.style.ERROR(f'Errors: {stats["errors"]}'))
        self.stdout.write('='*50) 