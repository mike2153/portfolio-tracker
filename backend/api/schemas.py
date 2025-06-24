from ninja import Schema
from typing import List, Optional
from datetime import date
from decimal import Decimal
from .models import Holding, Portfolio, CashContribution, PriceAlert

class HoldingSchema(Schema):
    ticker: str
    company_name: str
    exchange: Optional[str] = None
    shares: Decimal
    purchase_price: Decimal
    purchase_date: date
    commission: Decimal
    used_cash_balance: bool
    currency: str
    fx_rate: Decimal

class PortfolioSchema(Schema):
    holdings: List[HoldingSchema] = []

class CashContributionSchema(Schema):
    amount: Decimal
    contribution_date: date
    description: Optional[str] = None

class PriceAlertSchema(Schema):
    ticker: str
    alert_type: str  # 'above' | 'below'
    target_price: Decimal

class DividendConfirmationSchema(Schema):
    holding_id: int
    ex_date: date
    confirmed: bool 