#!/usr/bin/env python3
"""
Quality Monitoring Installation Script
=====================================

This script sets up the complete quality monitoring system for Portfolio Tracker.
It installs required dependencies and sets up monitoring infrastructure.

Usage:
    python scripts/install_monitoring.py
"""

import subprocess
import sys
import os
from pathlib import Path


def run_command(cmd, description, cwd=None):
    """Run a command and handle errors"""
    print(f"📦 {description}...")
    try:
        result = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True)
        if result.returncode == 0:
            print(f"✅ {description} completed")
            return True
        else:
            print(f"❌ {description} failed: {result.stderr}")
            return False
    except Exception as e:
        print(f"❌ {description} failed: {e}")
        return False


def main():
    """Main installation process"""
    print("🛡️  Portfolio Tracker Quality Monitoring Setup")
    print("=" * 60)
    
    project_root = Path.cwd()
    
    # Install Python dependencies
    print("\n1. Installing Python dependencies...")
    success = run_command(
        f"{sys.executable} -m pip install mypy",
        "Installing mypy for Python type checking"
    )
    
    if not success:
        print("⚠️  MyPy installation failed, continuing without it")
    
    # Install Node.js dependencies for frontend monitoring
    frontend_dir = project_root / "frontend"
    if frontend_dir.exists():
        print("\n2. Installing Node.js dependencies for frontend monitoring...")
        
        # Install jscpd for code duplication detection
        run_command(
            "npm install -g jscpd",
            "Installing jscpd for code duplication detection"
        )
        
        # Install type-coverage for TypeScript coverage
        run_command(
            "npm install -g type-coverage",
            "Installing type-coverage for TypeScript analysis"
        )
        
        # Install in frontend directory
        run_command(
            "npm install",
            "Installing frontend dependencies",
            cwd=frontend_dir
        )
    
    # Create monitoring directories
    print("\n3. Setting up monitoring directories...")
    
    dirs_to_create = [
        project_root / "metrics",
        project_root / "scripts",
        project_root / "metrics" / "alerts",
        project_root / "metrics" / "reports"
    ]
    
    for dir_path in dirs_to_create:
        dir_path.mkdir(exist_ok=True)
        print(f"📁 Created directory: {dir_path}")
    
    # Make quality monitor executable
    quality_monitor = project_root / "scripts" / "quality_monitor.py"
    if quality_monitor.exists():
        try:
            os.chmod(quality_monitor, 0o755)
            print(f"🔧 Made {quality_monitor} executable")
        except Exception as e:
            print(f"⚠️  Could not make quality monitor executable: {e}")
    
    # Create package.json script entries
    print("\n4. Adding monitoring scripts to package.json...")
    
    root_package_json = project_root / "package.json"
    if root_package_json.exists():
        try:
            import json
            with open(root_package_json, 'r') as f:
                package_data = json.load(f)
            
            if 'scripts' not in package_data:
                package_data['scripts'] = {}
            
            package_data['scripts'].update({
                'quality:check': 'python scripts/quality_monitor.py',
                'quality:watch': 'python scripts/quality_monitor.py --daemon',
                'quality:dashboard': 'python scripts/quality_monitor.py --dashboard'
            })
            
            with open(root_package_json, 'w') as f:
                json.dump(package_data, f, indent=2)
            
            print("✅ Added quality monitoring scripts to package.json")
            
        except Exception as e:
            print(f"⚠️  Could not update package.json: {e}")
    
    # Test the installation
    print("\n5. Testing quality monitor installation...")
    test_result = run_command(
        f"{sys.executable} scripts/quality_monitor.py --dashboard",
        "Testing quality monitor"
    )
    
    if test_result:
        print("\n🎉 Quality Monitoring Setup Complete!")
        print("\nAvailable commands:")
        print("  npm run quality:check     - Run single quality scan")
        print("  npm run quality:watch     - Start continuous monitoring")
        print("  npm run quality:dashboard - Generate dashboard only")
        print(f"\nDashboard will be available at: {project_root}/quality_dashboard.html")
        print("Monitor daemon updates dashboard every 5 minutes")
    else:
        print("\n❌ Installation completed with errors")
        print("Some monitoring features may not work correctly")


if __name__ == "__main__":
    main()