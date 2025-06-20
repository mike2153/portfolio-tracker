from django.db import models
from django.contrib.auth.models import User
from decimal import Decimal
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from django.db.models import Manager

# pyright: reportArgumentType=false

# Create your models here.

class StockSymbol(models.Model):
    """Model to store comprehensive stock symbol database for fast searching"""
    symbol = models.CharField(max_length=20, unique=True, db_index=True)
    name = models.CharField(max_length=200, db_index=True)
    exchange_code = models.CharField(max_length=10, db_index=True)
    exchange_name = models.CharField(max_length=100)
    currency = models.CharField(max_length=3, default='USD')
    country = models.CharField(max_length=50)
    type = models.CharField(max_length=50, default='Common Stock')
    is_active = models.BooleanField(default=True)
    last_updated = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'stock_symbols'
        indexes = [
            models.Index(fields=['symbol']),
            models.Index(fields=['name']),
            models.Index(fields=['exchange_code']),
            models.Index(fields=['symbol', 'exchange_code']),
        ]

    def __str__(self):
        return f"{self.symbol} - {self.name} ({self.exchange_name})"


class SymbolRefreshLog(models.Model):
    """Track when symbol data was last refreshed from external APIs"""
    exchange_code = models.CharField(max_length=10, unique=True)
    last_refresh = models.DateTimeField(auto_now=True)
    total_symbols = models.IntegerField(default=0)
    success = models.BooleanField(default=True)
    error_message = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'symbol_refresh_logs'

    def __str__(self):
        return f"{self.exchange_code} - {self.last_refresh} ({self.total_symbols} symbols)"


class Portfolio(models.Model):
    """User's investment portfolio"""
    user_id = models.CharField(max_length=255, db_index=True)  # Supabase user ID
    name = models.CharField(max_length=100, default="My Portfolio")
    cash_balance = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'portfolios'
        indexes = [models.Index(fields=['user_id'])]

    def __str__(self):
        return f"{self.name} - {self.user_id}"


class Holding(models.Model):
    """Individual stock holdings in a portfolio"""
    portfolio = models.ForeignKey(Portfolio, on_delete=models.CASCADE, related_name='holdings')
    ticker = models.CharField(max_length=20, db_index=True)
    company_name = models.CharField(max_length=200)
    exchange = models.CharField(max_length=50, blank=True, null=True)
    shares = models.DecimalField(max_digits=15, decimal_places=6)
    purchase_price = models.DecimalField(max_digits=10, decimal_places=2)
    purchase_date = models.DateField()
    commission = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    used_cash_balance = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'holdings'
        indexes = [
            models.Index(fields=['portfolio', 'ticker']),
            models.Index(fields=['ticker']),
            models.Index(fields=['purchase_date'])
        ]

    def __str__(self):
        return f"{self.ticker} - {self.shares} shares"


class CashContribution(models.Model):
    """Track cash deposits to portfolio"""
    portfolio = models.ForeignKey(Portfolio, on_delete=models.CASCADE, related_name='cash_contributions')
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    contribution_date = models.DateField()
    description = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'cash_contributions'
        indexes = [
            models.Index(fields=['portfolio', 'contribution_date']),
            models.Index(fields=['contribution_date'])
        ]

    def __str__(self):
        return f"${self.amount} on {self.contribution_date}"


class DividendPayment(models.Model):
    """Track dividend payments"""
    holding = models.ForeignKey(Holding, on_delete=models.CASCADE, related_name='dividends')
    ex_date = models.DateField()
    payment_date = models.DateField()
    amount_per_share = models.DecimalField(max_digits=10, decimal_places=4)
    total_amount = models.DecimalField(max_digits=15, decimal_places=2)
    confirmed_received = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'dividend_payments'
        unique_together = ['holding', 'ex_date']
        indexes = [
            models.Index(fields=['holding', 'ex_date']),
            models.Index(fields=['payment_date']),
            models.Index(fields=['confirmed_received'])
        ]

    def __str__(self):
        return f"Dividend ${self.amount_per_share}/share on {self.ex_date}"


class PriceAlert(models.Model):
    """User-defined price alerts"""
    ALERT_TYPES = [
        ('above', 'Price Above'),
        ('below', 'Price Below'),
    ]

    portfolio = models.ForeignKey(Portfolio, on_delete=models.CASCADE, related_name='price_alerts')
    ticker = models.CharField(max_length=20, db_index=True)
    alert_type = models.CharField(max_length=10, choices=ALERT_TYPES)
    target_price = models.DecimalField(max_digits=10, decimal_places=2)
    is_active = models.BooleanField(default=True)
    triggered_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'price_alerts'
        indexes = [
            models.Index(fields=['portfolio', 'is_active']),
            models.Index(fields=['ticker', 'is_active'])
        ]

    def __str__(self):
        return f"{self.ticker} {self.alert_type} ${self.target_price}"


class PortfolioSnapshot(models.Model):
    """Daily snapshots of portfolio value for performance tracking"""
    portfolio = models.ForeignKey(Portfolio, on_delete=models.CASCADE, related_name='snapshots')
    snapshot_date = models.DateField(db_index=True)
    total_value = models.DecimalField(max_digits=15, decimal_places=2)
    cash_balance = models.DecimalField(max_digits=15, decimal_places=2)
    stock_value = models.DecimalField(max_digits=15, decimal_places=2)
    dividend_value = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'portfolio_snapshots'
        unique_together = ['portfolio', 'snapshot_date']
        indexes = [
            models.Index(fields=['portfolio', 'snapshot_date']),
            models.Index(fields=['snapshot_date'])
        ]

    def __str__(self):
        return f"Portfolio Snapshot - {self.snapshot_date}: ${self.total_value}"
