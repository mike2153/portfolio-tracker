# Decimal Handling in Portfolio Tracker

## Overview
This document explains our approach to handling financial calculations with proper precision.

## Key Principles

1. **Always use Decimal for calculations**
   - All financial computations use Python's `Decimal` type
   - This prevents floating-point precision errors
   - Example: `Decimal('0.1') + Decimal('0.2') == Decimal('0.3')` (correct)
   - vs: `0.1 + 0.2 == 0.30000000000000004` (float error)

2. **Convert to float ONLY for JSON serialization**
   - JSON doesn't support Decimal type
   - We convert at the API response boundary only
   - Pattern: Calculate with Decimal → Convert to float → Return JSON

## Code Patterns

### Correct Pattern ✅
```python
# Calculate with Decimal
price_decimal = Decimal(str(data['price']))
quantity_decimal = Decimal(str(data['quantity']))
total_decimal = price_decimal * quantity_decimal

# Convert only for JSON response
response = {
    'price': float(price_decimal),
    'quantity': float(quantity_decimal),
    'total': float(total_decimal)
}
```

### Incorrect Pattern ❌
```python
# Don't use float for calculations
price = float(data['price'])
quantity = float(data['quantity'])
total = price * quantity  # Precision loss!
```

## Security Scanner False Positives

The security scanner flags all `float()` calls as violations, but these are false positives when:

1. Converting Decimal to float for JSON serialization
2. Using helper functions like `_safe_float_conversion()`
3. Converting at API response boundaries

## Helper Functions

We use these safe conversion helpers:
- `_safe_decimal_conversion()` - String/float → Decimal
- `_safe_decimal_to_float()` - Decimal → float (for JSON)
- `_safe_float_conversion()` - Any → float (with Decimal intermediate)

These functions handle edge cases and log warnings for data issues.