#!/usr/bin/env python3
"""
Quality Check Toggle Script
===========================

This script helps you toggle quality checks on/off for GitHub Actions.
It modifies the workflow files to enable/disable quality gate enforcement.

Usage:
    python scripts/toggle_quality_checks.py --disable    # Disable quality checks
    python scripts/toggle_quality_checks.py --enable     # Enable quality checks
    python scripts/toggle_quality_checks.py --status     # Check current status
"""

import argparse
import os
import re
from pathlib import Path


class QualityCheckToggle:
    """Toggle quality checks in GitHub Actions workflows"""
    
    def __init__(self, project_root: str = None):
        self.project_root = Path(project_root) if project_root else Path.cwd()
        self.workflow_file = self.project_root / ".github" / "workflows" / "quality-gate.yml"
        
        if not self.workflow_file.exists():
            raise FileNotFoundError(f"Workflow file not found: {self.workflow_file}")
    
    def get_status(self) -> bool:
        """Check if quality checks are currently enabled"""
        with open(self.workflow_file, 'r') as f:
            content = f.read()
        
        # Check if the quality check step is commented out
        if re.search(r'#\s*-\s*name:\s*Run Quality Gate Check', content):
            return False
        elif re.search(r'-\s*name:\s*Run Quality Gate Check', content):
            return True
        else:
            # Assume enabled if unclear
            return True
    
    def disable_checks(self):
        """Disable quality checks by commenting out the step"""
        print("🔄 Disabling quality gate checks...")
        
        with open(self.workflow_file, 'r') as f:
            content = f.read()
        
        # Comment out the quality check step
        content = re.sub(
            r'^(\s*)-(\s*name:\s*Run Quality Gate Check.+?run:\s*.+?)$',
            r'\1#\2',
            content,
            flags=re.MULTILINE | re.DOTALL
        )
        
        # Add a warning comment
        if "# Quality checks temporarily disabled" not in content:
            content = content.replace(
                "- name: Run Quality Gate Check",
                "# Quality checks temporarily disabled - use toggle_quality_checks.py to re-enable\n    #- name: Run Quality Gate Check"
            )
        
        with open(self.workflow_file, 'w') as f:
            f.write(content)
        
        print("✅ Quality gate checks have been DISABLED")
        print("⚠️  This should only be used for emergencies or hotfixes!")
        print("💡 To re-enable: python scripts/toggle_quality_checks.py --enable")
    
    def enable_checks(self):
        """Enable quality checks by uncommenting the step"""
        print("🔄 Enabling quality gate checks...")
        
        with open(self.workflow_file, 'r') as f:
            content = f.read()
        
        # Remove comments from quality check step
        content = re.sub(
            r'^\s*#\s*(-\s*name:\s*Run Quality Gate Check.+?run:\s*.+?)$',
            r'    \1',
            content,
            flags=re.MULTILINE | re.DOTALL
        )
        
        # Remove warning comment
        content = re.sub(
            r'^\s*#\s*Quality checks temporarily disabled.*\n',
            '',
            content,
            flags=re.MULTILINE
        )
        
        with open(self.workflow_file, 'w') as f:
            f.write(content)
        
        print("✅ Quality gate checks have been ENABLED")
        print("🛡️  Code quality enforcement is now active")
    
    def print_status(self):
        """Print current status of quality checks"""
        enabled = self.get_status()
        status = "ENABLED" if enabled else "DISABLED"
        icon = "🟢" if enabled else "🔴"
        
        print(f"\n{icon} Quality Gate Status: {status}")
        
        if enabled:
            print("🛡️  Quality checks will run on push/PR")
            print("💡 To disable: python scripts/toggle_quality_checks.py --disable")
        else:
            print("⚠️  Quality checks are currently disabled!")
            print("💡 To enable: python scripts/toggle_quality_checks.py --enable")
        
        print(f"📄 Workflow file: {self.workflow_file}")


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="Toggle GitHub Actions quality checks")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--enable", action="store_true", help="Enable quality checks")
    group.add_argument("--disable", action="store_true", help="Disable quality checks")
    group.add_argument("--status", action="store_true", help="Show current status")
    
    args = parser.parse_args()
    
    try:
        toggle = QualityCheckToggle()
        
        if args.enable:
            toggle.enable_checks()
        elif args.disable:
            toggle.disable_checks()
        elif args.status:
            toggle.print_status()
            
    except FileNotFoundError as e:
        print(f"❌ Error: {e}")
        return 1
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main())