#!/usr/bin/env python3
"""
Test internal imports between modules in backend_simplified.
This script focuses on checking if modules can import from each other correctly,
simulating the Docker environment where working directory is /app/
"""

import sys
import os
from pathlib import Path
import ast
import re

# Setup paths to simulate Docker environment
backend_simplified_path = Path(__file__).parent.absolute()
project_root = backend_simplified_path.parent

# Add paths as they would be in Docker
sys.path.insert(0, str(project_root))  # /app equivalent
sys.path.insert(0, str(backend_simplified_path))  # /app/backend_simplified equivalent

print("=" * 80)
print("INTERNAL IMPORT ANALYSIS FOR BACKEND_SIMPLIFIED")
print("=" * 80)
print(f"Backend Simplified Path: {backend_simplified_path}")
print(f"Project Root (simulated /app): {project_root}")
print("=" * 80)
print()

def extract_imports_from_file(file_path: Path) -> list:
    """Extract all import statements from a Python file."""
    imports = []
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Parse the AST
        tree = ast.parse(content)
        
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    imports.append(('import', alias.name, None))
            elif isinstance(node, ast.ImportFrom):
                module = node.module or ''
                for alias in node.names:
                    imports.append(('from', module, alias.name))
    except Exception as e:
        print(f"Error parsing {file_path}: {e}")
    
    return imports

def categorize_import(import_type: str, module: str, name: str) -> str:
    """Categorize an import as internal or external."""
    if import_type == 'import':
        full_module = module
    else:
        full_module = module
    
    # Check if it's an internal import
    internal_patterns = [
        'backend_simplified',
        'config',
        'debug_logger',
        'main',
        'backend_api_routes',
        'services',
        'models',
        'utils',
        'middleware',
        'supa_api',
        'vantage_api',
        'scripts'
    ]
    
    for pattern in internal_patterns:
        if full_module.startswith(pattern):
            return 'internal'
    
    # Check if it's a relative import
    if full_module.startswith('.'):
        return 'relative'
    
    return 'external'

def analyze_file(file_path: Path, relative_to: Path) -> dict:
    """Analyze imports in a single file."""
    rel_path = file_path.relative_to(relative_to)
    imports = extract_imports_from_file(file_path)
    
    categorized = {
        'internal': [],
        'relative': [],
        'external': []
    }
    
    for import_type, module, name in imports:
        category = categorize_import(import_type, module, name)
        if import_type == 'import':
            import_str = f"import {module}"
        else:
            import_str = f"from {module} import {name}"
        categorized[category].append(import_str)
    
    return {
        'file': str(rel_path),
        'imports': categorized,
        'total': len(imports)
    }

def main():
    """Analyze all Python files in backend_simplified."""
    all_files = []
    
    # Collect all Python files
    for root, dirs, files in os.walk(backend_simplified_path):
        # Skip __pycache__ directories
        if '__pycache__' in root:
            continue
        
        for file in files:
            if file.endswith('.py') and not file.startswith('test_'):
                file_path = Path(root) / file
                all_files.append(file_path)
    
    # Analyze each file
    results = []
    for file_path in sorted(all_files):
        result = analyze_file(file_path, backend_simplified_path)
        if result['total'] > 0:
            results.append(result)
    
    # Print analysis
    print("FILE IMPORT ANALYSIS")
    print("=" * 80)
    
    internal_import_patterns = set()
    problem_files = []
    
    for result in results:
        print(f"\nFile: {result['file']}")
        print(f"Total imports: {result['total']}")
        
        if result['imports']['internal']:
            print(f"  Internal imports ({len(result['imports']['internal'])}):")
            for imp in result['imports']['internal']:
                print(f"    - {imp}")
                internal_import_patterns.add(imp)
        
        if result['imports']['relative']:
            print(f"  Relative imports ({len(result['imports']['relative'])}):")
            for imp in result['imports']['relative']:
                print(f"    - {imp}")
        
        # Check for potential issues
        has_backend_simplified_imports = any('backend_simplified' in imp for imp in result['imports']['internal'])
        has_direct_imports = any('backend_simplified' not in imp and not imp.startswith('from .') 
                                for imp in result['imports']['internal'])
        
        if has_backend_simplified_imports and has_direct_imports:
            problem_files.append(result['file'])
    
    # Summary of import patterns
    print("\n" + "=" * 80)
    print("SUMMARY OF INTERNAL IMPORT PATTERNS")
    print("=" * 80)
    
    # Group by import style
    full_path_imports = []
    relative_imports = []
    direct_imports = []
    
    for imp in sorted(internal_import_patterns):
        if 'backend_simplified' in imp:
            full_path_imports.append(imp)
        elif imp.startswith('from .'):
            relative_imports.append(imp)
        else:
            direct_imports.append(imp)
    
    print(f"\nFull path imports (with 'backend_simplified'): {len(full_path_imports)}")
    for imp in full_path_imports[:10]:  # Show first 10
        print(f"  - {imp}")
    if len(full_path_imports) > 10:
        print(f"  ... and {len(full_path_imports) - 10} more")
    
    print(f"\nDirect imports (without 'backend_simplified'): {len(direct_imports)}")
    for imp in direct_imports[:10]:  # Show first 10
        print(f"  - {imp}")
    if len(direct_imports) > 10:
        print(f"  ... and {len(direct_imports) - 10} more")
    
    print(f"\nRelative imports: {len(relative_imports)}")
    for imp in relative_imports:
        print(f"  - {imp}")
    
    # Files with mixed import styles
    if problem_files:
        print("\n" + "=" * 80)
        print("FILES WITH MIXED IMPORT STYLES (POTENTIAL ISSUES)")
        print("=" * 80)
        print("These files use both 'backend_simplified.module' and 'module' import styles:")
        for file in problem_files:
            print(f"  - {file}")
    
    # Docker environment recommendations
    print("\n" + "=" * 80)
    print("DOCKER ENVIRONMENT RECOMMENDATIONS")
    print("=" * 80)
    print("In Docker (working directory: /app/):")
    print("1. PYTHONPATH should include: /app and /app/backend_simplified")
    print("2. Import styles that will work:")
    print("   - from backend_simplified.module import something")
    print("   - from module import something (if /app/backend_simplified is in PYTHONPATH)")
    print("3. The Dockerfile should set:")
    print("   - WORKDIR /app")
    print("   - ENV PYTHONPATH=/app:/app/backend_simplified")

if __name__ == "__main__":
    main()