from django.core.management.base import BaseCommand
from api.models import Portfolio, Holding
from decimal import Decimal
from datetime import date, timedelta
import random

class Command(BaseCommand):
    help = 'Create sample portfolio data for testing dashboard'

    def add_arguments(self, parser):
        parser.add_argument(
            '--user-id',
            type=str,
            default='0b8a164c-8e81-4328-a28f-1555560b7952',
            help='User ID to create sample data for'
        )

    def handle(self, *args, **options):
        user_id = options['user_id']
        
        # Create or get a portfolio for the user
        portfolio, created = Portfolio.objects.get_or_create(
            user_id=user_id,
            defaults={
                'name': 'My Portfolio',
                'cash_balance': Decimal('5000.00')
            }
        )
        
        if created:
            self.stdout.write(f'Created new portfolio for user {user_id}')
        else:
            self.stdout.write(f'Using existing portfolio for user {user_id}')

        # Sample holdings data with sectors
        sample_holdings = [
            {
                'ticker': 'AAPL',
                'company_name': 'Apple Inc.',
                'sector': 'Technology',
                'exchange': 'NASDAQ',
                'shares': Decimal('50.0'),
                'purchase_price': Decimal('150.00'),
                'purchase_date': date.today() - timedelta(days=120),
                'commission': Decimal('9.99')
            },
            {
                'ticker': 'MSFT',
                'company_name': 'Microsoft Corporation',
                'sector': 'Technology',
                'exchange': 'NASDAQ',
                'shares': Decimal('30.0'),
                'purchase_price': Decimal('280.00'),
                'purchase_date': date.today() - timedelta(days=90),
                'commission': Decimal('9.99')
            },
            {
                'ticker': 'JNJ',
                'company_name': 'Johnson & Johnson',
                'sector': 'Healthcare',
                'exchange': 'NYSE',
                'shares': Decimal('25.0'),
                'purchase_price': Decimal('165.00'),
                'purchase_date': date.today() - timedelta(days=60),
                'commission': Decimal('9.99')
            },
            {
                'ticker': 'JPM',
                'company_name': 'JPMorgan Chase & Co.',
                'sector': 'Financials',
                'exchange': 'NYSE',
                'shares': Decimal('40.0'),
                'purchase_price': Decimal('140.00'),
                'purchase_date': date.today() - timedelta(days=45),
                'commission': Decimal('9.99')
            },
            {
                'ticker': 'VTI',
                'company_name': 'Vanguard Total Stock Market ETF',
                'sector': 'ETF',
                'exchange': 'NYSE Arca',
                'shares': Decimal('75.0'),
                'purchase_price': Decimal('220.00'),
                'purchase_date': date.today() - timedelta(days=180),
                'commission': Decimal('0.00')
            },
            {
                'ticker': 'KO',
                'company_name': 'The Coca-Cola Company',
                'sector': 'Consumer Staples',
                'exchange': 'NYSE',
                'shares': Decimal('60.0'),
                'purchase_price': Decimal('58.00'),
                'purchase_date': date.today() - timedelta(days=200),
                'commission': Decimal('9.99')
            },
            {
                'ticker': 'TSLA',
                'company_name': 'Tesla, Inc.',
                'sector': 'Consumer Discretionary',
                'exchange': 'NASDAQ',
                'shares': Decimal('15.0'),
                'purchase_price': Decimal('250.00'),
                'purchase_date': date.today() - timedelta(days=30),
                'commission': Decimal('9.99')
            },
            {
                'ticker': 'XOM',
                'company_name': 'Exxon Mobil Corporation',
                'sector': 'Energy',
                'exchange': 'NYSE',
                'shares': Decimal('35.0'),
                'purchase_price': Decimal('95.00'),
                'purchase_date': date.today() - timedelta(days=150),
                'commission': Decimal('9.99')
            }
        ]

        # Delete existing holdings for this portfolio to avoid duplicates
        Holding.objects.filter(portfolio=portfolio).delete()
        
        # Create the holdings
        for holding_data in sample_holdings:
            holding = Holding.objects.create(
                portfolio=portfolio,
                **holding_data
            )
            self.stdout.write(f'Created holding: {holding.ticker} - {holding.shares} shares')

        self.stdout.write(
            self.style.SUCCESS(f'Successfully created {len(sample_holdings)} sample holdings')
        )
        
        # Display summary
        total_invested = sum(
            h.shares * h.purchase_price + h.commission 
            for h in Holding.objects.filter(portfolio=portfolio)
        )
        
        self.stdout.write(f'Total invested: ${total_invested:,.2f}')
        self.stdout.write(f'Cash balance: ${portfolio.cash_balance:,.2f}')
        self.stdout.write(f'Total portfolio value: ${total_invested + portfolio.cash_balance:,.2f}') 