#!/usr/bin/env python3
"""
Verify which functions from the metrics list actually need return type annotations.
"""

import ast
import os
from typing import List, Dict, Tuple

# List of functions from current_metrics.json that allegedly need return type hints
MISSING_FUNCTIONS = [
    ("backend_simplified\\backend_api_routes\\backend_api_forex.py", 40),
    ("backend_simplified\\backend_api_routes\\backend_api_forex.py", 172),
    ("backend_simplified\\backend_api_routes\\backend_api_research.py", 337),
    ("backend_simplified\\backend_api_routes\\backend_api_research.py", 470),
    ("backend_simplified\\middleware\\error_handler.py", 79),
    ("backend_simplified\\services\\dividend_service.py", 2339),
    ("backend_simplified\\services\\feature_flag_service.py", 469),
    ("backend_simplified\\services\\index_sim_service.py", 39),
    ("backend_simplified\\services\\index_sim_service.py", 427),
    ("backend_simplified\\services\\portfolio_calculator.py", 657),
    ("backend_simplified\\services\\portfolio_metrics_manager.py", 307),
    ("backend_simplified\\services\\portfolio_metrics_manager.py", 349),
    ("backend_simplified\\services\\portfolio_metrics_manager.py", 430),
    ("backend_simplified\\services\\portfolio_metrics_manager.py", 684),
    ("backend_simplified\\services\\price_manager.py", 644),
    ("backend_simplified\\services\\price_manager.py", 703),
    ("backend_simplified\\services\\price_manager.py", 774),
    ("backend_simplified\\services\\price_manager.py", 1008),
    ("backend_simplified\\services\\price_manager.py", 1062),
    ("backend_simplified\\services\\price_manager.py", 1509),
    ("backend_simplified\\services\\price_manager.py", 1646),
    ("backend_simplified\\services\\price_manager.py", 1913),
    ("backend_simplified\\supa_api\\supa_api_client.py", 23),
    ("backend_simplified\\supa_api\\supa_api_read.py", 57),
    ("backend_simplified\\supa_api\\supa_api_transactions.py", 17),
    ("backend_simplified\\supa_api\\supa_api_transactions.py", 341),
    ("backend_simplified\\supa_api\\supa_api_user_profile.py", 78),
    ("backend_simplified\\supa_api\\supa_api_watchlist.py", 50),
    ("backend_simplified\\supa_api\\supa_api_watchlist.py", 145),
    ("backend_simplified\\utils\\response_factory.py", 66),
    ("backend_simplified\\utils\\task_utils.py", 14),
    ("backend_simplified\\utils\\task_utils.py", 62),
]

def check_function_at_line(file_path: str, line_number: int) -> Tuple[bool, str]:
    """Check if function at specific line has return type annotation."""
    try:
        # Convert Windows path to Unix style
        file_path = file_path.replace('\\', '/')
        
        if not os.path.exists(file_path):
            return False, f"File not found: {file_path}"
        
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        if line_number > len(lines):
            return False, f"Line {line_number} exceeds file length"
        
        # Look for function definition around the specified line
        for i in range(max(0, line_number - 5), min(len(lines), line_number + 5)):
            line = lines[i].strip()
            if line.startswith('def ') or line.startswith('async def '):
                # Check if this line or next few lines contain ->
                for j in range(i, min(len(lines), i + 10)):
                    if '->' in lines[j]:
                        return True, f"Line {i+1}: Function HAS return type"
                    if lines[j].strip().endswith(':'):
                        return False, f"Line {i+1}: Function MISSING return type: {lines[i].strip()}"
        
        return False, f"No function definition found near line {line_number}"
        
    except Exception as e:
        return False, f"Error checking {file_path}:{line_number}: {e}"

def main():
    print("VERIFYING MISSING RETURN TYPE ANNOTATIONS")
    print("=" * 60)
    
    actually_missing = []
    already_typed = []
    errors = []
    
    for file_path, line_number in MISSING_FUNCTIONS:
        has_return_type, message = check_function_at_line(file_path, line_number)
        
        if "Error" in message or "not found" in message:
            errors.append((file_path, line_number, message))
        elif has_return_type:
            already_typed.append((file_path, line_number, message))
        else:
            actually_missing.append((file_path, line_number, message))
    
    print(f"\\nRESULTS:")
    print(f"Functions that ACTUALLY need return types: {len(actually_missing)}")
    print(f"Functions already typed: {len(already_typed)}")
    print(f"Errors/not found: {len(errors)}")
    
    if actually_missing:
        print(f"\\nFUNCTIONS NEEDING RETURN TYPE ANNOTATIONS ({len(actually_missing)}):")
        for file_path, line_number, message in actually_missing:
            print(f"  {file_path}:{line_number} - {message}")
    
    if already_typed:
        print(f"\\nFUNCTIONS ALREADY TYPED ({len(already_typed)}):")
        for file_path, line_number, message in already_typed[:10]:  # Show first 10
            print(f"  {file_path}:{line_number} - {message}")
        if len(already_typed) > 10:
            print(f"  ... and {len(already_typed) - 10} more")
    
    if errors:
        print(f"\\nERRORS ({len(errors)}):")
        for file_path, line_number, message in errors:
            print(f"  {file_path}:{line_number} - {message}")

if __name__ == "__main__":
    main()