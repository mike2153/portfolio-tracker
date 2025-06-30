from django.db import models
from decimal import Decimal
from typing import TYPE_CHECKING, Optional
from datetime import datetime
from django.utils import timezone

if TYPE_CHECKING:
    from datetime import datetime
    from django.db.models import Manager

# pyright: reportArgumentType=false

# Create your models here.

class StockSymbol(models.Model):
    """Model to store comprehensive stock symbol database for fast searching"""
    symbol = models.CharField(max_length=20, unique=True, db_index=True)
    name = models.CharField(max_length=200, db_index=True)
    exchange_code = models.CharField(max_length=50, db_index=True)
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

    @property
    def ticker(self):
        """Alias for symbol field to match API expectations"""
        return self.symbol

    def __str__(self):
        return f"{self.symbol} - {self.name} ({self.exchange_name})"


class SymbolRefreshLog(models.Model):
    """Track when symbol data was last refreshed from external APIs"""
    exchange_code = models.CharField(max_length=50, unique=True)
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
    if TYPE_CHECKING:
        user_id: str
        name: str
        cash_balance: Decimal
        created_at: datetime
        updated_at: datetime
        holdings: 'Manager[Holding]'

    user_id = models.CharField(max_length=255, db_index=True)  # type: ignore[assignment] # Supabase user ID
    name = models.CharField(max_length=100, default="My Portfolio")  # type: ignore[assignment]
    cash_balance = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))  # type: ignore[assignment]
    created_at = models.DateTimeField(auto_now_add=True)  # type: ignore[assignment]
    updated_at = models.DateTimeField(auto_now=True)  # type: ignore[assignment]
    objects = models.Manager()

    class Meta:
        db_table = 'portfolios'
        indexes = [models.Index(fields=['user_id'])]

    def __str__(self):
        return f"{self.name} ({self.user_id})"


class Holding(models.Model):
    """Individual stock holdings in a portfolio"""
    portfolio = models.ForeignKey(Portfolio, on_delete=models.CASCADE, related_name='holdings')
    ticker = models.CharField(max_length=20, db_index=True)
    sector = models.CharField(max_length=100, blank=True, null=True, db_index=True)
    company_name = models.CharField(max_length=200)
    exchange = models.CharField(max_length=50, blank=True, null=True)
    shares = models.DecimalField(max_digits=15, decimal_places=6)
    purchase_price = models.DecimalField(max_digits=10, decimal_places=2)
    purchase_date = models.DateField()
    commission = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    used_cash_balance = models.BooleanField(default=False)
    currency = models.CharField(max_length=3, default='USD')
    fx_rate = models.DecimalField(max_digits=15, decimal_places=6, default=Decimal('1.0'))
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    objects = models.Manager()

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


class CachedDailyPrice(models.Model):
    """Cache daily price data to reduce API calls and improve performance"""
    symbol = models.CharField(max_length=20, db_index=True)
    date = models.DateField(db_index=True)
    open = models.DecimalField(max_digits=15, decimal_places=6)
    high = models.DecimalField(max_digits=15, decimal_places=6)
    low = models.DecimalField(max_digits=15, decimal_places=6)
    close = models.DecimalField(max_digits=15, decimal_places=6)
    adjusted_close = models.DecimalField(max_digits=15, decimal_places=6)
    volume = models.BigIntegerField()
    dividend_amount = models.DecimalField(max_digits=15, decimal_places=6, default=Decimal('0.00'))
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    objects = models.Manager()

    class Meta:
        db_table = 'cached_daily_prices'
        unique_together = ['symbol', 'date']
        indexes = [
            models.Index(fields=['symbol', 'date']),
            models.Index(fields=['date']),
            models.Index(fields=['symbol']),
        ]

    def __str__(self):
        return f"{self.symbol} - {self.date} (Adj Close: {self.adjusted_close})"


class CachedCompanyFundamentals(models.Model):
    """Cache company fundamental data and calculated metrics"""
    if TYPE_CHECKING:
        symbol: str
        last_updated: datetime
        data: dict
        market_capitalization: Optional[Decimal]
        pe_ratio: Optional[Decimal]
        pb_ratio: Optional[Decimal]
        dividend_yield: Optional[Decimal]
        created_at: datetime

    symbol = models.CharField(max_length=20, unique=True, db_index=True)  # type: ignore[assignment]
    last_updated = models.DateTimeField()  # type: ignore[assignment] # When this cache entry was last updated
    
    # Store fundamental data as JSON for flexibility
    data = models.JSONField(default=dict)  # type: ignore[assignment]
    
    # Key metrics as individual fields for easy querying (optional but useful)
    market_capitalization = models.DecimalField(max_digits=20, decimal_places=2, null=True, blank=True)  # type: ignore[assignment]
    pe_ratio = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)  # type: ignore[assignment]
    pb_ratio = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)  # type: ignore[assignment]
    dividend_yield = models.DecimalField(max_digits=6, decimal_places=4, null=True, blank=True)  # type: ignore[assignment]
    
    created_at = models.DateTimeField(auto_now_add=True)  # type: ignore[assignment]
    objects = models.Manager()

    class Meta:
        db_table = 'cached_company_fundamentals'
        indexes = [
            models.Index(fields=['symbol']),
            models.Index(fields=['last_updated']),
        ]

    def __str__(self):
        return f"{self.symbol} Fundamentals (Updated: {self.last_updated.strftime('%Y-%m-%d %H:%M')})"


class Transaction(models.Model):
    """
    Core transaction model - source of truth for all investment activities.
    Each transaction represents a single buy/sell/dividend action.
    """
    TRANSACTION_TYPES = [
        ('BUY', 'Buy'),
        ('SELL', 'Sell'),
        ('DIVIDEND', 'Dividend'),
    ]
    
    CURRENCIES = [
        ('USD', 'US Dollar'),
        ('EUR', 'Euro'),
        ('GBP', 'British Pound'),
        ('JPY', 'Japanese Yen'),
        ('CAD', 'Canadian Dollar'),
        ('AUD', 'Australian Dollar'),
        ('CHF', 'Swiss Franc'),
        ('CNY', 'Chinese Yuan'),
        ('INR', 'Indian Rupee'),
        ('KRW', 'South Korean Won'),
    ]
    
    # Core fields
    user_id = models.CharField(max_length=255, db_index=True)  # Supabase user ID
    transaction_type = models.CharField(max_length=10, choices=TRANSACTION_TYPES)
    
    # Stock information
    ticker = models.CharField(max_length=20)
    company_name = models.CharField(max_length=255)
    exchange = models.CharField(max_length=50, blank=True)
    
    # Transaction details
    shares = models.DecimalField(max_digits=15, decimal_places=6)
    price_per_share = models.DecimalField(max_digits=15, decimal_places=6)
    transaction_date = models.DateField()
    
    # Currency and exchange
    transaction_currency = models.CharField(max_length=3, choices=CURRENCIES, default='USD')
    fx_rate_to_usd = models.DecimalField(max_digits=15, decimal_places=6, default=Decimal('1.0'))
    
    # Costs and fees
    commission = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.0'))
    total_amount = models.DecimalField(max_digits=15, decimal_places=2)  # shares * price + commission
    
    # Historical data (fetched when transaction is created)
    daily_close_price = models.DecimalField(max_digits=15, decimal_places=6, null=True, blank=True)
    daily_volume = models.BigIntegerField(null=True, blank=True)
    
    # Metadata
    notes = models.TextField(blank=True)
    used_cash_balance = models.BooleanField(default=False)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'api_transaction'
        ordering = ['-transaction_date', '-created_at']
        indexes = [
            models.Index(fields=['user_id', 'ticker']),
            models.Index(fields=['user_id', 'transaction_date']),
            models.Index(fields=['ticker', 'transaction_date']),
        ]
    
    def __str__(self):
        return f"{self.transaction_type} {self.shares} {self.ticker} @ {self.price_per_share} on {self.transaction_date}"
    
    def save(self, *args, **kwargs):
        """Calculate total_amount on save"""
        if self.transaction_type in ['BUY', 'SELL']:
            self.total_amount = (self.shares * self.price_per_share) + self.commission
        else:  # DIVIDEND
            self.total_amount = self.shares * self.price_per_share  # dividend per share * shares
        super().save(*args, **kwargs)


class DailyPriceCache(models.Model):
    """
    Cache for daily price data to avoid repeated API calls.
    Stores historical prices fetched based on user transaction needs.
    """
    ticker = models.CharField(max_length=20)
    date = models.DateField()
    
    # OHLCV data
    open_price = models.DecimalField(max_digits=15, decimal_places=6)
    high_price = models.DecimalField(max_digits=15, decimal_places=6)
    low_price = models.DecimalField(max_digits=15, decimal_places=6)
    close_price = models.DecimalField(max_digits=15, decimal_places=6)
    adjusted_close = models.DecimalField(max_digits=15, decimal_places=6)
    volume = models.BigIntegerField()
    
    # Metadata
    source = models.CharField(max_length=50, default='AlphaVantage')
    requested_by_user = models.CharField(max_length=255, blank=True)  # Track who requested this data
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'api_daily_price_cache'
        unique_together = ['ticker', 'date']
        indexes = [
            models.Index(fields=['ticker', 'date']),
            models.Index(fields=['ticker']),
        ]
    
    def __str__(self):
        return f"{self.ticker} {self.date}: ${self.close_price}"


class UserApiRateLimit(models.Model):
    """
    Track API rate limiting per user to prevent abuse.
    Implements 1-minute rate limiting for real-time price updates.
    """
    user_id = models.CharField(max_length=255, unique=True)
    
    # Rate limiting fields
    last_price_fetch = models.DateTimeField(null=True, blank=True)
    fetch_count_today = models.IntegerField(default=0)
    daily_limit = models.IntegerField(default=100)  # Max fetches per day
    
    # Status tracking
    rate_limit_exceeded = models.BooleanField(default=False)
    last_reset_date = models.DateField(auto_now_add=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'api_user_rate_limit'
    
    def can_fetch_prices(self):
        """Check if user can fetch prices (1-minute rate limit)"""
        if not self.last_price_fetch:
            return True
        
        time_since_last = timezone.now() - self.last_price_fetch
        return time_since_last.seconds >= 60
    
    def reset_daily_count_if_needed(self):
        """Reset daily count if it's a new day"""
        today = timezone.now().date()
        if self.last_reset_date < today:
            self.fetch_count_today = 0
            self.last_reset_date = today
            self.rate_limit_exceeded = False
            self.save()
    
    def record_price_fetch(self):
        """Record a price fetch and update limits"""
        self.reset_daily_count_if_needed()
        
        self.last_price_fetch = timezone.now()
        self.fetch_count_today += 1
        
        if self.fetch_count_today >= self.daily_limit:
            self.rate_limit_exceeded = True
        
        self.save()


class UserSettings(models.Model):
    """
    User preferences and settings for portfolio display.
    """
    DISPLAY_CURRENCIES = [
        ('USD', 'US Dollar'),
        ('EUR', 'Euro'),
        ('GBP', 'British Pound'),
        ('JPY', 'Japanese Yen'),
        ('CAD', 'Canadian Dollar'),
        ('AUD', 'Australian Dollar'),
        ('CHF', 'Swiss Franc'),
        ('CNY', 'Chinese Yuan'),
        ('INR', 'Indian Rupee'),
        ('KRW', 'South Korean Won'),
    ]
    
    user_id = models.CharField(max_length=255, unique=True)
    
    # Display preferences
    display_currency = models.CharField(max_length=3, choices=DISPLAY_CURRENCIES, default='USD')
    show_currency_conversion = models.BooleanField(default=True)
    
    # Regional settings
    timezone = models.CharField(max_length=50, default='UTC')
    date_format = models.CharField(max_length=20, default='YYYY-MM-DD')
    
    # Portfolio preferences
    default_transaction_currency = models.CharField(max_length=3, choices=DISPLAY_CURRENCIES, default='USD')
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'api_user_settings'
    
    def __str__(self):
        return f"Settings for {self.user_id} (Display: {self.display_currency})"


class ExchangeRate(models.Model):
    """
    Store exchange rates for currency conversion.
    Cached daily from free APIs (ECB, Alpha Vantage).
    """
    base_currency = models.CharField(max_length=3)  # e.g., 'USD'
    target_currency = models.CharField(max_length=3)  # e.g., 'EUR'
    rate = models.DecimalField(max_digits=15, decimal_places=6)  # 1 USD = X EUR
    date = models.DateField()
    
    # Metadata
    source = models.CharField(max_length=50, default='ECB')
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'api_exchange_rate'
        unique_together = ['base_currency', 'target_currency', 'date']
        indexes = [
            models.Index(fields=['base_currency', 'target_currency', 'date']),
        ]
    
    def __str__(self):
        return f"1 {self.base_currency} = {self.rate} {self.target_currency} ({self.date})"


class UserWatchlist(models.Model):
    """User's stock watchlist for tracking favorites"""
    user_id = models.CharField(max_length=255, db_index=True)
    ticker = models.CharField(max_length=20, db_index=True)
    company_name = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'user_watchlist'
        unique_together = ['user_id', 'ticker']
        indexes = [
            models.Index(fields=['user_id', 'ticker']),
            models.Index(fields=['user_id']),
        ]
    
    def __str__(self):
        return f"{self.user_id} - {self.ticker}"


class StockNote(models.Model):
    """User notes for individual stocks"""
    user_id = models.CharField(max_length=255, db_index=True)
    ticker = models.CharField(max_length=20, db_index=True)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'stock_notes'
        indexes = [
            models.Index(fields=['user_id', 'ticker']),
            models.Index(fields=['user_id']),
            models.Index(fields=['ticker']),
        ]
    
    def __str__(self):
        return f"{self.user_id} - {self.ticker} note"
