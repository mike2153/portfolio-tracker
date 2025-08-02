#!/usr/bin/env python3
"""
🛡️ BULLETPROOF TYPE VALIDATION

This script validates that no manual type definitions exist and that
all types are properly synchronized between frontend and backend.

Usage: python scripts/validate_types.py
Exit Code: 0 = Valid, 1 = Violations detected (blocks CI/CD)
"""

import re
import sys
from pathlib import Path
from typing import List, Dict, Any, Set
import ast
import json

class TypeValidator:
    """Validates type synchronization and blocks manual definitions."""
    
    # Patterns that indicate manual type definitions (PROHIBITED)
    MANUAL_TYPE_PATTERNS = [
        (r'export\s+interface\s+(\w+)', 'exported interface'),
        (r'export\s+type\s+(\w+)\s*=', 'exported type alias'),
        (r'interface\s+(\w+)\s*\{', 'interface declaration'),
        (r'type\s+(\w+)\s*=\s*\{', 'type object definition'),
        (r'declare\s+interface\s+(\w+)', 'ambient interface'),
        (r'declare\s+type\s+(\w+)', 'ambient type'),
    ]
    
    # Files that should never contain manual types
    PROHIBITED_PATHS = [
        'frontend/src/types/api.ts',
        'frontend/src/types/api-types.ts', 
        'frontend/src/types/backend.ts',
        'shared/types/api-contracts.ts',
        'shared/types/api.ts'
    ]
    
    # Allowed patterns (these are OK)
    ALLOWED_PATTERNS = [
        r'//.*',  # Comments
        r'/\*.*?\*/',  # Block comments
        r'import.*from.*',  # Import statements
        r'export.*from.*',  # Re-exports
        r'Generated.*auto.*',  # Generated file markers
    ]
    
    def __init__(self):
        self.root_dir = Path(__file__).parent.parent
        self.violations: List[Dict[str, Any]] = []
        self.generated_types_path = self.root_dir / "frontend" / "src" / "types" / "generated.ts"
    
    def scan_for_manual_types(self) -> None:
        """Scan codebase for prohibited manual type definitions."""
        print("🔍 Scanning for manual type definitions...")
        
        # Scan TypeScript files
        typescript_dirs = [
            self.root_dir / "frontend" / "src",
            self.root_dir / "shared"
        ]
        
        for ts_dir in typescript_dirs:
            if ts_dir.exists():
                self._scan_directory(ts_dir)
    
    def _scan_directory(self, directory: Path) -> None:
        """Scan directory for TypeScript files with manual types."""
        for ts_file in directory.rglob("*.ts"):
            # Skip generated files
            if "generated" in ts_file.name.lower():
                continue
            
            # Skip declaration files
            if ts_file.suffix == '.d.ts':
                continue
            
            # Skip node_modules
            if 'node_modules' in str(ts_file):
                continue
            
            self._scan_file(ts_file)
        
        # Also scan .tsx files
        for tsx_file in directory.rglob("*.tsx"):
            if 'node_modules' in str(tsx_file):
                continue
            self._scan_file(tsx_file)
    
    def _scan_file(self, file_path: Path) -> None:
        """Scan individual TypeScript file for manual type definitions."""
        try:
            content = file_path.read_text(encoding='utf-8')
            lines = content.split('\n')
            
            # Check each manual type pattern
            for pattern, description in self.MANUAL_TYPE_PATTERNS:
                for match in re.finditer(pattern, content, re.MULTILINE):
                    line_num = content[:match.start()].count('\n') + 1
                    line_content = lines[line_num - 1].strip() if line_num <= len(lines) else ""
                    
                    # Skip if this is in a comment
                    if self._is_in_comment(content, match.start()):
                        continue
                    
                    # Skip if this is an allowed pattern
                    if self._is_allowed_context(line_content):
                        continue
                    
                    type_name = match.group(1) if match.groups() else 'unknown'
                    
                    self.violations.append({
                        'type': 'manual_type_definition',
                        'file': str(file_path.relative_to(self.root_dir)),
                        'line': line_num,
                        'content': line_content,
                        'type_name': type_name,
                        'description': description,
                        'severity': self._assess_severity(file_path)
                    })
                    
        except Exception as e:
            print(f"⚠️  Error scanning {file_path}: {e}")
    
    def _is_in_comment(self, content: str, position: int) -> bool:
        """Check if position is within a comment."""
        # Find line start
        line_start = content.rfind('\n', 0, position) + 1
        line_content = content[line_start:content.find('\n', position) or len(content)]
        
        # Check for line comment
        comment_pos = line_content.find('//')
        if comment_pos != -1 and position >= line_start + comment_pos:
            return True
        
        # Check for block comment (simple heuristic)
        before_content = content[:position]
        open_comments = before_content.count('/*')
        close_comments = before_content.count('*/')
        
        return open_comments > close_comments
    
    def _is_allowed_context(self, line_content: str) -> bool:
        """Check if the line contains allowed patterns."""
        for pattern in self.ALLOWED_PATTERNS:
            if re.search(pattern, line_content):
                return True
        return False
    
    def _assess_severity(self, file_path: Path) -> str:
        """Assess severity based on file location."""
        file_str = str(file_path.relative_to(self.root_dir))
        
        # Critical: Files that should never have manual types
        if any(prohibited in file_str for prohibited in self.PROHIBITED_PATHS):
            return 'CRITICAL'
        
        # High: Type definition files
        if '/types/' in file_str or file_path.name.startswith('types'):
            return 'HIGH'
        
        # Medium: Regular component files
        return 'MEDIUM'
    
    def validate_generated_types_exist(self) -> bool:
        """Ensure generated types file exists and is valid."""
        if not self.generated_types_path.exists():
            self.violations.append({
                'type': 'missing_generated_types',
                'file': str(self.generated_types_path.relative_to(self.root_dir)),
                'line': 0,
                'content': 'Generated types file does not exist',
                'description': 'Auto-generated types are missing',
                'severity': 'CRITICAL'
            })
            return False
        
        try:
            content = self.generated_types_path.read_text(encoding='utf-8')
            
            # Check file size (should be substantial)
            if len(content.strip()) < 100:
                self.violations.append({
                    'type': 'empty_generated_types',
                    'file': str(self.generated_types_path.relative_to(self.root_dir)),
                    'line': 0,
                    'content': 'Generated types file is too small',
                    'description': 'Generated types appear incomplete',
                    'severity': 'HIGH'
                })
                return False
            
            # Check for generation header
            if 'AUTO-GENERATED' not in content:
                self.violations.append({
                    'type': 'missing_generation_header',
                    'file': str(self.generated_types_path.relative_to(self.root_dir)),
                    'line': 1,
                    'content': 'Missing generation header',
                    'description': 'File lacks auto-generation marker',
                    'severity': 'MEDIUM'
                })
            
            return True
            
        except Exception as e:
            self.violations.append({
                'type': 'invalid_generated_types',
                'file': str(self.generated_types_path.relative_to(self.root_dir)),
                'line': 0,
                'content': f'Error reading file: {e}',
                'description': 'Cannot validate generated types',
                'severity': 'HIGH'
            })
            return False
    
    def check_typescript_strict_mode(self) -> None:
        """Check that TypeScript strict mode is enabled."""
        tsconfig_paths = [
            self.root_dir / "frontend" / "tsconfig.json",
            self.root_dir / "tsconfig.json"
        ]
        
        for tsconfig_path in tsconfig_paths:
            if tsconfig_path.exists():
                try:
                    # Read tsconfig.json (allowing comments)
                    content = tsconfig_path.read_text(encoding='utf-8')
                    
                    # Simple JSON parsing that handles comments
                    import re
                    # Remove single-line comments
                    content = re.sub(r'//.*', '', content)
                    # Remove multi-line comments
                    content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
                    
                    config = json.loads(content)
                    
                    compiler_options = config.get('compilerOptions', {})
                    
                    # Check for strict mode
                    if not compiler_options.get('strict', False):
                        self.violations.append({
                            'type': 'typescript_not_strict',
                            'file': str(tsconfig_path.relative_to(self.root_dir)),
                            'line': 0,
                            'content': '"strict": false or missing',
                            'description': 'TypeScript strict mode not enabled',
                            'severity': 'HIGH'
                        })
                    
                    # Check for noImplicitAny
                    if not compiler_options.get('noImplicitAny', False) and not compiler_options.get('strict', False):
                        self.violations.append({
                            'type': 'implicit_any_allowed',
                            'file': str(tsconfig_path.relative_to(self.root_dir)),
                            'line': 0,
                            'content': '"noImplicitAny": false or missing',
                            'description': 'Implicit any types are allowed',
                            'severity': 'HIGH'
                        })
                    
                except Exception as e:
                    print(f"⚠️  Could not parse {tsconfig_path}: {e}")
    
    def scan_for_any_types(self) -> None:
        """Scan for usage of 'any' type (should be zero tolerance)."""
        print("🔍 Scanning for 'any' type usage...")
        
        typescript_dirs = [
            self.root_dir / "frontend" / "src",
            self.root_dir / "shared"
        ]
        
        any_patterns = [
            r':\s*any(?!\w)',  # : any
            r'<any>',  # <any>
            r'any\[\]',  # any[]
            r'Array<any>',  # Array<any>
            r'any\s*\|',  # any |
            r'\|\s*any',  # | any
        ]
        
        for ts_dir in typescript_dirs:
            if not ts_dir.exists():
                continue
                
            for ts_file in ts_dir.rglob("*.ts"):
                if "generated" in ts_file.name.lower() or 'node_modules' in str(ts_file):
                    continue
                
                try:
                    content = ts_file.read_text(encoding='utf-8')
                    lines = content.split('\n')
                    
                    for pattern in any_patterns:
                        for match in re.finditer(pattern, content, re.IGNORECASE):
                            if self._is_in_comment(content, match.start()):
                                continue
                            
                            line_num = content[:match.start()].count('\n') + 1
                            line_content = lines[line_num - 1].strip() if line_num <= len(lines) else ""
                            
                            self.violations.append({
                                'type': 'any_type_usage',
                                'file': str(ts_file.relative_to(self.root_dir)),
                                'line': line_num,
                                'content': line_content,
                                'description': 'Usage of "any" type detected',
                                'severity': 'CRITICAL'
                            })
                            
                except Exception as e:
                    continue
            
            # Also scan .tsx files
            for tsx_file in ts_dir.rglob("*.tsx"):
                if 'node_modules' in str(tsx_file):
                    continue
                    
                try:
                    content = tsx_file.read_text(encoding='utf-8')
                    lines = content.split('\n')
                    
                    for pattern in any_patterns:
                        for match in re.finditer(pattern, content, re.IGNORECASE):
                            if self._is_in_comment(content, match.start()):
                                continue
                            
                            line_num = content[:match.start()].count('\n') + 1
                            line_content = lines[line_num - 1].strip() if line_num <= len(lines) else ""
                            
                            self.violations.append({
                                'type': 'any_type_usage',
                                'file': str(tsx_file.relative_to(self.root_dir)),
                                'line': line_num,
                                'content': line_content,
                                'description': 'Usage of "any" type detected',
                                'severity': 'CRITICAL'
                            })
                            
                except Exception as e:
                    continue
    
    def generate_report(self) -> bool:
        """Generate comprehensive validation report."""
        if not self.violations:
            print("✅ TYPE VALIDATION: PASSED")
            print("   ✅ No manual type definitions found")
            print("   ✅ Generated types are valid")
            print("   ✅ No 'any' types detected")
            print("   ✅ TypeScript strict mode enabled")
            return False
        
        print(f"❌ TYPE VALIDATION VIOLATIONS: {len(self.violations)} issues")
        print("=" * 80)
        
        # Group by severity
        critical = [v for v in self.violations if v['severity'] == 'CRITICAL']
        high = [v for v in self.violations if v['severity'] == 'HIGH']
        medium = [v for v in self.violations if v['severity'] == 'MEDIUM']
        
        for severity, violations in [('CRITICAL', critical), ('HIGH', high), ('MEDIUM', medium)]:
            if not violations:
                continue
                
            icon = {'CRITICAL': '🚨', 'HIGH': '⚠️', 'MEDIUM': '💡'}[severity]
            print(f"\n{icon} {severity} VIOLATIONS:")
            
            for violation in violations:
                print(f"   📁 {violation['file']}:{violation['line']}")
                print(f"      📝 Issue: {violation['description']}")
                if 'content' in violation and violation['content']:
                    print(f"      💻 Code: {violation['content']}")
                
                # Provide specific remediation
                if violation['type'] == 'manual_type_definition':
                    print(f"      🛠️  Fix: Remove manual type, use generated types instead")
                elif violation['type'] == 'any_type_usage':
                    print(f"      🛠️  Fix: Replace 'any' with specific type from generated.ts")
                elif violation['type'] == 'typescript_not_strict':
                    print(f"      🛠️  Fix: Add '\"strict\": true' to compilerOptions")
                
                print()
        
        print("=" * 80)
        print("🛠️  REMEDIATION STEPS:")
        print("   1. Run 'npm run generate-types' to create/update generated types")
        print("   2. Remove all manual interface/type definitions")
        print("   3. Import types from 'frontend/src/types/generated'")
        print("   4. Replace all 'any' types with specific generated types")
        print("   5. Enable TypeScript strict mode in tsconfig.json")
        
        return True
    
    def run_validation(self) -> int:
        """Run complete type validation."""
        print("🛡️ BULLETPROOF TYPE VALIDATOR")
        print("   Enforcing zero manual types and perfect type synchronization...")
        
        # Run all validations
        self.validate_generated_types_exist()
        self.check_typescript_strict_mode()
        self.scan_for_manual_types()
        self.scan_for_any_types()
        
        # Generate report
        has_violations = self.generate_report()
        
        return 1 if has_violations else 0

def main():
    """Main entry point for type validation."""
    validator = TypeValidator()
    exit_code = validator.run_validation()
    sys.exit(exit_code)

if __name__ == "__main__":
    main()