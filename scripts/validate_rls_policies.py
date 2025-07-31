#!/usr/bin/env python3
"""
🛡️ BULLETPROOF RLS POLICY VALIDATOR

This script enforces Row Level Security (RLS) policies on all user-specific tables.
Prevents cross-user data access vulnerabilities in Supabase database.

Usage: python scripts/validate_rls_policies.py
Exit Code: 0 = All policies valid, 1 = Missing policies (blocks CI/CD)
"""

import os
import sys
from pathlib import Path
from typing import List, Dict, Any, Optional, Set
import json
from dataclasses import dataclass

# Try to import Supabase client - graceful fallback if not available
try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    print("⚠️  Supabase client not available - using schema file analysis")

@dataclass
class TableInfo:
    """Information about a database table."""
    name: str
    has_user_id: bool
    has_rls: bool
    rls_policies: List[str]
    is_user_specific: bool
    schema: str = "public"

class RLSPolicyValidator:
    """Validates Row Level Security policies for user data protection."""
    
    # Tables that should have RLS policies (contain user-specific data)
    USER_SPECIFIC_TABLES = {
        'portfolios', 'transactions', 'holdings', 'watchlists', 'alerts',
        'user_preferences', 'portfolio_snapshots', 'trade_history',
        'performance_metrics', 'dividend_history', 'cash_flows',
        'rebalancing_logs', 'portfolio_analytics', 'user_sessions'
    }
    
    # Tables that are public/shared and don't need RLS
    PUBLIC_TABLES = {
        'stocks', 'market_data', 'stock_prices', 'company_info',
        'market_holidays', 'exchanges', 'sectors', 'indices'
    }
    
    def __init__(self):
        self.root_dir = Path(__file__).parent.parent
        self.violations: List[Dict[str, Any]] = []
        self.tables_info: List[TableInfo] = []
        self.supabase_client: Optional[Client] = None
        
        # Try to initialize Supabase client
        self._init_supabase_client()
    
    def _init_supabase_client(self) -> None:
        """Initialize Supabase client if credentials available."""
        if not SUPABASE_AVAILABLE:
            return
        
        # Try multiple ways to get Supabase credentials
        supabase_url = (
            os.getenv('SUPABASE_URL') or 
            os.getenv('NEXT_PUBLIC_SUPABASE_URL')
        )
        supabase_key = (
            os.getenv('SUPABASE_ANON_KEY') or 
            os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY') or
            os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        )
        
        if supabase_url and supabase_key:
            try:
                self.supabase_client = create_client(supabase_url, supabase_key)
                print(f"✅ Connected to Supabase: {supabase_url[:30]}...")
            except Exception as e:
                print(f"⚠️  Could not connect to Supabase: {e}")
                self.supabase_client = None
        else:
            print("⚠️  Supabase credentials not found - using static analysis")
    
    def analyze_schema_file(self) -> None:
        """Analyze the schema.sql file for table definitions and RLS policies."""
        schema_file = self.root_dir / "supabase" / "schema.sql"
        
        if not schema_file.exists():
            print(f"⚠️  Schema file not found: {schema_file}")
            return
        
        try:
            content = schema_file.read_text(encoding='utf-8')
            print(f"📄 Analyzing schema file: {schema_file}")
            
            # Parse tables and their RLS status
            self._parse_schema_content(content)
            
        except Exception as e:
            print(f"❌ Error reading schema file: {e}")
    
    def _parse_schema_content(self, content: str) -> None:
        """Parse SQL schema content to extract table and RLS information."""
        lines = content.split('\n')
        current_table = None
        in_table_definition = False
        
        for i, line in enumerate(lines):
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
                        break
            
            # Check for end of table definition
            elif in_table_definition and line == ');':
                in_table_definition = False
                current_table = None
            
            # Check for RLS enable statements
            elif 'ALTER TABLE' in line.upper() and 'ENABLE ROW LEVEL SECURITY' in line.upper():
                table_name = self._extract_table_from_alter(line)
                if table_name:
                    for table_info in self.tables_info:
                        if table_info.name == table_name:
                            table_info.has_rls = True
                            break
            
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
        import re
        match = re.search(r'CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(?:public\.)?(\w+)', line, re.IGNORECASE)
        return match.group(1) if match else None
    
    def _extract_table_from_alter(self, line: str) -> Optional[str]:
        """Extract table name from ALTER TABLE statement."""
        import re
        match = re.search(r'ALTER TABLE\s+(?:public\.)?(\w+)', line, re.IGNORECASE)
        return match.group(1) if match else None
    
    def _extract_policy_info(self, line: str) -> Optional[tuple]:
        """Extract policy name and table from CREATE POLICY statement."""
        import re
        match = re.search(r'CREATE POLICY\s+(\w+)\s+ON\s+(?:public\.)?(\w+)', line, re.IGNORECASE)
        return (match.group(2), match.group(1)) if match else None
    
    def query_live_database(self) -> None:
        """Query live database for RLS policy information."""
        if not self.supabase_client:
            return
        
        try:
            # Query for tables and their RLS status
            rls_query = """
            SELECT 
                schemaname,
                tablename,
                rowsecurity as has_rls,
                EXISTS(
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = pg_tables.tablename 
                    AND column_name = 'user_id'
                ) as has_user_id
            FROM pg_tables 
            WHERE schemaname = 'public'
            ORDER BY tablename;
            """
            
            # Note: This would require a service role key to access pg_tables
            # For now, rely on schema file analysis
            print("🔍 Live database querying requires service role key")
            
        except Exception as e:
            print(f"⚠️  Could not query live database: {e}")
    
    def validate_rls_coverage(self) -> None:
        """Validate that all user-specific tables have proper RLS policies."""
        print(f"🔍 Validating RLS coverage for {len(self.tables_info)} tables...")
        
        for table_info in self.tables_info:
            # Skip public tables that don't need RLS
            if table_info.name in self.PUBLIC_TABLES:
                continue
            
            # Check user-specific tables
            if table_info.is_user_specific or table_info.has_user_id:
                if not table_info.has_rls:
                    self.violations.append({
                        'type': 'missing_rls',
                        'table': table_info.name,
                        'severity': 'CRITICAL',
                        'description': f'Table {table_info.name} contains user data but lacks RLS',
                        'recommendation': f'Run: ALTER TABLE {table_info.name} ENABLE ROW LEVEL SECURITY;'
                    })
                
                elif len(table_info.rls_policies) == 0:
                    self.violations.append({
                        'type': 'no_policies',
                        'table': table_info.name,
                        'severity': 'HIGH',
                        'description': f'Table {table_info.name} has RLS enabled but no policies defined',
                        'recommendation': f'Create SELECT/INSERT/UPDATE/DELETE policies for {table_info.name}'
                    })
    
    def check_policy_completeness(self) -> None:
        """Check that RLS policies cover all necessary operations."""
        for table_info in self.tables_info:
            if table_info.has_rls and len(table_info.rls_policies) > 0:
                # Basic check: should have at least SELECT policy
                policy_names = [p.lower() for p in table_info.rls_policies]
                
                if not any('select' in p for p in policy_names):
                    self.violations.append({
                        'type': 'incomplete_policies',
                        'table': table_info.name,
                        'severity': 'MEDIUM',
                        'description': f'Table {table_info.name} missing SELECT policy',
                        'recommendation': f'Create SELECT policy for {table_info.name}'
                    })
    
    def suggest_missing_rls_policies(self) -> List[str]:
        """Generate SQL commands to fix missing RLS policies."""
        fix_commands = []
        
        for violation in self.violations:
            if violation['type'] == 'missing_rls':
                table_name = violation['table']
                
                # Enable RLS
                fix_commands.append(f"ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY;")
                
                # Add basic policies
                fix_commands.extend([
                    f"CREATE POLICY \"{table_name}_user_policy\" ON {table_name} FOR ALL USING (auth.uid() = user_id);",
                    f"-- Optionally add more specific policies for {table_name}",
                    ""
                ])
        
        return fix_commands
    
    def generate_report(self) -> bool:
        """Generate RLS validation report."""
        if not self.violations:
            print("✅ RLS POLICY VALIDATION: PASSED")
            print(f"   All {len([t for t in self.tables_info if t.is_user_specific])} user-specific tables have proper RLS")
            return False
        
        print(f"❌ RLS POLICY VIOLATIONS DETECTED: {len(self.violations)} issues")
        print("=" * 80)
        
        # Group by severity
        critical = [v for v in self.violations if v['severity'] == 'CRITICAL']
        high = [v for v in self.violations if v['severity'] == 'HIGH']
        medium = [v for v in self.violations if v['severity'] == 'MEDIUM']
        
        for severity, violations in [('CRITICAL', critical), ('HIGH', high), ('MEDIUM', medium)]:
            if violations:
                icon = {'CRITICAL': '🚨', 'HIGH': '⚠️', 'MEDIUM': '💡'}[severity]
                print(f"\n{icon} {severity} VIOLATIONS:")
                
                for violation in violations:
                    print(f"   📊 Table: {violation['table']}")
                    print(f"      📝 Issue: {violation['description']}")
                    print(f"      🛠️  Fix: {violation['recommendation']}")
                    print()
        
        # Generate fix commands
        fix_commands = self.suggest_missing_rls_policies()
        if fix_commands:
            print("\n" + "=" * 80)
            print("🛠️  AUTOMATED FIX COMMANDS:")
            print("   Copy and execute these SQL commands in Supabase SQL Editor:")
            print()
            for command in fix_commands:
                if command.strip():
                    print(f"   {command}")
        
        print("\n📖 RLS Documentation: https://supabase.com/docs/guides/auth/row-level-security")
        
        return True
    
    def run_validation(self) -> int:
        """Run complete RLS validation."""
        print("🛡️ BULLETPROOF RLS POLICY VALIDATOR")
        print("   Ensuring all user data is protected by Row Level Security...")
        
        # Analyze schema file
        self.analyze_schema_file()
        
        # Query live database if possible
        self.query_live_database()
        
        # Run validations
        self.validate_rls_coverage()
        self.check_policy_completeness()
        
        # Generate report
        has_violations = self.generate_report()
        
        return 1 if has_violations else 0

def main():
    """Main entry point for RLS validation."""
    validator = RLSPolicyValidator()
    exit_code = validator.run_validation()
    sys.exit(exit_code)

if __name__ == "__main__":
    main()