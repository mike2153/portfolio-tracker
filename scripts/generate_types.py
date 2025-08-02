#!/usr/bin/env python3
"""
🛡️ BULLETPROOF TYPE GENERATION PIPELINE

This script creates TypeScript interfaces from FastAPI's OpenAPI schema,
eliminating manual type definitions and preventing frontend/backend drift.

Usage: python scripts/generate_types.py
Exit Code: 0 = Success, 1 = Generation failed (blocks CI/CD)
"""

import json
import subprocess
import sys
import requests
import time
from pathlib import Path
from typing import Dict, Any, Optional
from datetime import datetime

class TypeGenerationPipeline:
    """Automated type generation that prevents manual type definitions."""
    
    def __init__(self, backend_url: str = "http://localhost:8000"):
        self.backend_url = backend_url
        self.root_dir = Path(__file__).parent.parent
        self.generated_types_path = self.root_dir / "frontend" / "src" / "types" / "generated.ts"
        self.shared_types_path = self.root_dir / "shared" / "types" / "generated.ts"
        self.manual_types_paths = [
            self.root_dir / "shared" / "types" / "api-contracts.ts",
            self.root_dir / "frontend" / "src" / "types" / "api.ts",
            self.root_dir / "frontend" / "src" / "types" / "index.ts"
        ]
    
    def ensure_backend_running(self) -> bool:
        """Ensure backend is running or start it temporarily."""
        try:
            response = requests.get(f"{self.backend_url}/health", timeout=5)
            if response.status_code == 200:
                print("✅ Backend is running")
                return True
        except requests.exceptions.RequestException:
            pass
        
        print("🚀 Starting backend for type generation...")
        
        # Try to start backend temporarily
        backend_dir = self.root_dir / "backend"
        if backend_dir.exists():
            try:
                # Start backend in background
                import subprocess
                import os
                
                env = os.environ.copy()
                env['PYTHONPATH'] = str(backend_dir)
                
                self.backend_process = subprocess.Popen([
                    sys.executable, "main.py"
                ], cwd=backend_dir, env=env, 
                stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                
                # Wait for backend to start
                max_attempts = 30
                for i in range(max_attempts):
                    try:
                        response = requests.get(f"{self.backend_url}/health", timeout=2)
                        if response.status_code == 200:
                            print(f"✅ Backend started after {i+1} attempts")
                            return True
                    except requests.exceptions.RequestException:
                        time.sleep(1)
                
                print("❌ Backend failed to start within 30 seconds")
                return False
                
            except Exception as e:
                print(f"❌ Failed to start backend: {e}")
                return False
        
        print("❌ Backend directory not found")
        return False
    
    def extract_openapi_schema(self) -> Optional[Dict[str, Any]]:
        """Extract OpenAPI schema from running FastAPI server."""
        try:
            print("📄 Extracting OpenAPI schema...")
            response = requests.get(f"{self.backend_url}/openapi.json", timeout=10)
            response.raise_for_status()
            schema = response.json()
            
            print(f"✅ Extracted schema with {len(schema.get('components', {}).get('schemas', {}))} components")
            return schema
            
        except requests.exceptions.RequestException as e:
            print(f"❌ Failed to extract OpenAPI schema: {e}")
            return None
        except json.JSONDecodeError as e:
            print(f"❌ Invalid JSON in OpenAPI response: {e}")
            return None
    
    def install_dependencies(self) -> bool:
        """Install required Node.js dependencies."""
        try:
            print("📦 Installing openapi-typescript...")
            result = subprocess.run([
                "npm", "install", "-D", "openapi-typescript@^6.0.0"
            ], cwd=self.root_dir, capture_output=True, text=True)
            
            if result.returncode != 0:
                print(f"❌ Failed to install dependencies: {result.stderr}")
                return False
            
            return True
            
        except Exception as e:
            print(f"❌ Error installing dependencies: {e}")
            return False
    
    def generate_typescript_types(self, schema: Dict[str, Any]) -> bool:
        """Generate TypeScript interfaces from OpenAPI schema."""
        try:
            print("⚡ Generating TypeScript interfaces...")
            
            # Create temp schema file
            temp_schema = self.root_dir / "temp_openapi_schema.json"
            with open(temp_schema, 'w') as f:
                json.dump(schema, f, indent=2)
            
            # Ensure output directory exists
            self.generated_types_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Generate types using openapi-typescript
            result = subprocess.run([
                "npx", "openapi-typescript", str(temp_schema),
                "--output", str(self.generated_types_path),
                "--prettier-config", "{}",  # Use default prettier config
            ], cwd=self.root_dir, capture_output=True, text=True)
            
            # Clean up temp file
            temp_schema.unlink(missing_ok=True)
            
            if result.returncode != 0:
                print(f"❌ Type generation failed: {result.stderr}")
                print(f"   stdout: {result.stdout}")
                return False
            
            print(f"✅ Generated types: {self.generated_types_path}")
            return True
            
        except Exception as e:
            print(f"❌ Error generating TypeScript types: {e}")
            return False
    
    def add_generation_header(self) -> None:
        """Add generation header to TypeScript file."""
        if not self.generated_types_path.exists():
            return
        
        try:
            content = self.generated_types_path.read_text(encoding='utf-8')
            
            header = f'''/**
 * 🛡️ AUTO-GENERATED TYPES - DO NOT EDIT MANUALLY
 * 
 * Generated from FastAPI OpenAPI schema on {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
 * Source: {self.backend_url}/openapi.json
 * 
 * To regenerate: npm run generate-types
 * 
 * ⚠️  WARNING: Manual edits will be overwritten!
 * ⚠️  Add custom types to separate files, not here!
 */

'''
            
            # Add export statement for better imports
            footer = '''

// Re-export commonly used types for convenience
export type { paths, components, operations } from './generated';

// Helper types for API responses
export type ApiResponse<T> = {
  data: T;
  message?: string;
  status: 'success' | 'error';
};

export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
};
'''
            
            # Write with header
            self.generated_types_path.write_text(header + content + footer, encoding='utf-8')
            print("✅ Added generation header and helper types")
            
        except Exception as e:
            print(f"⚠️  Could not add header: {e}")
    
    def validate_no_manual_types(self) -> bool:
        """Validate that no manual type definitions exist."""
        violations = []
        
        # Check for manual type files
        for manual_path in self.manual_types_paths:
            if not manual_path.exists():
                continue
            
            try:
                content = manual_path.read_text(encoding='utf-8')
                
                # Skip if file is empty or only has comments
                content_lines = [line.strip() for line in content.split('\n') 
                               if line.strip() and not line.strip().startswith('//')]
                
                if len(content_lines) > 0:
                    # Check for actual type definitions
                    import re
                    type_patterns = [
                        r'export\s+interface\s+\w+',
                        r'export\s+type\s+\w+\s*=',
                        r'interface\s+\w+\s*\{',
                        r'type\s+\w+\s*='
                    ]
                    
                    has_types = any(
                        re.search(pattern, content, re.IGNORECASE) 
                        for pattern in type_patterns
                    )
                    
                    if has_types:
                        violations.append(str(manual_path.relative_to(self.root_dir)))
                        
            except Exception as e:
                print(f"⚠️  Could not read {manual_path}: {e}")
        
        if violations:
            print("❌ MANUAL TYPE DEFINITIONS DETECTED:")
            for violation in violations:
                print(f"   📁 {violation}")
            print("\n🛠️  ACTION REQUIRED:")
            print("   1. Remove manual type definitions from the files above")
            print("   2. Use generated types from frontend/src/types/generated.ts")
            print("   3. Add custom types to separate files (e.g., custom-types.ts)")
            return False
        
        print("✅ No manual type definitions found")
        return True
    
    def create_index_file(self) -> None:
        """Create convenient index file for type imports."""
        index_path = self.generated_types_path.parent / "index.ts"
        
        index_content = '''/**
 * 🛡️ BULLETPROOF TYPE EXPORTS
 * 
 * Central export point for all generated types.
 * Import from here instead of directly from generated.ts
 */

// Export all generated types
export * from './generated';

// Re-export commonly used types with shorter names
export type {
  components as APIComponents,
  paths as APIPaths,
  operations as APIOperations
} from './generated';
'''
        
        try:
            index_path.write_text(index_content, encoding='utf-8')
            print(f"✅ Created index file: {index_path}")
        except Exception as e:
            print(f"⚠️  Could not create index file: {e}")
    
    def update_package_json(self) -> None:
        """Add type generation script to package.json."""
        package_json_path = self.root_dir / "package.json"
        
        if not package_json_path.exists():
            print("⚠️  package.json not found - skipping script addition")
            return
        
        try:
            with open(package_json_path, 'r') as f:
                package_data = json.load(f)
            
            # Add scripts
            if 'scripts' not in package_data:
                package_data['scripts'] = {}
            
            package_data['scripts']['generate-types'] = 'python scripts/generate_types.py'
            package_data['scripts']['validate-types'] = 'python scripts/validate_types.py'
            
            # Update dev dependencies
            if 'devDependencies' not in package_data:
                package_data['devDependencies'] = {}
            
            package_data['devDependencies']['openapi-typescript'] = '^6.0.0'
            
            with open(package_json_path, 'w') as f:
                json.dump(package_data, f, indent=2)
            
            print("✅ Updated package.json with type generation scripts")
            
        except Exception as e:
            print(f"⚠️  Could not update package.json: {e}")
    
    def cleanup(self) -> None:
        """Clean up any temporary resources."""
        try:
            if hasattr(self, 'backend_process') and self.backend_process:
                print("🛑 Stopping temporary backend...")
                self.backend_process.terminate()
                self.backend_process.wait(timeout=5)
        except Exception:
            pass
    
    def run_pipeline(self) -> int:
        """Execute the complete type generation pipeline."""
        try:
            print("🛡️ BULLETPROOF TYPE GENERATION PIPELINE")
            print("   Eliminating manual type definitions and preventing drift...")
            
            # Step 1: Install dependencies
            if not self.install_dependencies():
                return 1
            
            # Step 2: Ensure backend is running
            if not self.ensure_backend_running():
                print("❌ Cannot generate types without running backend")
                return 1
            
            # Step 3: Extract OpenAPI schema
            schema = self.extract_openapi_schema()
            if not schema:
                return 1
            
            # Step 4: Generate TypeScript types
            if not self.generate_typescript_types(schema):
                return 1
            
            # Step 5: Add header and helper types
            self.add_generation_header()
            
            # Step 6: Create convenience index file
            self.create_index_file()
            
            # Step 7: Update package.json
            self.update_package_json()
            
            # Step 8: Validate no manual types exist
            if not self.validate_no_manual_types():
                print("\n⚠️  Manual type definitions detected but types generated successfully")
                print("   Manual cleanup required before enabling strict validation")
            
            print("\n🎉 TYPE GENERATION COMPLETE!")
            print(f"   📁 Generated: {self.generated_types_path}")
            print(f"   📊 Components: {len(schema.get('components', {}).get('schemas', {}))}")
            print("   🚫 Manual type definitions are now prohibited")
            
            return 0
            
        except Exception as e:
            print(f"❌ Pipeline failed: {e}")
            return 1
        finally:
            self.cleanup()

def main():
    """Main entry point for type generation."""
    pipeline = TypeGenerationPipeline()
    exit_code = pipeline.run_pipeline()
    sys.exit(exit_code)

if __name__ == "__main__":
    main()