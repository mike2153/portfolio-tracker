from django.core.management.base import BaseCommand
from api.models import Transaction
from decimal import Decimal
from datetime import date, timedelta
import random

class Command(BaseCommand):
    help = 'Create sample transaction data for testing transaction-driven portfolio'

    def add_arguments(self, parser):
        parser.add_argument(
            '--user-id',
            type=str,
            default='0b8a164c-8e81-4328-a28f-1555560b7952',
            help='User ID to create sample transactions for'
        )

    def handle(self, *args, **options):
        user_id = options['user_id']
        
        # Delete existing transactions for this user to start fresh
        Transaction.objects.filter(user_id=user_id).delete()
        self.stdout.write(f'Cleared existing transactions for user {user_id}')

        # Sample transactions that will create a diversified portfolio
        sample_transactions = [
            # Technology stocks
            {
                'transaction_type': 'BUY',
                'ticker': 'AAPL',
                'company_name': 'Apple Inc.',
                'exchange': 'NASDAQ',
                'shares': Decimal('50.0'),
                'price_per_share': Decimal('150.00'),
                'transaction_date': date.today() - timedelta(days=120),
                'commission': Decimal('9.99')
            },
            {
                'transaction_type': 'BUY',
                'ticker': 'MSFT',
                'company_name': 'Microsoft Corporation',
                'exchange': 'NASDAQ',
                'shares': Decimal('30.0'),
                'price_per_share': Decimal('280.00'),
                'transaction_date': date.today() - timedelta(days=90),
                'commission': Decimal('9.99')
            },
            # Healthcare
            {
                'transaction_type': 'BUY',
                'ticker': 'JNJ',
                'company_name': 'Johnson & Johnson',
                'exchange': 'NYSE',
                'shares': Decimal('25.0'),
                'price_per_share': Decimal('165.00'),
                'transaction_date': date.today() - timedelta(days=60),
                'commission': Decimal('9.99')
            },
            # Financials
            {
                'transaction_type': 'BUY',
                'ticker': 'JPM',
                'company_name': 'JPMorgan Chase & Co.',
                'exchange': 'NYSE',
                'shares': Decimal('40.0'),
                'price_per_share': Decimal('140.00'),
                'transaction_date': date.today() - timedelta(days=45),
                'commission': Decimal('9.99')
            },
            # ETF
            {
                'transaction_type': 'BUY',
                'ticker': 'VTI',
                'company_name': 'Vanguard Total Stock Market ETF',
                'exchange': 'NYSE Arca',
                'shares': Decimal('75.0'),
                'price_per_share': Decimal('220.00'),
                'transaction_date': date.today() - timedelta(days=180),
                'commission': Decimal('0.00')
            },
            # Consumer Staples
            {
                'transaction_type': 'BUY',
                'ticker': 'KO',
                'company_name': 'The Coca-Cola Company',
                'exchange': 'NYSE',
                'shares': Decimal('60.0'),
                'price_per_share': Decimal('58.00'),
                'transaction_date': date.today() - timedelta(days=200),
                'commission': Decimal('9.99')
            },
            # Consumer Discretionary
            {
                'transaction_type': 'BUY',
                'ticker': 'TSLA',
                'company_name': 'Tesla, Inc.',
                'exchange': 'NASDAQ',
                'shares': Decimal('15.0'),
                'price_per_share': Decimal('250.00'),
                'transaction_date': date.today() - timedelta(days=30),
                'commission': Decimal('9.99')
            },
            # Energy
            {
                'transaction_type': 'BUY',
                'ticker': 'XOM',
                'company_name': 'Exxon Mobil Corporation',
                'exchange': 'NYSE',
                'shares': Decimal('35.0'),
                'price_per_share': Decimal('95.00'),
                'transaction_date': date.today() - timedelta(days=150),
                'commission': Decimal('9.99')
            },
            # Add some selling activity
            {
                'transaction_type': 'SELL',
                'ticker': 'AAPL',
                'company_name': 'Apple Inc.',
                'exchange': 'NASDAQ',
                'shares': Decimal('10.0'),  # Sell 10 shares of the 50 bought
                'price_per_share': Decimal('160.00'),  # Sold at a profit
                'transaction_date': date.today() - timedelta(days=30),
                'commission': Decimal('9.99')
            },
            # Add dividend income
            {
                'transaction_type': 'DIVIDEND',
                'ticker': 'KO',
                'company_name': 'The Coca-Cola Company',
                'exchange': 'NYSE',
                'shares': Decimal('60.0'),  # Number of shares that generated dividend
                'price_per_share': Decimal('0.46'),  # Dividend per share
                'transaction_date': date.today() - timedelta(days=60),
                'commission': Decimal('0.00')
            }
        ]

        # Create the transactions
        created_count = 0
        for transaction_data in sample_transactions:
            # Calculate total amount
            total_amount = transaction_data['shares'] * transaction_data['price_per_share'] + transaction_data['commission']
            
            transaction = Transaction.objects.create(
                user_id=user_id,
                transaction_currency='USD',
                fx_rate_to_usd=Decimal('1.0'),
                total_amount=total_amount,
                **transaction_data
            )
            created_count += 1
            self.stdout.write(
                f'Created {transaction.transaction_type}: {transaction.ticker} - {transaction.shares} shares @ ${transaction.price_per_share}'
            )

        self.stdout.write(
            self.style.SUCCESS(f'Successfully created {created_count} sample transactions')
        )
        
        # Calculate and display the resulting portfolio
        from api.models import Portfolio
        portfolio, _ = Portfolio.objects.get_or_create(user_id=user_id)
        calculated_holdings = portfolio.get_calculated_holdings()
        
        self.stdout.write('\n=== Calculated Portfolio Positions ===')
        total_invested = Decimal('0.00')
        
        for holding in calculated_holdings:
            cost = holding['shares'] * holding['average_price']
            total_invested += cost
            self.stdout.write(
                f"{holding['ticker']:6} | {holding['shares']:8.2f} shares | Avg: ${holding['average_price']:7.2f} | Cost: ${cost:9.2f}"
            )
        
        self.stdout.write(f'\nTotal Portfolio Value: ${total_invested:,.2f}') 