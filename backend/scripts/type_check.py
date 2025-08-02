#!/usr/bin/env python3
"""
Comprehensive type checking script for the portfolio tracker backend.
Ensures zero type errors according to CLAUDE.md requirements.
"""
import subprocess
import sys
import os
from pathlib import Path

def run_mypy_check(directory: str) -> tuple[int, str, str]:
    """
    Run MyPy type checking on a directory.
    
    Args:
        directory: Path to check
        
    Returns:
        Tuple of (return_code, stdout, stderr)
    """
    try:
        result = subprocess.run([
            sys.executable, "-m", "mypy", 
            directory,
            "--config-file", "mypy.ini",
            "--show-error-codes",
            "--pretty"
        ], capture_output=True, text=True, cwd=Path(__file__).parent.parent)
        
        return result.returncode, result.stdout, result.stderr
        
    except FileNotFoundError:
        return 1, "", "MyPy not found. Install with: pip install mypy"

def check_critical_files() -> bool:
    """Check critical files for type safety."""
    backend_root = Path(__file__).parent.parent
    critical_files = [
        "services/portfolio_calculator.py",
        "services/portfolio_metrics_manager.py", 
        "services/cache_manager.py",
        "utils/financial_math.py",
        "utils/auth_helpers.py",
        "backend_api_routes/backend_api_portfolio.py"
    ]
    
    all_passed = True
    
    print("Checking critical files for type safety...")
    
    for file_path in critical_files:
        full_path = backend_root / file_path
        if not full_path.exists():
            print(f"WARNING: File not found: {file_path}")
            continue
            
        return_code, stdout, stderr = run_mypy_check(str(full_path))
        
        if return_code == 0:
            print(f"PASS: {file_path}: No type errors")
        else:
            print(f"FAIL: {file_path}: Type errors found")
            if stdout:
                print(f"   {stdout}")
            if stderr:
                print(f"   Error: {stderr}")
            all_passed = False
    
    return all_passed

def run_full_check() -> bool:
    """Run full type check on entire backend."""
    backend_root = Path(__file__).parent.parent
    
    print("Running full backend type check...")
    
    return_code, stdout, stderr = run_mypy_check(str(backend_root))
    
    if return_code == 0:
        print("PASS: Full backend type check: PASSED")
        return True
    else:
        print("FAIL: Full backend type check: FAILED")
        if stdout:
            print(stdout)
        if stderr:
            print(f"Error: {stderr}")
        return False

def check_specific_violations() -> bool:
    """Check for specific type violations mentioned in CLAUDE.md."""
    backend_root = Path(__file__).parent.parent
    
    print("Checking for specific type safety violations...")
    
    violations_found = False
    
    # Check for Any usage (except where explicitly allowed)
    result = subprocess.run([
        "grep", "-r", "--include=*.py", "Any", str(backend_root)
    ], capture_output=True, text=True)
    
    if result.returncode == 0:
        any_usage_lines = result.stdout.strip().split('\n')
        # Filter out legitimate usages
        problematic_any = [
            line for line in any_usage_lines 
            if not any(allowed in line for allowed in [
                "from typing import Any", 
                "Dict[str, Any]",  # This is often necessary for JSON
                "List[Any]",  # Sometimes necessary for mixed lists
                "# Type: ignore",
                "typing.Any"
            ])
        ]
        
        if problematic_any:
            print("FAIL: Found potentially problematic 'Any' usage:")
            for line in problematic_any[:10]:  # Show first 10
                print(f"   {line}")
            violations_found = True
        else:
            print("PASS: No problematic 'Any' usage found")
    
    # Check for missing return type annotations
    result = subprocess.run([
        "grep", "-r", "--include=*.py", "-n", "def [a-zA-Z_][a-zA-Z0-9_]*([^)]*):$", str(backend_root)
    ], capture_output=True, text=True)
    
    if result.returncode == 0:
        missing_return_types = result.stdout.strip().split('\n')
        # Filter out __init__ and other special methods
        problematic_functions = [
            line for line in missing_return_types
            if not any(special in line for special in [
                "def __", "def _", "@"
            ])
        ]
        
        if problematic_functions:
            print("FAIL: Found functions missing return type annotations:")
            for line in problematic_functions[:10]:  # Show first 10
                print(f"   {line}")
            violations_found = True
        else:
            print("PASS: All functions have return type annotations")
    
    return not violations_found

def main():
    """Main type checking routine."""
    print("Portfolio Tracker Backend Type Safety Check")
    print("=" * 50)
    
    # Change to backend directory
    backend_root = Path(__file__).parent.parent
    os.chdir(backend_root)
    
    # Check if mypy is installed
    try:
        subprocess.run([sys.executable, "-m", "mypy", "--version"], 
                      capture_output=True, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("ERROR: MyPy not installed. Installing...")
        subprocess.run([sys.executable, "-m", "pip", "install", "mypy"], check=True)
    
    all_checks_passed = True
    
    # 1. Check critical files
    if not check_critical_files():
        all_checks_passed = False
    
    print()
    
    # 2. Check for specific violations
    if not check_specific_violations():
        all_checks_passed = False
    
    print()
    
    # 3. Run full check
    if not run_full_check():
        all_checks_passed = False
    
    print()
    print("=" * 50)
    
    if all_checks_passed:
        print("SUCCESS: ALL TYPE CHECKS PASSED!")
        print("Backend meets CLAUDE.md type safety requirements")
        return 0
    else:
        print("FAILURE: TYPE CHECKS FAILED!")
        print("Backend violates CLAUDE.md type safety requirements")
        print("Please fix all type errors before proceeding")
        return 1

if __name__ == "__main__":
    sys.exit(main())