import os
import requests
import time
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from api.models import StockSymbol, SymbolRefreshLog


class Command(BaseCommand):
    help = 'Load comprehensive stock symbols from all supported exchanges'

    def add_arguments(self, parser):
        parser.add_argument(
            '--exchange',
            type=str,
            help='Specific exchange to load (default: all)',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force refresh even if recently updated',
        )

    def handle(self, *args, **options):
        finnhub_api_key = os.getenv('FINNHUB_API_KEY')
        
        if not finnhub_api_key:
            self.stdout.write(
                self.style.ERROR('FINNHUB_API_KEY environment variable is required')
            )
            return

        # Define all supported exchanges
        exchanges = {
            'US': {'name': 'NASDAQ/NYSE', 'country': 'United States', 'currency': 'USD'},
            'L': {'name': 'London Stock Exchange', 'country': 'United Kingdom', 'currency': 'GBP'},
            'DE': {'name': 'XETRA', 'country': 'Germany', 'currency': 'EUR'},
            'T': {'name': 'Tokyo Stock Exchange', 'country': 'Japan', 'currency': 'JPY'},
            'HK': {'name': 'Hong Kong Exchange', 'country': 'Hong Kong', 'currency': 'HKD'},
            'SS': {'name': 'Shanghai Stock Exchange', 'country': 'China', 'currency': 'CNY'},
            'SZ': {'name': 'Shenzhen Stock Exchange', 'country': 'China', 'currency': 'CNY'},
            'AX': {'name': 'Australian Securities Exchange', 'country': 'Australia', 'currency': 'AUD'},
            'TO': {'name': 'Toronto Stock Exchange', 'country': 'Canada', 'currency': 'CAD'},
            'PA': {'name': 'Euronext Paris', 'country': 'France', 'currency': 'EUR'},
            'AS': {'name': 'Euronext Amsterdam', 'country': 'Netherlands', 'currency': 'EUR'},
            'KS': {'name': 'Korea Exchange', 'country': 'South Korea', 'currency': 'KRW'},
            'NS': {'name': 'National Stock Exchange of India', 'country': 'India', 'currency': 'INR'},
            'SA': {'name': 'B3 Brasil Bolsa Balcão', 'country': 'Brazil', 'currency': 'BRL'},
        }

        target_exchange = options.get('exchange')
        if target_exchange:
            if target_exchange not in exchanges:
                self.stdout.write(
                    self.style.ERROR(f'Unknown exchange: {target_exchange}')
                )
                return
            exchanges = {target_exchange: exchanges[target_exchange]}

        self.stdout.write(
            self.style.SUCCESS(f'Loading symbols from {len(exchanges)} exchanges...')
        )

        total_loaded = 0
        for exchange_code, exchange_info in exchanges.items():
            loaded_count = self.load_exchange_symbols(
                exchange_code, exchange_info, finnhub_api_key, options.get('force', False)
            )
            total_loaded += loaded_count
            
            # Add delay between exchanges to avoid rate limiting
            if len(exchanges) > 1:
                time.sleep(2)

        self.stdout.write(
            self.style.SUCCESS(
                f'Successfully loaded {total_loaded} symbols across {len(exchanges)} exchanges'
            )
        )

    def load_exchange_symbols(self, exchange_code, exchange_info, api_key, force_refresh):
        """Load symbols for a specific exchange"""
        
        # Check if we need to refresh
        try:
            refresh_log = SymbolRefreshLog.objects.get(exchange_code=exchange_code)
            if not force_refresh:
                hours_since_refresh = (
                    timezone.now() - refresh_log.last_refresh
                ).total_seconds() / 3600
                
                if hours_since_refresh < 24:  # Skip if refreshed within 24 hours
                    self.stdout.write(
                        f'Skipping {exchange_code} - updated {hours_since_refresh:.1f} hours ago'
                    )
                    return 0
        except SymbolRefreshLog.DoesNotExist:
            pass

        self.stdout.write(f'Loading symbols for {exchange_code} ({exchange_info["name"]})...')

        try:
            # Fetch symbols from Finnhub
            url = f'https://finnhub.io/api/v1/stock/symbol?exchange={exchange_code}&token={api_key}'
            response = requests.get(url, timeout=30)
            
            if response.status_code != 200:
                error_msg = f'API request failed with status {response.status_code}'
                self.stdout.write(self.style.ERROR(f'Error loading {exchange_code}: {error_msg}'))
                self.log_refresh_error(exchange_code, error_msg)
                return 0

            symbols_data = response.json()
            
            if not isinstance(symbols_data, list):
                error_msg = 'Invalid API response format'
                self.stdout.write(self.style.ERROR(f'Error loading {exchange_code}: {error_msg}'))
                self.log_refresh_error(exchange_code, error_msg)
                return 0

            # Process symbols in batches using database transaction
            batch_size = 1000
            loaded_count = 0
            
            with transaction.atomic():
                # Clear existing symbols for this exchange
                existing_count = StockSymbol.objects.filter(exchange_code=exchange_code).count()
                if existing_count > 0:
                    StockSymbol.objects.filter(exchange_code=exchange_code).delete()
                    self.stdout.write(f'Cleared {existing_count} existing symbols for {exchange_code}')

                symbols_to_create = []
                
                for item in symbols_data:
                    symbol = item.get('displaySymbol') or item.get('symbol')
                    name = item.get('description') or symbol
                    
                    if not symbol or len(symbol) > 20:  # Skip invalid or too long symbols
                        continue
                    
                    # Create symbol object
                    stock_symbol = StockSymbol(
                        symbol=symbol,
                        name=name[:200],  # Ensure name fits in field
                        exchange_code=exchange_code,
                        exchange_name=exchange_info['name'],
                        currency=item.get('currency') or exchange_info['currency'],
                        country=exchange_info['country'],
                        type=item.get('type', 'Common Stock'),
                        is_active=True
                    )
                    
                    symbols_to_create.append(stock_symbol)
                    loaded_count += 1
                    
                    # Insert in batches
                    if len(symbols_to_create) >= batch_size:
                        StockSymbol.objects.bulk_create(symbols_to_create, ignore_conflicts=True)
                        symbols_to_create = []

                # Insert remaining symbols
                if symbols_to_create:
                    StockSymbol.objects.bulk_create(symbols_to_create, ignore_conflicts=True)

                # Log successful refresh
                refresh_log, created = SymbolRefreshLog.objects.get_or_create(
                    exchange_code=exchange_code,
                    defaults={
                        'total_symbols': loaded_count,
                        'success': True,
                        'error_message': None
                    }
                )
                
                if not created:
                    refresh_log.total_symbols = loaded_count
                    refresh_log.success = True
                    refresh_log.error_message = None
                    refresh_log.save()

            self.stdout.write(
                self.style.SUCCESS(f'Loaded {loaded_count} symbols for {exchange_code}')
            )
            return loaded_count

        except Exception as e:
            error_msg = str(e)
            self.stdout.write(self.style.ERROR(f'Error loading {exchange_code}: {error_msg}'))
            self.log_refresh_error(exchange_code, error_msg)
            return 0

    def log_refresh_error(self, exchange_code, error_message):
        """Log refresh error to database"""
        try:
            refresh_log, created = SymbolRefreshLog.objects.get_or_create(
                exchange_code=exchange_code,
                defaults={
                    'total_symbols': 0,
                    'success': False,
                    'error_message': error_message
                }
            )
            
            if not created:
                refresh_log.success = False
                refresh_log.error_message = error_message
                refresh_log.save()
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Failed to log error for {exchange_code}: {str(e)}')
            ) 