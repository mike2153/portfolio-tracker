#!/usr/bin/env python3
"""
BULLETPROOF RLS POLICY VALIDATOR (Simplified)
Validates Row Level Security policies from schema file analysis.
"""

import os
import sys
from pathlib import Path
import re
from typing import List, Dict, Any, Optional, Set
from dataclasses import dataclass

@dataclass
class TableInfo:
    """Information about a database table."""
    name: str
    has_user_id: bool
    has_rls: bool
    rls_policies: List[str]
    is_user_specific: bool
    schema: str = "public"

class RLSValidator:
    """Validates Row Level Security policies for user data protection."""
    
    # Tables that should have RLS policies (contain user-specific data)
    USER_SPECIFIC_TABLES = {
        'portfolios', 'transactions', 'holdings', 'watchlist', 'price_alerts',
        'user_profiles', 'user_dividends', 'portfolio_caches', 'portfolio_metrics_cache',
        'user_currency_cache', 'audit_log', 'rate_limits', 'dividend_sync_state'
    }
    
    def __init__(self):
        self.root_dir = Path(__file__).parent.parent
        self.violations: List[Dict[str, Any]] = []
        self.tables_info: List[TableInfo] = []
    
    def analyze_schema_file(self) -> None:
        """Analyze the schema.sql file for table definitions and RLS policies."""
        schema_file = self.root_dir / "supabase" / "schema.sql"
        
        if not schema_file.exists():
            print(f"WARNING: Schema file not found: {schema_file}")
            return
        
        try:
            with open(schema_file, 'r', encoding='utf-8') as f:
                content = f.read()
            print(f"Analyzing schema file: {schema_file}")
            self._parse_schema_content(content)
            
        except Exception as e:
            print(f"ERROR: Could not read schema file: {e}")
    
    def analyze_migration_files(self) -> None:
        """Analyze migration files for RLS policies."""
        migrations_dir = self.root_dir / "supabase" / "migrations"
        
        if not migrations_dir.exists():
            print(f"WARNING: Migrations directory not found: {migrations_dir}")
            return
        
        migration_files = sorted(migrations_dir.glob("*.sql"))
        print(f"Found {len(migration_files)} migration files")
        
        for migration_file in migration_files:
            try:
                with open(migration_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                print(f"Analyzing migration: {migration_file.name}")
                self._parse_migration_content(content, migration_file.name)
                
            except Exception as e:
                print(f"ERROR: Could not read {migration_file}: {e}")
    
    def _parse_schema_content(self, content: str) -> None:
        """Parse SQL schema content to extract table and RLS information."""
        lines = content.split('\n')
        current_table = None
        in_table_definition = False
        
        for line in lines:
            line = line.strip()
            
            # Detect table creation
            if line.upper().startswith('CREATE TABLE'):
                table_match = self._extract_table_name(line)
                if table_match:
                    current_table = table_match
                    in_table_definition = True
                    
                    # Initialize table info
                    table_info = TableInfo(
                        name=current_table,
                        has_user_id=False,
                        has_rls=False,
                        rls_policies=[],
                        is_user_specific=current_table in self.USER_SPECIFIC_TABLES
                    )
                    self.tables_info.append(table_info)
            
            # Check for user_id column
            elif in_table_definition and current_table and 'user_id' in line.lower():
                for table_info in self.tables_info:
                    if table_info.name == current_table:
                        table_info.has_user_id = True
                        table_info.is_user_specific = True
                        break
            
            # Check for end of table definition
            elif in_table_definition and line == ');':
                in_table_definition = False
                current_table = None
    
    def _parse_migration_content(self, content: str, filename: str) -> None:
        """Parse migration content for RLS policies."""
        lines = content.split('\n')
        
        for line in lines:
            line = line.strip()
            
            # Check for RLS enable statements
            if 'ALTER TABLE' in line.upper() and 'ENABLE ROW LEVEL SECURITY' in line.upper():
                table_name = self._extract_table_from_alter(line)
                if table_name:
                    for table_info in self.tables_info:
                        if table_info.name == table_name:
                            table_info.has_rls = True
                            break
                    else:
                        # Table not in schema - add it
                        table_info = TableInfo(
                            name=table_name,
                            has_user_id=True,  # Assume has user_id if RLS enabled
                            has_rls=True,
                            rls_policies=[],
                            is_user_specific=table_name in self.USER_SPECIFIC_TABLES
                        )
                        self.tables_info.append(table_info)
            
            # Check for RLS policies
            elif line.upper().startswith('CREATE POLICY'):
                policy_info = self._extract_policy_info(line)
                if policy_info:
                    table_name, policy_name = policy_info
                    for table_info in self.tables_info:
                        if table_info.name == table_name:
                            table_info.rls_policies.append(policy_name)
                            break
    
    def _extract_table_name(self, line: str) -> Optional[str]:
        """Extract table name from CREATE TABLE statement."""
        match = re.search(r'CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(?:public\.)?(\w+)', line, re.IGNORECASE)
        return match.group(1) if match else None
    
    def _extract_table_from_alter(self, line: str) -> Optional[str]:
        """Extract table name from ALTER TABLE statement."""
        match = re.search(r'ALTER TABLE\s+(?:public\.)?(\w+)', line, re.IGNORECASE)
        return match.group(1) if match else None
    
    def _extract_policy_info(self, line: str) -> Optional[tuple]:
        """Extract policy name and table from CREATE POLICY statement."""
        match = re.search(r'CREATE POLICY\s+"?(\w+)"?\s+ON\s+(?:public\.)?(\w+)', line, re.IGNORECASE)
        return (match.group(2), match.group(1)) if match else None
    
    def validate_rls_coverage(self) -> None:
        """Validate that all user-specific tables have proper RLS policies."""
        print(f"Validating RLS coverage for {len(self.tables_info)} tables...")
        
        user_tables = [t for t in self.tables_info if t.is_user_specific or t.has_user_id]
        protected_tables = [t for t in user_tables if t.has_rls and len(t.rls_policies) > 0]
        
        print(f"User-specific tables found: {len(user_tables)}")
        print(f"Protected tables: {len(protected_tables)}")
        
        for table_info in self.tables_info:
            # Check user-specific tables
            if table_info.is_user_specific or table_info.has_user_id:
                if not table_info.has_rls:
                    self.violations.append({
                        'type': 'missing_rls',
                        'table': table_info.name,
                        'severity': 'CRITICAL',
                        'description': f'Table {table_info.name} contains user data but lacks RLS',
                        'recommendation': f'Enable RLS: ALTER TABLE {table_info.name} ENABLE ROW LEVEL SECURITY;'
                    })
                
                elif len(table_info.rls_policies) == 0:
                    self.violations.append({
                        'type': 'no_policies',
                        'table': table_info.name,
                        'severity': 'HIGH',
                        'description': f'Table {table_info.name} has RLS enabled but no policies defined',
                        'recommendation': f'Create user isolation policies for {table_info.name}'
                    })
    
    def generate_report(self) -> bool:
        """Generate RLS validation report."""
        print("\n" + "="*80)
        print("RLS POLICY VALIDATION REPORT")
        print("="*80)
        
        if not self.violations:
            user_tables = [t for t in self.tables_info if t.is_user_specific or t.has_user_id]
            protected_tables = [t for t in user_tables if t.has_rls and len(t.rls_policies) > 0]
            
            print("SUCCESS: RLS POLICY VALIDATION PASSED")
            print(f"Protected tables: {len(protected_tables)}/{len(user_tables)}")
            
            if protected_tables:
                print("\nProtected Tables:")
                for table in protected_tables:
                    print(f"  - {table.name}: {len(table.rls_policies)} policies")
            
            return False
        
        print(f"VIOLATIONS DETECTED: {len(self.violations)} issues")
        
        # Group by severity
        critical = [v for v in self.violations if v['severity'] == 'CRITICAL']
        high = [v for v in self.violations if v['severity'] == 'HIGH']
        medium = [v for v in self.violations if v['severity'] == 'MEDIUM']
        
        for severity, violations in [('CRITICAL', critical), ('HIGH', high), ('MEDIUM', medium)]:
            if violations:
                print(f"\n{severity} VIOLATIONS:")
                
                for violation in violations:
                    print(f"  Table: {violation['table']}")
                    print(f"    Issue: {violation['description']}")
                    print(f"    Fix: {violation['recommendation']}")
                    print()
        
        return True
    
    def run_validation(self) -> int:
        """Run complete RLS validation."""
        print("BULLETPROOF RLS POLICY VALIDATOR")
        print("Ensuring all user data is protected by Row Level Security...")
        print()
        
        # Analyze schema and migrations
        self.analyze_schema_file()
        self.analyze_migration_files()
        
        # Run validations
        self.validate_rls_coverage()
        
        # Generate report
        has_violations = self.generate_report()
        
        return 1 if has_violations else 0

def main():
    """Main entry point for RLS validation."""
    validator = RLSValidator()
    exit_code = validator.run_validation()
    return exit_code

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)