#!/usr/bin/env python3
"""
Validation script to detect float() conversions of financial data.
According to CLAUDE.md, all financial calculations must use Decimal type.
"""
import os
import re
import sys
from pathlib import Path
from typing import List, Tuple

def find_float_conversion_violations() -> List[Tuple[str, int, str]]:
    """
    Find all instances of float() conversions on financial data.
    
    Returns:
        List of (filepath, line_number, line_content) tuples
    """
    violations = []
    
    # Financial-related keywords that should use Decimal
    financial_keywords = [
        'price', 'cost', 'value', 'amount', 'total', 'fee', 'commission',
        'dividend', 'gain', 'loss', 'balance', 'quantity', 'shares',
        'volume', 'open', 'high', 'low', 'close', 'avg_cost', 'current_value',
        'total_cost', 'gain_loss', 'market_cap', 'revenue', 'earnings'
    ]
    
    # Create pattern to match float() with financial terms
    keyword_pattern = '|'.join(financial_keywords)
    patterns = [
        rf'float\s*\([^)]*({keyword_pattern})[^)]*\)',  # float(something_with_price)
        rf'float\s*\([^)]*\[[\'"]*({keyword_pattern})[\'"\]]*\)',  # float(data["price"])
        rf'({keyword_pattern})[^=]*=.*float\s*\(',  # price = float(...)
    ]
    
    # Find all Python files in backend directory
    backend_path = Path(__file__).parent.parent / "backend"
    
    for py_file in backend_path.rglob("*.py"):
        # Skip __pycache__ directories
        if "__pycache__" in str(py_file):
            continue
        
        # Skip test files (they might have test-specific float usage)
        if "test" in py_file.name.lower():
            continue
            
        try:
            with open(py_file, 'r', encoding='utf-8') as f:
                lines = f.readlines()
                
            for line_num, line in enumerate(lines, 1):
                # Skip comments
                if line.strip().startswith('#'):
                    continue
                
                # Check for float() conversions with financial terms
                for pattern in patterns:
                    if re.search(pattern, line, re.IGNORECASE):
                        # Skip if it's for JSON serialization (common exception)
                        if 'json' in line.lower() or 'serialize' in line.lower():
                            # Still flag it but note it might be for serialization
                            violations.append((
                                str(py_file.relative_to(Path(__file__).parent.parent)),
                                line_num,
                                line.strip() + " [POSSIBLE JSON SERIALIZATION]"
                            ))
                        else:
                            violations.append((
                                str(py_file.relative_to(Path(__file__).parent.parent)),
                                line_num,
                                line.strip()
                            ))
                        break
        except Exception as e:
            print(f"Error reading {py_file}: {e}", file=sys.stderr)
    
    return violations

def main():
    """Main entry point for the validation script."""
    print("=" * 60)
    print("CLAUDE.md Compliance Check: Float Conversion Detection")
    print("=" * 60)
    print()
    
    violations = find_float_conversion_violations()
    
    if not violations:
        print("[SUCCESS] No inappropriate float() conversions found!")
        print()
        print("All financial data uses Decimal type as required.")
        return 0
    
    print(f"[WARNING] Found {len(violations)} potential violation(s):")
    print()
    
    json_related = 0
    for filepath, line_num, line_content in violations:
        print(f"  File: {filepath}:{line_num}")
        print(f"  Line: {line_content}")
        if "[POSSIBLE JSON SERIALIZATION]" in line_content:
            json_related += 1
            print("  Note: May be for JSON serialization - use str() instead")
        print()
    
    print("=" * 60)
    print("REQUIRED FIXES:")
    print("1. Use Decimal type for all financial calculations")
    print("2. Import: from decimal import Decimal")
    print("3. Convert: Decimal(str(value)) instead of float(value)")
    print("4. For JSON serialization: use str(decimal_value)")
    print("5. Use utils.financial_math helpers: safe_decimal(), safe_divide()")
    print("=" * 60)
    
    if json_related > 0:
        print(f"\nNote: {json_related} violations appear to be for JSON serialization.")
        print("Consider using str() instead of float() for Decimal -> JSON conversion.")
    
    # Return 1 only if there are non-JSON related violations
    return 1 if (len(violations) - json_related) > 0 else 0

if __name__ == "__main__":
    sys.exit(main())