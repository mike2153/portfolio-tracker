#!/usr/bin/env python3
"""
🛡️ BULLETPROOF PACKAGE.JSON UPDATER

Updates package.json with all bulletproof quality scripts and dependencies.
This ensures all quality monitoring and type generation tools are available.

Usage: python scripts/update_package_json.py
"""

import json
import sys
from pathlib import Path

def update_package_json():
    """Update package.json with bulletproof quality scripts."""
    root_dir = Path(__file__).parent.parent
    package_json_path = root_dir / "package.json"
    
    # Read existing package.json or create minimal one
    if package_json_path.exists():
        with open(package_json_path, 'r') as f:
            package_data = json.load(f)
    else:
        package_data = {
            "name": "portfolio-tracker",
            "version": "2.0.0",
            "description": "Bulletproof Portfolio Tracker with automated quality enforcement"
        }
    
    # Ensure required sections exist
    if 'scripts' not in package_data:
        package_data['scripts'] = {}
    
    if 'devDependencies' not in package_data:
        package_data['devDependencies'] = {}
    
    # Add bulletproof quality scripts
    quality_scripts = {
        # Type generation and validation
        "generate-types": "python scripts/generate_types.py",
        "validate-types": "python scripts/validate_types.py",
        
        # Quality monitoring
        "quality:check": "python scripts/quality_monitor.py",
        "quality:watch": "python scripts/quality_monitor.py --daemon",
        "quality:dashboard": "python scripts/quality_monitor.py --dashboard-only",
        
        # Individual validation scripts
        "validate:decimal": "python scripts/validate_decimal_usage.py",
        "validate:sql": "python scripts/detect_raw_sql.py",
        "validate:rls": "python scripts/validate_rls_policies.py",
        
        # Bulletproof build process
        "build:safe": "npm run validate-types && npm run quality:check && npm run build",
        "dev:safe": "npm run generate-types && npm run dev",
        
        # Pre-commit validation
        "pre-commit": "npm run validate-types && npm run quality:check",
        
        # CI/CD helpers
        "ci:quality": "npm run validate-types && npm run quality:check",
        "ci:build": "npm run generate-types && npm run build:safe",
    }
    
    # Add/update scripts
    package_data['scripts'].update(quality_scripts)
    
    # Add required dev dependencies
    dev_dependencies = {
        "openapi-typescript": "^6.0.0",
        "jscpd": "^3.5.0",
        "typescript": "^5.0.0",
        "@types/node": "^20.0.0",
        "@types/react": "^18.0.0",
        "@types/react-dom": "^18.0.0",
    }
    
    # Add/update dev dependencies
    package_data['devDependencies'].update(dev_dependencies)
    
    # Add bulletproof quality configuration
    package_data['bulletproof'] = {
        "version": "2.0.0",
        "lastUpdated": "2025-07-30",
        "qualityStandards": {
            "typeScript": {
                "strict": True,
                "noImplicitAny": True,
                "zeroAnyTypes": True
            },
            "python": {
                "strictMypy": True,
                "noTypeErrors": True,
                "decimalFinancial": True
            },
            "security": {
                "noRawSQL": True,
                "rlsPolicies": True,
                "corsSecure": True
            },
            "codeQuality": {
                "maxDuplication": 3.0,
                "minTestCoverage": 90.0,
                "noDrift": True
            }
        }
    }
    
    # Write updated package.json
    with open(package_json_path, 'w') as f:
        json.dump(package_data, f, indent=2, sort_keys=False)
    
    print("✅ Updated package.json with bulletproof quality scripts")
    print(f"📦 Added {len(quality_scripts)} quality scripts")
    print(f"🔧 Added {len(dev_dependencies)} dev dependencies")
    
    # Display available scripts
    print("\n🛡️ BULLETPROOF QUALITY SCRIPTS AVAILABLE:")
    for script, command in quality_scripts.items():
        print(f"   npm run {script:<20} # {command}")

if __name__ == "__main__":
    try:
        update_package_json()
    except Exception as e:
        print(f"❌ Error updating package.json: {e}")
        sys.exit(1)