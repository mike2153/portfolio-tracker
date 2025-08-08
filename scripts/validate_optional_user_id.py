#!/usr/bin/env python3
"""
Validation script to detect Optional[str] user_id patterns in the codebase.
This violates CLAUDE.md guidelines - user_id should NEVER be Optional.
"""
import os
import re
import sys
from pathlib import Path
from typing import List, Tuple

def find_optional_user_id_violations() -> List[Tuple[str, int, str]]:
    """
    Find all instances of Optional[str] user_id in Python files.
    
    Returns:
        List of (filepath, line_number, line_content) tuples
    """
    violations = []
    
    # Patterns to detect Optional user_id
    patterns = [
        r'Optional\[str\].*user_id',  # Optional[str] before user_id
        r'user_id:\s*Optional\[str\]',  # user_id: Optional[str]
        r'user_id\s*=\s*None(?!\s*#)',  # user_id = None (not in comment)
        r'user_id:\s*str\s*=\s*""',  # user_id: str = "" (empty string default)
    ]
    
    # Find all Python files in backend directory
    backend_path = Path(__file__).parent.parent / "backend"
    
    for py_file in backend_path.rglob("*.py"):
        # Skip __pycache__ directories
        if "__pycache__" in str(py_file):
            continue
            
        try:
            with open(py_file, 'r', encoding='utf-8') as f:
                lines = f.readlines()
                
            for line_num, line in enumerate(lines, 1):
                for pattern in patterns:
                    if re.search(pattern, line):
                        # Skip if it's in a comment
                        if line.strip().startswith('#'):
                            continue
                        
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
    print("CLAUDE.md Compliance Check: Optional user_id Detection")
    print("=" * 60)
    print()
    
    violations = find_optional_user_id_violations()
    
    if not violations:
        print("[SUCCESS] No Optional user_id violations found!")
        print()
        print("All user_id parameters are properly typed as required strings.")
        return 0
    
    print(f"[FAILED] Found {len(violations)} violation(s):")
    print()
    
    for filepath, line_num, line_content in violations:
        print(f"  File: {filepath}:{line_num}")
        print(f"  Line: {line_content}")
        print()
    
    print("=" * 60)
    print("REQUIRED FIXES:")
    print("1. Remove Optional from user_id type hints")
    print("2. Never use None or empty string as default for user_id")
    print("3. Use extract_user_credentials() for auth data extraction")
    print("4. Validate user_id is non-empty string at API boundaries")
    print("=" * 60)
    
    return 1

if __name__ == "__main__":
    sys.exit(main())