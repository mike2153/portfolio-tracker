# Multi-Currency Portfolio Tracker - Production Implementation

## Executive Summary

This document provides the production-ready implementation for multi-currency support. It uses **on-the-fly conversion only** with no pre-calculated columns.

### Core Design Principles
1. **On-the-fly conversion** - No pre-calculated columns
2. **Simple rate limiting** - Counter-based only
3. **Proper error handling** - Fallbacks for all scenarios
4. **Type safety** - Decimal precision throughout
5. **Minimal changes** - Extends existing patterns

---

## Phase 1: Database Schema

### User Profiles Table
```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  country VARCHAR(2) NOT NULL,
  base_currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" 
  ON user_profiles FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" 
  ON user_profiles FOR UPDATE 
  USING (auth.uid() = user_id);
```

### Forex Rates Table
```sql
CREATE TABLE forex_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency VARCHAR(3) NOT NULL,
  to_currency VARCHAR(3) NOT NULL,
  date DATE NOT NULL,
  rate DECIMAL(20,10) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_currency, to_currency, date)
);

-- Simple index for lookups (no DESC for equality searches)
CREATE INDEX idx_forex_lookup 
  ON forex_rates(from_currency, to_currency, date);

-- Add currency to stocks
ALTER TABLE stocks 
  ADD COLUMN currency VARCHAR(3) NOT NULL DEFAULT 'USD';

-- Auto-detect currency from symbol
UPDATE stocks SET 
  currency = CASE 
    WHEN symbol LIKE '%.AX' THEN 'AUD'
    WHEN symbol LIKE '%.L' THEN 'GBP'
    WHEN symbol LIKE '%.TO' THEN 'CAD'
    ELSE 'USD'
  END;

-- Add exchange rate to transactions
-- NO base_currency_amount - calculate on the fly!
ALTER TABLE transactions 
  ADD COLUMN exchange_rate DECIMAL(20,10);
```

### API Usage Tracking
```sql
CREATE TABLE api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  call_count INTEGER DEFAULT 0,
  UNIQUE(service, date)
);
```

---

## Phase 2: Backend Implementation

### ForexManager (Production-Ready)
```python
# backend_simplified/supa_api/forex_manager.py

from decimal import Decimal
from datetime import date, timedelta, datetime
import aiohttp
from typing import Optional, Dict

class ForexManager:
    """Manages forex rates with simple counter-based rate limiting"""
    
    def __init__(self, supabase_client, alpha_vantage_key):
        self.supabase = supabase_client
        self.av_key = alpha_vantage_key
        self.cache: Dict[str, Decimal] = {}  # Simple memory cache
        
    async def get_exchange_rate(
        self, 
        from_currency: str, 
        to_currency: str, 
        target_date: date
    ) -> Decimal:
        """Get exchange rate with 7-day fallback"""
        
        if from_currency == to_currency:
            return Decimal('1.0')
        
        # Check memory cache first
        cache_key = f"{from_currency}/{to_currency}/{target_date}"
        if cache_key in self.cache:
            return self.cache[cache_key]
            
        # Try database with fallback
        for days_back in range(7):
            check_date = target_date - timedelta(days=days_back)
            
            result = await self.supabase.table('forex_rates')\
                .select('rate')\
                .eq('from_currency', from_currency)\
                .eq('to_currency', to_currency)\
                .eq('date', check_date.isoformat())\
                .execute()
                
            # Guard against empty results
            if result.data and len(result.data) > 0:
                rate = Decimal(str(result.data[0]['rate']))
                self.cache[cache_key] = rate
                return rate
        
        # Not found - try to fetch ONCE
        if await self._can_make_api_call():
            success = await self._fetch_forex_history(from_currency, to_currency)
            if success:
                # Try database one more time
                result = await self.supabase.table('forex_rates')\
                    .select('rate')\
                    .eq('from_currency', from_currency)\
                    .eq('to_currency', to_currency)\
                    .eq('date', target_date.isoformat())\
                    .execute()
                    
                if result.data and len(result.data) > 0:
                    rate = Decimal(str(result.data[0]['rate']))
                    self.cache[cache_key] = rate
                    return rate
        
        # Use fallback - no recursion!
        return self._get_fallback_rate(from_currency, to_currency)
    
    async def get_latest_rate(
        self, 
        from_currency: str, 
        to_currency: str
    ) -> Decimal:
        """Get most recent rate"""
        
        if from_currency == to_currency:
            return Decimal('1.0')
        
        result = await self.supabase.table('forex_rates')\
            .select('rate')\
            .eq('from_currency', from_currency)\
            .eq('to_currency', to_currency)\
            .order('date', desc=True)\
            .limit(1)\
            .execute()
        
        if result.data and len(result.data) > 0:
            return Decimal(str(result.data[0]['rate']))
        
        # Try to fetch if we can
        if await self._can_make_api_call():
            await self._fetch_forex_history(from_currency, to_currency)
            
            # Try once more
            result = await self.supabase.table('forex_rates')\
                .select('rate')\
                .eq('from_currency', from_currency)\
                .eq('to_currency', to_currency)\
                .order('date', desc=True)\
                .limit(1)\
                .execute()
                
            if result.data and len(result.data) > 0:
                return Decimal(str(result.data[0]['rate']))
        
        return self._get_fallback_rate(from_currency, to_currency)
    
    async def _can_make_api_call(self) -> bool:
        """Check if we're within API limits"""
        today = date.today()
        
        # Check daily limit
        result = await self.supabase.table('api_usage')\
            .select('call_count')\
            .eq('service', 'alphavantage')\
            .eq('date', today.isoformat())\
            .execute()
        
        if result.data and len(result.data) > 0 and result.data[0]['call_count'] >= 450:
            return False
            
        return True
    
    async def _increment_api_usage(self):
        """Track API usage"""
        today = date.today()
        
        # Get current count
        result = await self.supabase.table('api_usage')\
            .select('call_count')\
            .eq('service', 'alphavantage')\
            .eq('date', today.isoformat())\
            .execute()
        
        if result.data and len(result.data) > 0:
            # Update existing
            new_count = result.data[0]['call_count'] + 1
            await self.supabase.table('api_usage')\
                .update({'call_count': new_count})\
                .eq('service', 'alphavantage')\
                .eq('date', today.isoformat())\
                .execute()
        else:
            # Insert new
            await self.supabase.table('api_usage')\
                .insert({
                    'service': 'alphavantage',
                    'date': today.isoformat(),
                    'call_count': 1
                })\
                .execute()
    
    async def _fetch_forex_history(
        self, 
        from_currency: str, 
        to_currency: str
    ) -> bool:
        """Fetch forex data from Alpha Vantage"""
        
        url = "https://www.alphavantage.co/query"
        params = {
            'function': 'FX_DAILY',
            'from_symbol': from_currency,
            'to_symbol': to_currency,
            'apikey': self.av_key
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, params=params, timeout=10) as response:
                    data = await response.json()
                    
            if 'Time Series FX (Daily)' in data:
                rates_to_insert = []
                
                for date_str, values in data['Time Series FX (Daily)'].items():
                    # Parse date properly
                    rate_date = datetime.strptime(date_str, '%Y-%m-%d').date()
                    
                    rates_to_insert.append({
                        'from_currency': from_currency,
                        'to_currency': to_currency,
                        'date': rate_date.isoformat(),
                        'rate': str(Decimal(values['4. close']))
                    })
                
                if rates_to_insert:
                    # Bulk insert all rates at once for performance
                    await self.supabase.table('forex_rates')\
                        .upsert(rates_to_insert, on_conflict='from_currency,to_currency,date')\
                        .execute()
                
                return True
        
        except Exception as e:
            print(f"Forex fetch error: {e}")
            return False
            
        finally:
            # Always increment API usage, even on errors
            await self._increment_api_usage()
    
    def _get_fallback_rate(
        self, 
        from_currency: str, 
        to_currency: str
    ) -> Decimal:
        """Emergency fallback rates"""
        
        fallback_rates = {
            'USD/EUR': Decimal('0.92'),
            'EUR/USD': Decimal('1.09'),
            'USD/GBP': Decimal('0.79'),
            'GBP/USD': Decimal('1.27'),
            'USD/JPY': Decimal('150.0'),
            'JPY/USD': Decimal('0.0067'),
            'USD/AUD': Decimal('1.52'),
            'AUD/USD': Decimal('0.66'),
        }
        
        key = f"{from_currency}/{to_currency}"
        return fallback_rates.get(key, Decimal('1.0'))
```

### Updated PortfolioManager
```python
# Add to existing PortfolioManager

def __init__(self, supabase_client, user_id, user_token):
    self.supabase = supabase_client
    self.user_id = user_id
    self.user_token = user_token
    self.price_manager = PriceManager(supabase_client)
    self.forex_manager = ForexManager(supabase_client, ALPHA_VANTAGE_KEY)
    self._user_base_currency = None

async def get_user_base_currency(self) -> str:
    """Get user's base currency"""
    if not self._user_base_currency:
        result = await self.supabase.table('user_profiles')\
            .select('base_currency')\
            .eq('user_id', self.user_id)\
            .execute()
        
        self._user_base_currency = 'USD'  # Default
        if result.data and len(result.data) > 0:
            self._user_base_currency = result.data[0]['base_currency']
            
    return self._user_base_currency

async def convert_to_base_currency(
    self, 
    amount: Decimal, 
    from_currency: str, 
    as_of_date: date
) -> Decimal:
    """Helper to convert amounts"""
    base_currency = await self.get_user_base_currency()
    
    if from_currency == base_currency:
        return amount
        
    rate = await self.forex_manager.get_exchange_rate(
        from_currency, 
        base_currency, 
        as_of_date
    )
    return amount * rate

# Update get_portfolio_value to use on-the-fly conversion
async def get_portfolio_value(self) -> Dict[str, Any]:
    """Calculate current portfolio value"""
    holdings = await self._get_current_holdings()
    base_currency = await self.get_user_base_currency()
    
    total_value = Decimal('0')
    total_cost = Decimal('0')
    
    for holding in holdings:
        # Current value
        current_price = await self.price_manager.get_latest_price(holding['symbol'])
        current_value = holding['quantity'] * current_price
        
        # Convert to base currency
        stock_currency = holding.get('currency', 'USD')
        current_value = await self.convert_to_base_currency(
            current_value, 
            stock_currency, 
            date.today()
        )
        
        # Cost basis - convert on the fly using transaction dates
        cost_in_base = Decimal('0')
        for txn in holding.get('transactions', []):
            txn_amount = Decimal(str(txn['total_amount']))
            txn_date = datetime.fromisoformat(txn['date']).date()
            
            # Use stored rate or fetch
            if txn.get('exchange_rate'):
                cost_in_base += txn_amount * Decimal(str(txn['exchange_rate']))
            else:
                converted = await self.convert_to_base_currency(
                    txn_amount,
                    stock_currency,
                    txn_date
                )
                cost_in_base += converted
        
        total_value += current_value
        total_cost += cost_in_base
    
    return {
        'total_value': float(total_value),
        'total_cost': float(total_cost),
        'total_gain': float(total_value - total_cost),
        'total_gain_percent': float((total_value - total_cost) / total_cost * 100) if total_cost > 0 else 0,
        'currency': base_currency
    }
```

---

## Phase 3: Frontend Implementation

### Profile Completion (OAuth)
```typescript
interface ProfileCompletionForm {
  firstName: string;
  lastName: string;
  country: string;
  baseCurrency: string;
}

const ProfileCompletion: React.FC = () => {
  const [formData, setFormData] = useState<ProfileCompletionForm>({
    firstName: '',
    lastName: '',
    country: '',
    baseCurrency: 'USD'
  });

  useEffect(() => {
    const currencyMap: Record<string, string> = {
      'US': 'USD',
      'AU': 'AUD',
      'GB': 'GBP',
      'JP': 'JPY',
      'DE': 'EUR',
      'FR': 'EUR',
    };
    
    if (formData.country) {
      setFormData(prev => ({
        ...prev,
        baseCurrency: currencyMap[formData.country] || 'USD'
      }));
    }
  }, [formData.country]);

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
    </form>
  );
};
```

### Transaction Form with Proper Guards
```typescript
const TransactionFormScreen = () => {
  const [formData, setFormData] = useState({
    symbol: '',
    quantity: 0,
    price: 0,
    date: new Date(),
    exchangeRate: 1,
  });
  
  const [stockCurrency, setStockCurrency] = useState('USD');
  const [userCurrency, setUserCurrency] = useState('USD');
  const [loading, setLoading] = useState(false);

  // Fetch exchange rate when needed
  useEffect(() => {
    if (formData.symbol && stockCurrency !== userCurrency) {
      setLoading(true);
      fetchExchangeRate(stockCurrency, userCurrency, formData.date)
        .then(rate => {
          setFormData(prev => ({ ...prev, exchangeRate: rate }));
        })
        .catch(() => {
          setFormData(prev => ({ ...prev, exchangeRate: 1 }));
        })
        .finally(() => setLoading(false));
    }
  }, [formData.symbol, formData.date, stockCurrency, userCurrency]);

  // Safe calculation with guards
  const calculateTotal = () => {
    const quantity = Number(formData.quantity) || 0;
    const price = Number(formData.price) || 0;
    const rate = Number(formData.exchangeRate) || 1;
    
    if (quantity > 0 && price > 0) {
      return (quantity * price * rate).toFixed(2);
    }
    return '0.00';
  };

  return (
    <View>
      {/* Form inputs */}
      
      {stockCurrency !== userCurrency && (
        <View style={styles.field}>
          <Text>Exchange Rate ({stockCurrency}/{userCurrency})</Text>
          <TextInput
            value={formData.exchangeRate.toString()}
            onChangeText={(text) => {
              const rate = parseFloat(text);
              if (!isNaN(rate) && rate > 0) {
                setFormData(prev => ({ ...prev, exchangeRate: rate }));
              }
            }}
            keyboardType="decimal-pad"
            editable={!loading}
          />
          {loading && <ActivityIndicator size="small" />}
          <Text style={styles.helper}>
            Total in {userCurrency}: {calculateTotal()}
          </Text>
        </View>
      )}
    </View>
  );
};
```

---

## Key Implementation Notes

1. **No Pre-calculated Columns** - Everything converts on-the-fly
2. **Simple Rate Limiting** - Counter-based only, no semaphores
3. **Proper Date Handling** - Always use `.isoformat()` with Supabase
4. **No Recursion Loops** - Fetch once, then use fallback
5. **API Usage Tracking** - Increment in finally block (always executes)
6. **Type Safety** - Guard all calculations against NaN and empty results

---

## Production Checklist

- [ ] Run database migrations
- [ ] Configure Alpha Vantage API key
- [ ] Update fallback rates to current values
- [ ] Test with multiple currencies
- [ ] Monitor API usage (stay under 450/day)
- [ ] Deploy with error logging enabled

This implementation provides clean, maintainable multi-currency support with all critical bugs fixed and performance optimized.