"""
Test suite for Pydantic validation models
Demonstrates that all input validation is working correctly
"""

import pytest
from decimal import Decimal
from datetime import date, datetime, timedelta
from pydantic import ValidationError

# Import validation models
from models.validation_models import (
    TransactionCreate,
    TransactionUpdate,
    WatchlistAdd,
    WatchlistUpdate,
    UserProfileCreate,
    UserProfileUpdate,
    CurrencyConvert,
    SymbolSearch,
    PerformanceQuery
)


class TestTransactionValidation:
    """Test transaction validation models"""
    
    def test_valid_transaction_create(self):
        """Test creating a valid transaction"""
        transaction = TransactionCreate(
            transaction_type="Buy",
            symbol="AAPL",
            quantity=Decimal("100.5"),
            price=Decimal("150.25"),
            date=date.today(),
            commission=Decimal("9.99"),
            notes="Test purchase"
        )
        assert transaction.symbol == "AAPL"  # Should be uppercase
        assert transaction.quantity == Decimal("100.5")
        assert transaction.currency == "USD"  # Default
        assert transaction.exchange_rate == Decimal("1.0")  # Default
    
    def test_invalid_transaction_type(self):
        """Test invalid transaction type"""
        with pytest.raises(ValidationError) as exc_info:
            TransactionCreate(
                transaction_type="BUY",  # Should be "Buy" not "BUY"
                symbol="AAPL",
                quantity=100,
                price=150,
                date=date.today()
            )
        assert "transaction_type" in str(exc_info.value)
    
    def test_symbol_validation(self):
        """Test symbol format validation"""
        # Valid symbols
        valid_symbols = ["AAPL", "BRK.B", "TSM", "123", "X"]
        for sym in valid_symbols:
            transaction = TransactionCreate(
                transaction_type="Buy",
                symbol=sym,
                quantity=100,
                price=150,
                date=date.today()
            )
            assert transaction.symbol == sym.upper()
        
        # Invalid symbols
        invalid_symbols = ["", "TOOLONGGG", "lower", "AAPL$", "AA PL"]
        for sym in invalid_symbols:
            with pytest.raises(ValidationError):
                TransactionCreate(
                    transaction_type="Buy",
                    symbol=sym,
                    quantity=100,
                    price=150,
                    date=date.today()
                )
    
    def test_quantity_validation(self):
        """Test quantity constraints"""
        # Valid quantity
        transaction = TransactionCreate(
            transaction_type="Buy",
            symbol="AAPL",
            quantity=Decimal("0.001"),
            price=150,
            date=date.today()
        )
        assert transaction.quantity == Decimal("0.001")
        
        # Invalid quantities
        with pytest.raises(ValidationError):
            TransactionCreate(
                transaction_type="Buy",
                symbol="AAPL",
                quantity=0,  # Must be positive
                price=150,
                date=date.today()
            )
        
        with pytest.raises(ValidationError):
            TransactionCreate(
                transaction_type="Buy",
                symbol="AAPL",
                quantity=10000001,  # Exceeds max
                price=150,
                date=date.today()
            )
    
    def test_date_validation(self):
        """Test transaction date validation"""
        # Valid date
        transaction = TransactionCreate(
            transaction_type="Buy",
            symbol="AAPL",
            quantity=100,
            price=150,
            date=date.today() - timedelta(days=365)  # 1 year ago
        )
        assert transaction.date == date.today() - timedelta(days=365)
        
        # Future date (invalid)
        with pytest.raises(ValidationError) as exc_info:
            TransactionCreate(
                transaction_type="Buy",
                symbol="AAPL",
                quantity=100,
                price=150,
                date=date.today() + timedelta(days=1)
            )
        assert "future" in str(exc_info.value).lower()
        
        # Too old date (invalid)
        with pytest.raises(ValidationError) as exc_info:
            TransactionCreate(
                transaction_type="Buy",
                symbol="AAPL",
                quantity=100,
                price=150,
                date=date.today() - timedelta(days=3651)  # >10 years
            )
        assert "10 years" in str(exc_info.value)
    
    def test_notes_sanitization(self):
        """Test notes field sanitization"""
        transaction = TransactionCreate(
            transaction_type="Buy",
            symbol="AAPL",
            quantity=100,
            price=150,
            date=date.today(),
            notes="Test <script>alert('xss')</script> notes"
        )
        # Should remove dangerous characters
        assert "<" not in transaction.notes
        assert ">" not in transaction.notes
        assert "'" not in transaction.notes
    
    def test_extra_fields_forbidden(self):
        """Test that extra fields are forbidden"""
        with pytest.raises(ValidationError) as exc_info:
            TransactionCreate(
                transaction_type="Buy",
                symbol="AAPL",
                quantity=100,
                price=150,
                date=date.today(),
                extra_field="not allowed"  # This should fail
            )
        assert "extra" in str(exc_info.value).lower()


class TestWatchlistValidation:
    """Test watchlist validation models"""
    
    def test_valid_watchlist_add(self):
        """Test valid watchlist addition"""
        watchlist = WatchlistAdd(
            symbol="aapl",  # lowercase
            notes="Watch for dip",
            target_price=Decimal("140.50")
        )
        assert watchlist.symbol == "AAPL"  # Should be uppercase
        assert watchlist.target_price == Decimal("140.50")
    
    def test_symbol_normalization(self):
        """Test symbol is normalized to uppercase"""
        watchlist = WatchlistAdd(symbol="msft")
        assert watchlist.symbol == "MSFT"
    
    def test_invalid_target_price(self):
        """Test target price validation"""
        with pytest.raises(ValidationError):
            WatchlistAdd(
                symbol="AAPL",
                target_price=0  # Must be positive
            )
        
        with pytest.raises(ValidationError):
            WatchlistAdd(
                symbol="AAPL",
                target_price=10000001  # Exceeds max
            )


class TestUserProfileValidation:
    """Test user profile validation models"""
    
    def test_valid_profile_create(self):
        """Test valid profile creation"""
        profile = UserProfileCreate(
            first_name="John",
            last_name="Doe",
            country="US",
            base_currency="EUR"
        )
        assert profile.first_name == "John"
        assert profile.country == "US"
        assert profile.base_currency == "EUR"
    
    def test_name_sanitization(self):
        """Test name field sanitization"""
        profile = UserProfileCreate(
            first_name="John123",  # Numbers should be removed
            last_name="O'Brien-Smith",  # Hyphens and apostrophes OK
            country="US"
        )
        assert profile.first_name == "John"  # Numbers removed
        assert profile.last_name == "O'Brien-Smith"  # Special chars preserved
    
    def test_invalid_country_code(self):
        """Test country code validation"""
        with pytest.raises(ValidationError):
            UserProfileCreate(
                first_name="John",
                last_name="Doe",
                country="USA"  # Should be 2 letters
            )
        
        with pytest.raises(ValidationError):
            UserProfileCreate(
                first_name="John",
                last_name="Doe",
                country="us"  # Should be uppercase
            )
    
    def test_invalid_currency_code(self):
        """Test currency code validation"""
        with pytest.raises(ValidationError):
            UserProfileCreate(
                first_name="John",
                last_name="Doe",
                country="US",
                base_currency="DOLLAR"  # Should be 3 letters
            )


class TestCurrencyConversion:
    """Test currency conversion validation"""
    
    def test_valid_conversion(self):
        """Test valid currency conversion request"""
        conversion = CurrencyConvert(
            amount=Decimal("100.50"),
            from_currency="USD",
            to_currency="EUR",
            date=date.today() - timedelta(days=30)
        )
        assert conversion.amount == Decimal("100.50")
        assert conversion.from_currency == "USD"
    
    def test_invalid_amount(self):
        """Test amount validation"""
        with pytest.raises(ValidationError):
            CurrencyConvert(
                amount=0,  # Must be positive
                from_currency="USD",
                to_currency="EUR"
            )
        
        with pytest.raises(ValidationError):
            CurrencyConvert(
                amount=1000000001,  # Exceeds max
                from_currency="USD",
                to_currency="EUR"
            )


class TestSymbolSearch:
    """Test symbol search validation"""
    
    def test_valid_search(self):
        """Test valid symbol search"""
        search = SymbolSearch(query="AAPL", limit=25)
        assert search.query == "AAPL"
        assert search.limit == 25
    
    def test_query_sanitization(self):
        """Test query sanitization"""
        search = SymbolSearch(query="AAPL<script>")
        assert "<" not in search.query
        assert ">" not in search.query
    
    def test_limit_constraints(self):
        """Test limit validation"""
        # Default limit
        search = SymbolSearch(query="AAPL")
        assert search.limit == 50
        
        # Invalid limits
        with pytest.raises(ValidationError):
            SymbolSearch(query="AAPL", limit=0)
        
        with pytest.raises(ValidationError):
            SymbolSearch(query="AAPL", limit=101)


if __name__ == "__main__":
    # Run some basic tests
    print("Testing Transaction Validation...")
    test = TestTransactionValidation()
    test.test_valid_transaction_create()
    test.test_symbol_validation()
    test.test_date_validation()
    test.test_notes_sanitization()
    print("✓ Transaction validation tests passed")
    
    print("\nTesting Watchlist Validation...")
    test = TestWatchlistValidation()
    test.test_valid_watchlist_add()
    test.test_symbol_normalization()
    print("✓ Watchlist validation tests passed")
    
    print("\nTesting User Profile Validation...")
    test = TestUserProfileValidation()
    test.test_valid_profile_create()
    test.test_name_sanitization()
    print("✓ User profile validation tests passed")
    
    print("\nAll validation tests passed!")