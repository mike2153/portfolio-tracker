#!/usr/bin/env python3
"""
🛡️ BULLETPROOF SQL INJECTION PREVENTION

This script enforces ZERO TOLERANCE for raw SQL usage.
All database queries must use parameterized queries to prevent SQL injection.

Usage: python scripts/detect_raw_sql.py
Exit Code: 0 = No violations, 1 = Violations detected (blocks CI/CD)
"""

import re
import sys
from pathlib import Path
from typing import List, Dict, Any

class SQLInjectionDetector:
    """Detects raw SQL usage that could lead to SQL injection vulnerabilities."""
    
    # SQL keywords that indicate database operations
    SQL_KEYWORDS = [
        'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER',
        'TRUNCATE', 'GRANT', 'REVOKE', 'EXEC', 'EXECUTE', 'UNION', 'FROM',
        'WHERE', 'JOIN', 'ORDER BY', 'GROUP BY', 'HAVING'
    ]
    
    # Dangerous patterns that indicate raw SQL construction
    VIOLATION_PATTERNS = [
        # F-string with SQL keywords
        (r'f["\'].*?(?:' + '|'.join(SQL_KEYWORDS) + r').*?\{.*?\}.*?["\']', 
         'f-string with SQL and variables'),
        
        # String concatenation with SQL
        (r'["\'].*?(?:' + '|'.join(SQL_KEYWORDS) + r').*?["\'].*?\+.*?["\']', 
         'string concatenation with SQL'),
        
        # .format() with SQL
        (r'["\'].*?(?:' + '|'.join(SQL_KEYWORDS) + r').*?\{.*?\}.*?["\']\.format\(', 
         '.format() method with SQL placeholders'),
         
        # % formatting with SQL
        (r'["\'].*?(?:' + '|'.join(SQL_KEYWORDS) + r').*?%[sd].*?["\'].*?%', 
         '% string formatting with SQL'),
        
        # Direct variable insertion in SQL strings
        (r'["\'].*?(?:' + '|'.join(SQL_KEYWORDS) + r').*?["\'].*?\+.*?\w+', 
         'variable concatenation with SQL string'),
         
        # Multi-line SQL with variable injection
        (r'""".*?(?:' + '|'.join(SQL_KEYWORDS) + r').*?\{.*?\}.*?"""', 
         'multi-line SQL with f-string variables'),
    ]
    
    # Safe patterns that should NOT be flagged
    SAFE_PATTERNS = [
        r'#.*',  # Comments
        r'""".*?"""',  # Docstrings (when not containing variables)
        r"'''.*?'''",  # Single quote docstrings
        r'execute\([^)]*,\s*\([^)]*\)\)',  # Parameterized execute calls
        r'query\([^)]*,\s*\([^)]*\)\)',  # Parameterized query calls
    ]
    
    def __init__(self):
        self.root_dir = Path(__file__).parent.parent
        self.violations: List[Dict[str, Any]] = []
    
    def scan_python_files(self) -> None:
        """Scan all Python files for SQL injection vulnerabilities."""
        backend_dir = self.root_dir / "backend_simplified"
        
        if not backend_dir.exists():
            print(f"⚠️  Backend directory not found: {backend_dir}")
            return
        
        python_files = list(backend_dir.rglob("*.py"))
        print(f"🔍 Scanning {len(python_files)} Python files for raw SQL usage...")
        
        for py_file in python_files:
            try:
                self._scan_file(py_file)
            except Exception as e:
                print(f"⚠️  Error scanning {py_file}: {e}")
    
    def _scan_file(self, file_path: Path) -> None:
        """Scan individual Python file for SQL injection vulnerabilities."""
        try:
            content = file_path.read_text(encoding='utf-8')
        except UnicodeDecodeError:
            print(f"⚠️  Could not read {file_path} (encoding issue)")
            return
        
        lines = content.split('\n')
        
        # Check each violation pattern
        for pattern, description in self.VIOLATION_PATTERNS:
            for match in re.finditer(pattern, content, re.MULTILINE | re.IGNORECASE | re.DOTALL):
                # Skip if this matches a safe pattern
                if self._is_safe_context(content, match.start(), match.end()):
                    continue
                
                line_num = content[:match.start()].count('\n') + 1
                line_content = lines[line_num - 1].strip() if line_num <= len(lines) else ""
                
                # Get context around the match
                context_start = max(0, line_num - 2)
                context_end = min(len(lines), line_num + 2)
                context_lines = lines[context_start:context_end]
                
                self.violations.append({
                    'file': str(file_path.relative_to(self.root_dir)),
                    'line': line_num,
                    'content': line_content,
                    'matched_text': match.group(0)[:100] + ('...' if len(match.group(0)) > 100 else ''),
                    'description': description,
                    'context': context_lines,
                    'severity': self._assess_severity(match.group(0))
                })
    
    def _is_safe_context(self, content: str, start_pos: int, end_pos: int) -> bool:
        """Check if the matched pattern is in a safe context."""
        matched_text = content[start_pos:end_pos]
        
        # Check if it's in a comment
        line_start = content.rfind('\n', 0, start_pos) + 1
        line_prefix = content[line_start:start_pos]
        if '#' in line_prefix and line_prefix.index('#') < len(line_prefix.lstrip()):
            return True
        
        # Check if it's using parameterized queries (safe patterns)
        # Look for execute() or query() calls with tuple parameters
        if re.search(r'\.execute\s*\([^)]*,\s*[\(\[]', matched_text):
            return True
        
        if re.search(r'\.query\s*\([^)]*,\s*[\(\[]', matched_text):
            return True
        
        # Check if it's in a docstring or test
        if '"""' in matched_text or "'''" in matched_text:
            return True
        
        # Check if it's a test file (less strict)
        return False
    
    def _assess_severity(self, matched_text: str) -> str:
        """Assess the severity of the SQL injection risk."""
        if any(keyword in matched_text.upper() for keyword in ['DELETE', 'DROP', 'TRUNCATE', 'UPDATE']):
            return 'CRITICAL'
        elif 'INSERT' in matched_text.upper():
            return 'HIGH'
        elif 'SELECT' in matched_text.upper():
            return 'MEDIUM'
        else:
            return 'LOW'
    
    def check_supabase_client_usage(self) -> None:
        """Check for unsafe Supabase client usage patterns."""
        backend_dir = self.root_dir / "backend_simplified"
        
        # Patterns specific to Supabase that could be unsafe
        supabase_unsafe_patterns = [
            (r'\.rpc\(["\'][^"\']*\{.*?\}[^"\']*["\']', 'RPC call with variable injection'),
            (r'\.eq\(["\'][^"\']*\+', 'eq() filter with string concatenation'),
            (r'\.filter\(["\'][^"\']*\{.*?\}', 'filter with f-string variables'),
        ]
        
        for py_file in backend_dir.rglob("*.py"):
            try:
                content = py_file.read_text(encoding='utf-8')
                lines = content.split('\n')
                
                for pattern, description in supabase_unsafe_patterns:
                    for match in re.finditer(pattern, content, re.IGNORECASE):
                        line_num = content[:match.start()].count('\n') + 1
                        line_content = lines[line_num - 1].strip() if line_num <= len(lines) else ""
                        
                        self.violations.append({
                            'file': str(py_file.relative_to(self.root_dir)),
                            'line': line_num,
                            'content': line_content,
                            'matched_text': match.group(0),
                            'description': f'Supabase: {description}',
                            'context': [line_content],
                            'severity': 'HIGH'
                        })
                        
            except Exception:
                continue
    
    def generate_report(self) -> bool:
        """Generate vulnerability report and return True if violations found."""
        if not self.violations:
            print("✅ SQL INJECTION PREVENTION: PASSED")
            print("   No raw SQL usage detected - all queries appear parameterized")
            return False
        
        print(f"❌ SQL INJECTION VULNERABILITIES DETECTED: {len(self.violations)} issues")
        print("=" * 80)
        
        # Sort by severity
        severity_order = {'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3}
        sorted_violations = sorted(
            self.violations, 
            key=lambda x: (severity_order.get(x['severity'], 4), x['file'], x['line'])
        )
        
        for violation in sorted_violations:
            severity_icon = {
                'CRITICAL': '🚨',
                'HIGH': '⚠️ ',
                'MEDIUM': '⚡',
                'LOW': '💡'
            }.get(violation['severity'], '❓')
            
            print(f"\n{severity_icon} {violation['severity']} - {violation['file']}:{violation['line']}")
            print(f"   📝 {violation['description']}")
            print(f"   💻 Code: {violation['content']}")
            
            if len(violation['matched_text']) < 200:
                print(f"   🎯 Match: {violation['matched_text']}")
        
        print("\n" + "=" * 80)
        print("🛠️  REMEDIATION STEPS:")
        print("   1. Use parameterized queries with tuple/list parameters")
        print("   2. For Supabase: Use .eq('column', value) instead of f-strings")
        print("   3. For raw SQL: Use cursor.execute(query, (param1, param2))")
        print("   4. Never concatenate user input directly into SQL strings")
        print("   5. Use prepared statements for complex queries")
        
        print("\n✅ SAFE EXAMPLES:")
        print("   # Good - Parameterized")
        print("   cursor.execute('SELECT * FROM users WHERE id = %s', (user_id,))")
        print("   supabase.table('users').eq('id', user_id).execute()")
        print("   \n❌ UNSAFE EXAMPLES:")
        print("   # Bad - String concatenation")
        print("   f'SELECT * FROM users WHERE id = {user_id}'")
        print("   'SELECT * FROM users WHERE name = ' + username")
        
        return True
    
    def run_detection(self) -> int:
        """Run complete detection and return exit code."""
        print("🛡️ BULLETPROOF SQL INJECTION DETECTOR")
        print("   Scanning for raw SQL usage and injection vulnerabilities...")
        
        self.scan_python_files()
        self.check_supabase_client_usage()
        
        has_violations = self.generate_report()
        return 1 if has_violations else 0

def main():
    """Main entry point for the detector."""
    detector = SQLInjectionDetector()
    exit_code = detector.run_detection()
    sys.exit(exit_code)

if __name__ == "__main__":
    main()