"""
Refactored Dividend Service - Pure calculation and business logic
No direct database or API calls - all data passed as parameters
"""
import logging
from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional, Tuple
from decimal import Decimal

logger = logging.getLogger(__name__)

class DividendServiceRefactored:
    """
    Refactored service for dividend calculations and business logic.
    All data is passed as parameters - no direct database or API access.
    """
    
    def calculate_dividend_summary(
        self,
        user_dividends: List[Dict[str, Any]],
        current_year: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Calculate dividend summary from provided dividend data.
        Pure function - no database access.
        """
        if current_year is None:
            current_year = datetime.now().year
        
        # Initialize summary
        summary = {
            "total_dividends": 0.0,
            "total_dividends_ytd": 0.0,
            "confirmed_count": 0,
            "pending_count": 0,
            "by_symbol": {},
            "by_month": {},
            "monthly_trend": []
        }
        
        # Process each dividend
        for div in user_dividends:
            amount = float(div.get("total_amount", 0))
            symbol = div.get("symbol", "")
            status = div.get("status", "pending")
            pay_date_str = div.get("pay_date", "")
            
            # Parse pay date
            try:
                pay_date = datetime.strptime(pay_date_str, "%Y-%m-%d").date()
            except (ValueError, TypeError):
                continue
            
            # Count by status
            if status == "confirmed":
                summary["confirmed_count"] += 1
                summary["total_dividends"] += amount
                
                # Check if YTD
                if pay_date.year == current_year:
                    summary["total_dividends_ytd"] += amount
                
                # Group by symbol
                if symbol not in summary["by_symbol"]:
                    summary["by_symbol"][symbol] = {
                        "total": 0.0,
                        "count": 0,
                        "dividends": []
                    }
                
                summary["by_symbol"][symbol]["total"] += amount
                summary["by_symbol"][symbol]["count"] += 1
                summary["by_symbol"][symbol]["dividends"].append({
                    "pay_date": pay_date_str,
                    "amount": amount,
                    "shares_held": div.get("shares_held", 0)
                })
                
                # Group by month
                month_key = pay_date.strftime("%Y-%m")
                if month_key not in summary["by_month"]:
                    summary["by_month"][month_key] = 0.0
                summary["by_month"][month_key] += amount
            
            elif status == "pending":
                summary["pending_count"] += 1
        
        # Create monthly trend
        months = sorted(summary["by_month"].keys())
        summary["monthly_trend"] = [
            {"month": month, "amount": summary["by_month"][month]}
            for month in months
        ]
        
        return summary
    
    def calculate_shares_owned_at_date(
        self,
        transactions: List[Dict[str, Any]],
        symbol: str,
        target_date: date
    ) -> float:
        """
        Calculate shares owned at a specific date based on transaction history.
        Pure function - uses provided transaction data.
        """
        shares_owned = 0.0
        
        for txn in transactions:
            # Skip if different symbol
            if txn.get("symbol") != symbol:
                continue
            
            # Parse transaction date
            try:
                txn_date = datetime.strptime(
                    txn.get("date", ""), "%Y-%m-%d"
                ).date()
            except (ValueError, TypeError):
                continue
            
            # Only count transactions up to target date
            if txn_date > target_date:
                continue
            
            # Update shares based on transaction type
            txn_type = txn.get("type", "").upper()
            shares = float(txn.get("shares", 0))
            
            if txn_type == "BUY":
                shares_owned += shares
            elif txn_type == "SELL":
                shares_owned -= shares
        
        return max(0.0, shares_owned)
    
    def validate_dividend_data(
        self,
        dividend: Dict[str, Any],
        symbol: str
    ) -> Dict[str, Any]:
        """
        Validate dividend data and return validation result.
        Pure function - no external dependencies.
        """
        errors = []
        warnings = []
        
        # Required fields validation
        if not dividend.get("ex_date"):
            errors.append("Missing ex_date")
        
        if not dividend.get("amount"):
            errors.append("Missing amount")
        elif not isinstance(dividend["amount"], (int, float)) or dividend["amount"] <= 0:
            errors.append(f"Invalid amount: {dividend['amount']}")
        
        # Date validation
        if dividend.get("ex_date"):
            try:
                ex_date = datetime.strptime(dividend["ex_date"], "%Y-%m-%d").date()
                today = date.today()
                
                # Check date reasonability
                if ex_date > today + timedelta(days=365):
                    warnings.append(f"Ex-date too far in future: {ex_date}")
                elif ex_date < today - timedelta(days=365*10):
                    warnings.append(f"Ex-date too far in past: {ex_date}")
            except ValueError:
                errors.append(f"Invalid date format: {dividend.get('ex_date')}")
        
        # Payment date validation
        if dividend.get("pay_date"):
            try:
                pay_date = datetime.strptime(dividend["pay_date"], "%Y-%m-%d").date()
                if dividend.get("ex_date"):
                    ex_date = datetime.strptime(dividend["ex_date"], "%Y-%m-%d").date()
                    if pay_date < ex_date:
                        warnings.append("Payment date is before ex-date")
            except ValueError:
                errors.append(f"Invalid payment date format: {dividend.get('pay_date')}")
        
        # Currency validation
        valid_currencies = ["USD", "EUR", "GBP", "CAD", "JPY", "CHF", "AUD"]
        currency = dividend.get("currency", "USD")
        if currency not in valid_currencies:
            warnings.append(f"Unsupported currency: {currency}")
        
        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
            "symbol": symbol
        }
    
    def calculate_dividend_eligibility(
        self,
        transactions: List[Dict[str, Any]],
        dividends: List[Dict[str, Any]],
        symbol: str
    ) -> List[Dict[str, Any]]:
        """
        Calculate which dividends a user is eligible for based on ownership.
        Returns list of eligible dividends with calculated amounts.
        """
        eligible_dividends = []
        
        for dividend in dividends:
            if dividend.get("symbol") != symbol:
                continue
            
            # Parse ex-date
            try:
                ex_date = datetime.strptime(
                    dividend.get("ex_date", ""), "%Y-%m-%d"
                ).date()
            except (ValueError, TypeError):
                continue
            
            # Calculate shares owned on ex-date
            shares_owned = self.calculate_shares_owned_at_date(
                transactions, symbol, ex_date
            )
            
            if shares_owned > 0:
                amount_per_share = float(dividend.get("amount", 0))
                total_amount = shares_owned * amount_per_share
                
                eligible_dividends.append({
                    "dividend_id": dividend.get("id"),
                    "symbol": symbol,
                    "ex_date": dividend.get("ex_date"),
                    "pay_date": dividend.get("pay_date"),
                    "amount_per_share": amount_per_share,
                    "shares_held": shares_owned,
                    "total_amount": total_amount,
                    "currency": dividend.get("currency", "USD"),
                    "status": "pending"
                })
        
        return eligible_dividends
    
    def prepare_dividend_confirmation(
        self,
        dividend: Dict[str, Any],
        edited_amount: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Prepare data for dividend confirmation.
        Returns the updates needed for confirmation.
        """
        updates = {
            "status": "confirmed",
            "confirmed_at": datetime.now().isoformat()
        }
        
        # Handle edited amount if provided
        if edited_amount is not None and edited_amount > 0:
            original_amount = float(dividend.get("total_amount", 0))
            updates["total_amount"] = edited_amount
            updates["original_amount"] = original_amount
            updates["edited"] = True
        
        return {
            "dividend_id": dividend.get("id"),
            "updates": updates,
            "transaction_data": {
                "type": "DIVIDEND",
                "symbol": dividend.get("symbol"),
                "date": dividend.get("pay_date"),
                "shares": 0,  # Dividends don't affect share count
                "price": 0,
                "amount": edited_amount or dividend.get("total_amount"),
                "notes": f"Dividend payment - {dividend.get('shares_held', 0)} shares @ ${dividend.get('amount_per_share', 0)}/share"
            }
        }
    
    def prepare_dividend_rejection(
        self,
        dividend: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Prepare data for dividend rejection.
        Returns the updates needed for rejection.
        """
        return {
            "dividend_id": dividend.get("id"),
            "updates": {
                "status": "rejected",
                "rejected_at": datetime.now().isoformat()
            }
        }
    
    def get_portfolio_symbols(
        self,
        transactions: List[Dict[str, Any]]
    ) -> List[str]:
        """
        Extract unique symbols from transaction history where user has current holdings.
        """
        symbol_holdings = {}
        
        for txn in transactions:
            symbol = txn.get("symbol", "").upper()
            if not symbol:
                continue
            
            txn_type = txn.get("type", "").upper()
            shares = float(txn.get("shares", 0))
            
            if symbol not in symbol_holdings:
                symbol_holdings[symbol] = 0.0
            
            if txn_type == "BUY":
                symbol_holdings[symbol] += shares
            elif txn_type == "SELL":
                symbol_holdings[symbol] -= shares
        
        # Return symbols with positive holdings
        return [
            symbol for symbol, holdings in symbol_holdings.items()
            if holdings > 0
        ]
    
    def get_first_transaction_date(
        self,
        transactions: List[Dict[str, Any]],
        symbol: str
    ) -> Optional[date]:
        """
        Get the date of the first transaction for a symbol.
        """
        symbol_transactions = [
            txn for txn in transactions
            if txn.get("symbol") == symbol and txn.get("type", "").upper() == "BUY"
        ]
        
        if not symbol_transactions:
            return None
        
        # Sort by date and get first
        try:
            sorted_txns = sorted(
                symbol_transactions,
                key=lambda x: datetime.strptime(x.get("date", ""), "%Y-%m-%d")
            )
            if sorted_txns:
                return datetime.strptime(
                    sorted_txns[0].get("date", ""), "%Y-%m-%d"
                ).date()
        except (ValueError, TypeError):
            pass
        
        return None
    
    def format_currency_amount(self, amount: float, currency: str) -> str:
        """Format amount with currency symbol."""
        currency_symbols = {
            "USD": "$",
            "EUR": "€",
            "GBP": "£",
            "CAD": "C$",
            "JPY": "¥",
            "CHF": "CHF",
            "AUD": "A$"
        }
        
        symbol = currency_symbols.get(currency, currency)
        return f"{symbol}{amount:,.2f}"