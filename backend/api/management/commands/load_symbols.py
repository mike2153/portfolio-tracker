import os
import requests
from django.core.management.base import BaseCommand
from django.db import transaction
from api.models import StockSymbol

ALPHA_VANTAGE_API_KEY = os.getenv('ALPHA_VANTAGE_API_KEY')

class Command(BaseCommand):
    help = 'Load US stock symbols from Alpha Vantage LISTING_STATUS and store the exchange as returned by Alpha Vantage.'

    def handle(self, *args, **options):
        if not ALPHA_VANTAGE_API_KEY:
            self.stdout.write(self.style.ERROR('ALPHA_VANTAGE_API_KEY environment variable is required'))
            return

        url = f'https://www.alphavantage.co/query?function=LISTING_STATUS&apikey={ALPHA_VANTAGE_API_KEY}'
        response = requests.get(url)
        if response.status_code != 200:
            self.stdout.write(self.style.ERROR(f'Alpha Vantage API error: {response.status_code}'))
            return

        lines = response.text.splitlines()
        header = lines[0].split(',')
        symbols_data = [dict(zip(header, line.split(','))) for line in lines[1:] if line]

        with transaction.atomic():
            StockSymbol.objects.filter(exchange_code__in=["NASDAQ", "NYSE", "AMEX"]).delete()
            symbols_to_create = []
            for item in symbols_data:
                symbol = item.get('symbol')
                name = item.get('name')
                exchange = item.get('exchange')
                currency = item.get('currency', 'USD')
                if not symbol or not exchange:
                    continue
                symbols_to_create.append(StockSymbol(
                    symbol=symbol,
                    name=name or symbol,
                    exchange_code=exchange,  # Store exactly as returned
                    exchange_name=exchange,  # Store exactly as returned
                    currency=currency,
                    country='United States',
                    type='Common Stock',
                    is_active=item.get('status', 'Active') == 'Active'
                ))
            StockSymbol.objects.bulk_create(symbols_to_create, ignore_conflicts=True)
            self.stdout.write(self.style.SUCCESS(f'Loaded {len(symbols_to_create)} US symbols from Alpha Vantage')) 