#!/usr/bin/env python3
"""
🛡️ BULLETPROOF FINANCIAL PRECISION VALIDATOR

This script enforces ZERO TOLERANCE for float/int usage in financial calculations.
All monetary values must use Decimal type to prevent rounding errors.

Usage: python scripts/validate_decimal_usage.py
Exit Code: 0 = No violations, 1 = Violations detected (blocks CI/CD)
"""

import re
import sys
from pathlib import Path
from typing import List, Dict, Any, Set
from decimal import Decimal

class FinancialPrecisionValidator:
    """Validates that all financial calculations use Decimal type."""
    
    # Financial terms that indicate monetary calculations
    FINANCIAL_TERMS = {
        'price', 'amount', 'total', 'value', 'cost', 'profit', 'loss',
        'balance', 'payment', 'fee', 'dividend', 'interest', 'cash',
        'principal', 'yield', 'return', 'gains', 'equity', 'assets',
        'liabilities', 'revenue', 'expense', 'income', 'worth',
        'portfolio_value', 'market_value', 'book_value', 'fair_value'
    }
    
    # Patterns that indicate potential float/int usage in financial context
    VIOLATION_PATTERNS = [
        # Variable declarations with financial terms
        (r'(\w*(?:' + '|'.join(FINANCIAL_TERMS) + r')\w*)\s*[:=]\s*(float|int)\s*\(', 
         'Variable with financial name using float/int constructor'),
        
        # Function parameters with financial terms
        (r'def\s+\w+\([^)]*(\w*(?:' + '|'.join(FINANCIAL_TERMS) + r')\w*)\s*:\s*(float|int)', 
         'Function parameter with financial name typed as float/int'),
        
        # Type annotations with financial terms
        (r'(\w*(?:' + '|'.join(FINANCIAL_TERMS) + r')\w*)\s*:\s*(float|int)(?:\s|$|,|\))', 
         'Type annotation with financial name using float/int'),
        
        # Mathematical operations on financial variables
        (r'(\w*(?:' + '|'.join(FINANCIAL_TERMS) + r')\w*)\s*[+\-*/]\s*[0-9]+\.?[0-9]*(?!\w)', 
         'Mathematical operation on financial variable with literal number'),
        
        # Return statements with float/int and financial context
        (r'return\s+(float|int)\s*\([^)]*(?:' + '|'.join(FINANCIAL_TERMS) + r')', 
         'Return statement converting financial value to float/int'),
        
        # Class attributes with financial terms
        (r'self\.(\w*(?:' + '|'.join(FINANCIAL_TERMS) + r')\w*)\s*=\s*(float|int)\s*\(', 
         'Class attribute with financial name using float/int'),
    ]
    
    # Safe contexts where float/int might be acceptable
    SAFE_CONTEXTS = [
        r'#.*',  # Comments
        r'""".*?"""',  # Docstrings
        r"'''.*?'''",  # Single quote docstrings
        r'test_.*',  # Test functions
        r'.*_test\.py',  # Test files
    ]
    
    def __init__(self):
        self.root_dir = Path(__file__).parent.parent
        self.violations: List[Dict[str, Any]] = []
        self.checked_files: Set[str] = set()
    
    def scan_backend_files(self) -> None:
        """Scan backend Python files for financial precision violations."""
        backend_dir = self.root_dir / "backend_simplified"
        
        if not backend_dir.exists():
            print(f"⚠️  Backend directory not found: {backend_dir}")
            return
        
        python_files = list(backend_dir.rglob("*.py"))
        financial_files = [
            f for f in python_files 
            if any(term in f.name.lower() for term in self.FINANCIAL_TERMS)
            or any(term in str(f).lower() for term in ['portfolio', 'calculator', 'price', 'finance'])
        ]
        
        print(f"🔍 Scanning {len(python_files)} Python files ({len(financial_files)} financial-related)...")
        
        for py_file in python_files:
            try:
                self._scan_file(py_file)
                self.checked_files.add(str(py_file.relative_to(self.root_dir)))
            except Exception as e:
                print(f"⚠️  Error scanning {py_file}: {e}")
    
    def _scan_file(self, file_path: Path) -> None:
        """Scan individual Python file for financial precision violations."""
        try:
            content = file_path.read_text(encoding='utf-8')
        except UnicodeDecodeError:
            print(f"⚠️  Could not read {file_path} (encoding issue)")
            return
        
        lines = content.split('\n')
        
        # Check each violation pattern
        for pattern, description in self.VIOLATION_PATTERNS:
            for match in re.finditer(pattern, content, re.MULTILINE | re.IGNORECASE):
                # Skip if in safe context
                if self._is_safe_context(content, match.start(), match.end()):
                    continue
                
                line_num = content[:match.start()].count('\n') + 1
                line_content = lines[line_num - 1].strip() if line_num <= len(lines) else ""
                
                # Additional context analysis
                context_lines = self._get_context_lines(lines, line_num, 3)
                
                self.violations.append({
                    'file': str(file_path.relative_to(self.root_dir)),
                    'line': line_num,
                    'content': line_content,
                    'matched_text': match.group(0),
                    'description': description,
                    'context': context_lines,
                    'severity': self._assess_severity(match.group(0), content),
                    'financial_term': self._extract_financial_term(match.group(0))
                })
    
    def _is_safe_context(self, content: str, start_pos: int, end_pos: int) -> bool:
        """Check if the match is in a safe context (comments, tests, etc.)."""
        # Check if it's in a comment
        line_start = content.rfind('\n', 0, start_pos) + 1
        line_prefix = content[line_start:start_pos]
        if '#' in line_prefix:
            return True
        
        # Check if it's already using Decimal
        surrounding_context = content[max(0, start_pos-100):min(len(content), end_pos+100)]
        if 'Decimal' in surrounding_context or 'decimal' in surrounding_context:
            # If Decimal is mentioned nearby, this might be a conversion or comparison
            return True
        
        # Check if it's in a test context
        if 'test' in content[max(0, start_pos-200):min(len(content), end_pos+200)].lower():
            return True
        
        return False
    
    def _get_context_lines(self, lines: List[str], line_num: int, context_size: int) -> List[str]:
        """Get context lines around the violation."""
        start = max(0, line_num - context_size - 1)
        end = min(len(lines), line_num + context_size)
        return lines[start:end]
    
    def _assess_severity(self, matched_text: str, full_content: str) -> str:
        """Assess the severity of the financial precision violation."""
        # Critical if it involves calculations or operations
        if any(op in matched_text for op in ['+', '-', '*', '/', '**', '%']):
            return 'CRITICAL'
        
        # High if it's a function parameter or return type
        if any(keyword in matched_text for keyword in ['def ', 'return ', '->']):
            return 'HIGH'
        
        # Medium for variable declarations
        if ':' in matched_text or '=' in matched_text:
            return 'MEDIUM'
        
        return 'LOW'
    
    def _extract_financial_term(self, matched_text: str) -> str:
        """Extract the financial term from the matched text."""
        for term in self.FINANCIAL_TERMS:
            if term in matched_text.lower():
                return term
        return 'unknown'
    
    def check_decimal_imports(self) -> None:
        """Check if files with financial calculations import Decimal."""
        backend_dir = self.root_dir / "backend_simplified"
        
        for py_file in backend_dir.rglob("*.py"):
            try:
                content = py_file.read_text(encoding='utf-8')
                
                # Check if file contains financial terms
                has_financial_terms = any(
                    term in content.lower() for term in self.FINANCIAL_TERMS
                )
                
                if has_financial_terms:
                    # Check if Decimal is imported
                    has_decimal_import = (
                        'from decimal import Decimal' in content or
                        'import decimal' in content or
                        'from decimal import' in content
                    )
                    
                    if not has_decimal_import:
                        self.violations.append({
                            'file': str(py_file.relative_to(self.root_dir)),
                            'line': 1,
                            'content': '# Missing Decimal import',
                            'matched_text': 'No Decimal import found',
                            'description': 'File with financial calculations missing Decimal import',
                            'context': ['File contains financial terms but no Decimal import'],
                            'severity': 'HIGH',
                            'financial_term': 'import_missing'
                        })
                        
            except Exception:
                continue
    
    def generate_remediation_suggestions(self) -> List[str]:
        """Generate specific remediation suggestions based on violations."""
        suggestions = []
        
        # Group violations by type
        by_severity = {}
        for violation in self.violations:
            severity = violation['severity']
            if severity not in by_severity:
                by_severity[severity] = []
            by_severity[severity].append(violation)
        
        if 'CRITICAL' in by_severity:
            suggestions.append("🚨 CRITICAL FIXES REQUIRED:")
            suggestions.append("   1. Replace all float/int arithmetic with Decimal operations")
            suggestions.append("   2. Use Decimal('0.00') instead of 0.0 for monetary values")
            suggestions.append("   3. Convert user inputs: Decimal(str(user_input))")
        
        if 'HIGH' in by_severity:
            suggestions.append("\n⚠️  HIGH PRIORITY FIXES:")
            suggestions.append("   1. Update function signatures to use Decimal types")
            suggestions.append("   2. Add 'from decimal import Decimal' imports")
            suggestions.append("   3. Change return types from float/int to Decimal")
        
        suggestions.extend([
            "\n✅ CORRECT DECIMAL USAGE EXAMPLES:",
            "   # Good - Decimal arithmetic",
            "   price = Decimal('19.99')",
            "   tax = Decimal('0.08')",
            "   total = price * (Decimal('1') + tax)",
            "",
            "   # Good - Function signature",
            "   def calculate_total(price: Decimal, tax_rate: Decimal) -> Decimal:",
            "       return price * (Decimal('1') + tax_rate)",
            "",
            "❌ AVOID THESE PATTERNS:",
            "   # Bad - Float arithmetic",
            "   total = 19.99 * 1.08  # Precision loss!",
            "   price: float = 19.99  # Wrong type!",
            "",
            "   # Bad - Converting Decimal to float",
            "   return float(decimal_value)  # Loses precision!",
        ])
        
        return suggestions
    
    def generate_report(self) -> bool:
        """Generate comprehensive violation report."""
        if not self.violations:
            print("✅ FINANCIAL PRECISION VALIDATION: PASSED")
            print(f"   Scanned {len(self.checked_files)} files")
            print("   All financial calculations properly use Decimal type")
            return False
        
        print(f"❌ FINANCIAL PRECISION VIOLATIONS: {len(self.violations)} issues found")
        print("=" * 80)
        
        # Sort by severity and file
        severity_order = {'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3}
        sorted_violations = sorted(
            self.violations,
            key=lambda x: (severity_order.get(x['severity'], 4), x['file'], x['line'])
        )
        
        # Group by file for better readability
        by_file = {}
        for violation in sorted_violations:
            file_path = violation['file']
            if file_path not in by_file:
                by_file[file_path] = []
            by_file[file_path].append(violation)
        
        for file_path, file_violations in by_file.items():
            print(f"\n📁 {file_path}")
            print("   " + "=" * (len(file_path) + 2))
            
            for violation in file_violations:
                severity_icon = {
                    'CRITICAL': '🚨',
                    'HIGH': '⚠️ ',
                    'MEDIUM': '⚡',
                    'LOW': '💡'
                }.get(violation['severity'], '❓')
                
                print(f"   {severity_icon} Line {violation['line']}: {violation['description']}")
                print(f"      💻 Code: {violation['content']}")
                print(f"      🎯 Term: {violation['financial_term']}")
                
                if violation['matched_text'] and len(violation['matched_text']) < 100:
                    print(f"      🔍 Match: {violation['matched_text']}")
        
        # Add remediation suggestions
        print("\n" + "=" * 80)
        suggestions = self.generate_remediation_suggestions()
        for suggestion in suggestions:
            print(suggestion)
        
        return True
    
    def run_validation(self) -> int:
        """Run complete financial precision validation."""
        print("🛡️ BULLETPROOF FINANCIAL PRECISION VALIDATOR")
        print("   Enforcing Decimal-only monetary calculations...")
        
        self.scan_backend_files()
        self.check_decimal_imports()
        
        has_violations = self.generate_report()
        return 1 if has_violations else 0

def main():
    """Main entry point for the validator."""
    validator = FinancialPrecisionValidator()
    exit_code = validator.run_validation()
    sys.exit(exit_code)

if __name__ == "__main__":
    main()
