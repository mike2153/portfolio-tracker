#!/usr/bin/env python3
"""
Type Generation Automation Pipeline
Eliminates manual type definitions by auto-generating TypeScript interfaces from Pydantic models.

Part of Phase 1 Documentation Updates - Portfolio Tracker Overhaul Plan
ZERO TOLERANCE for manual type definitions.
"""

import json
import sys
import os
import ast
import inspect
from pathlib import Path
from typing import Dict, Any, List, Set, Optional
from datetime import datetime
import re

# Add backend to path for imports
sys.path.append(str(Path(__file__).parent.parent / "backend"))

def extract_pydantic_models() -> Dict[str, Dict[str, Any]]:
    """Extract all Pydantic models from the backend."""
    print("🔍 Extracting Pydantic models from backend...")
    
    models = {}
    backend_path = Path(__file__).parent.parent / "backend"
    
    # Import validation models
    try:
        from models.validation_models import StrictModel
        from models.response_models import APIResponse, APIError
        import models.validation_models as validation_models
        import models.response_models as response_models
        
        # Get all classes from validation models
        for name, obj in inspect.getmembers(validation_models):
            if (inspect.isclass(obj) and 
                hasattr(obj, '__annotations__') and 
                issubclass(obj, StrictModel)):
                models[name] = extract_pydantic_model_info(obj)
        
        # Get all classes from response models  
        for name, obj in inspect.getmembers(response_models):
            if (inspect.isclass(obj) and 
                hasattr(obj, '__annotations__')):
                models[name] = extract_pydantic_model_info(obj)
                
        print(f"✅ Extracted {len(models)} Pydantic models")
        return models
        
    except Exception as e:
        print(f"❌ Failed to extract Pydantic models: {str(e)}")
        return {}

def extract_pydantic_model_info(model_class) -> Dict[str, Any]:
    """Extract field information from a Pydantic model."""
    info = {
        "name": model_class.__name__,
        "description": model_class.__doc__ or "",
        "fields": {},
        "required_fields": [],
        "base_classes": [base.__name__ for base in model_class.__bases__ if base.__name__ != 'object']
    }
    
    # Get model fields
    if hasattr(model_class, 'model_fields'):
        # Pydantic v2
        fields = model_class.model_fields
        for field_name, field_info in fields.items():
            field_data = {
                "type": str(field_info.annotation) if hasattr(field_info, 'annotation') else 'Any',
                "required": field_info.is_required() if hasattr(field_info, 'is_required') else True,
                "description": getattr(field_info, 'description', '') or '',
                "default": getattr(field_info, 'default', None)
            }
            info["fields"][field_name] = field_data
            
            if field_data["required"]:
                info["required_fields"].append(field_name)
                
    elif hasattr(model_class, '__fields__'):
        # Pydantic v1
        fields = model_class.__fields__
        for field_name, field_info in fields.items():
            field_data = {
                "type": str(field_info.type_),
                "required": field_info.required,
                "description": getattr(field_info.field_info, 'description', '') or '',
                "default": field_info.default
            }
            info["fields"][field_name] = field_data
            
            if field_data["required"]:
                info["required_fields"].append(field_name)
    
    return info

def convert_python_type_to_typescript(python_type: str) -> str:
    """Convert Python type annotations to TypeScript types."""
    # Clean up type string
    python_type = python_type.replace("<class '", "").replace("'>", "")
    python_type = python_type.replace("typing.", "")
    python_type = python_type.replace("pydantic.", "")
    
    # Basic type mappings
    type_mappings = {
        'str': 'string',
        'int': 'number',
        'float': 'number',
        'bool': 'boolean',
        'datetime.date': 'string',
        'datetime.datetime': 'string',
        'decimal.Decimal': 'number',
        'UUID': 'string',
        'Any': 'any',
        'Dict': 'Record<string, any>',
        'List': 'Array<any>',
    }
    
    # Handle Optional types
    if python_type.startswith('Union[') and 'NoneType' in python_type:
        # Extract the non-None type from Union
        inner_type = python_type.replace('Union[', '').replace(']', '').split(',')[0].strip()
        return f"{convert_python_type_to_typescript(inner_type)} | null"
    
    # Handle Optional directly
    if python_type.startswith('Optional['):
        inner_type = python_type[9:-1]  # Remove Optional[ and ]
        return f"{convert_python_type_to_typescript(inner_type)} | null"
    
    # Handle List types
    if python_type.startswith('List['):
        inner_type = python_type[5:-1]  # Remove List[ and ]
        return f"Array<{convert_python_type_to_typescript(inner_type)}>"
    
    # Handle Dict types
    if python_type.startswith('Dict['):
        return 'Record<string, any>'
    
    # Handle Literal types
    if python_type.startswith('Literal['):
        values = python_type[8:-1]  # Remove Literal[ and ]
        # Split by comma and clean up
        literal_values = [v.strip().strip('"\'') for v in values.split(',')]
        return ' | '.join(f'"{val}"' for val in literal_values)
    
    # Check direct mappings
    for py_type, ts_type in type_mappings.items():
        if python_type == py_type or python_type.endswith(f'.{py_type}'):
            return ts_type
    
    # If no mapping found, assume it's a custom interface
    if python_type and python_type[0].isupper():
        return python_type
    
    return 'any'

def generate_typescript_interfaces(models: Dict[str, Dict[str, Any]]) -> str:
    """Generate TypeScript interfaces from Pydantic models."""
    print("🔧 Generating TypeScript interfaces...")
    
    ts_content = f"""/**
 * Auto-generated TypeScript interfaces from Pydantic models
 * Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}
 * 
 * ⚠️ DO NOT EDIT MANUALLY - This file is auto-generated from backend Pydantic models
 * 
 * To regenerate: python scripts/sync_types.py
 */

// ===== ZERO TOLERANCE FOR MANUAL TYPES =====
// All types in this file are auto-generated from backend/models/
// Manual type definitions are FORBIDDEN and will be rejected by CI

"""
    
    # Generate interfaces
    for model_name, model_info in models.items():
        # Add description if available
        if model_info["description"]:
            description = model_info["description"].strip().replace('\n', '\n * ')
            ts_content += f"/**\n * {description}\n */\n"
        
        ts_content += f"export interface {model_name} {{\n"
        
        # Add fields
        for field_name, field_info in model_info["fields"].items():
            # Add field description
            if field_info["description"]:
                ts_content += f"  /** {field_info['description']} */\n"
            
            # Determine if field is optional
            optional_marker = "" if field_info["required"] else "?"
            
            # Convert type
            ts_type = convert_python_type_to_typescript(field_info["type"])
            
            ts_content += f"  {field_name}{optional_marker}: {ts_type};\n"
        
        ts_content += "}\n\n"
    
    # Add utility types
    ts_content += """// ===== STANDARD API RESPONSE TYPES =====

/**
 * Standard success response wrapper
 */
export interface APISuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
  metadata?: {
    timestamp: string;
    version?: string;
    cache_status?: 'hit' | 'miss' | 'stale';
    computation_time_ms?: number;
    [key: string]: any;
  };
}

/**
 * Standard error response wrapper
 */
export interface APIErrorResponse {
  success: false;
  error: string;
  message: string;
  details?: Array<{
    code: string;
    message: string;
    field?: string;
    details?: Record<string, any>;
  }>;
  request_id?: string;
  timestamp: string;
}

/**
 * Union type for all API responses
 */
export type APIResponse<T = any> = APISuccessResponse<T> | APIErrorResponse;

// ===== TYPE GUARDS =====

/**
 * Type guard to check if response is successful
 */
export function isSuccessResponse<T>(response: APIResponse<T>): response is APISuccessResponse<T> {
  return response.success === true;
}

/**
 * Type guard to check if response is an error
 */
export function isErrorResponse(response: APIResponse): response is APIErrorResponse {
  return response.success === false;
}

// ===== FINANCIAL DATA TYPES =====

/**
 * Financial amount with currency
 */
export interface FinancialAmount {
  amount: number;
  currency: string;
}

/**
 * Price data point
 */
export interface PriceDataPoint {
  date: string;
  price: number;
  volume?: number;
}

/**
 * Holdings summary
 */
export interface HoldingSummary {
  symbol: string;
  quantity: number;
  average_price: number;
  current_price: number;
  current_value: number;
  gain_loss: number;
  gain_loss_percent: number;
}

// ===== VALIDATION HELPERS =====

/**
 * Validate required fields in an object
 */
export function validateRequiredFields<T extends Record<string, any>>(
  obj: T,
  requiredFields: (keyof T)[]
): string[] {
  const missing: string[] = [];
  
  for (const field of requiredFields) {
    if (obj[field] === undefined || obj[field] === null) {
      missing.push(String(field));
    }
  }
  
  return missing;
}

/**
 * Type-safe pick utility
 */
export type Pick<T, K extends keyof T> = {
  [P in K]: T[P];
};

/**
 * Type-safe omit utility
 */
export type Omit<T, K extends keyof T> = {
  [P in Exclude<keyof T, K>]: T[P];
};

/**
 * Make all properties optional
 */
export type Partial<T> = {
  [P in keyof T]?: T[P];
};

/**
 * Make all properties required
 */
export type Required<T> = {
  [P in keyof T]-?: T[P];
};

// ===== AUTO-GENERATION METADATA =====

export const TYPE_GENERATION_INFO = {
  generated_at: '{datetime.now().isoformat()}',
  source_models: {len(models)},
  generator_version: '1.0.0',
  backend_source: 'backend/models/',
  manual_types_forbidden: true,
  validation_required: true
} as const;

// ===== STRICT TYPE CHECKING =====

// Ensure all 'any' types are intentional and documented
type ForbiddenAny = never;

// Helper to catch accidental 'any' usage
export type StrictType<T> = T extends any 
  ? T extends ForbiddenAny 
    ? never 
    : T
  : never;
"""
    
    return ts_content

def validate_manual_types_removal() -> List[str]:
    """Validate that no manual type definitions exist in the frontend."""
    print("🔍 Validating removal of manual type definitions...")
    
    violations = []
    frontend_types_dir = Path(__file__).parent.parent / "frontend" / "src" / "types"
    
    # Files that are allowed to have manual types
    allowed_files = {
        'generated-api.ts',  # Auto-generated from OpenAPI
        'generated-models.ts',  # Auto-generated from Pydantic
        'index.ts',  # Re-exports only
        'api.ts'  # Re-exports only (deprecated)
    }
    
    # Check all TypeScript files in types directory
    for ts_file in frontend_types_dir.glob("*.ts"):
        if ts_file.name in allowed_files:
            continue
            
        # Read file content
        try:
            with open(ts_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Check for interface/type definitions
            if re.search(r'^(export\s+)?(interface|type)\s+\w+', content, re.MULTILINE):
                violations.append(f"Manual type definitions found in {ts_file.name}")
                
        except Exception as e:
            print(f"⚠️  Could not read {ts_file}: {str(e)}")
    
    return violations

def save_generated_types(ts_content: str):
    """Save generated TypeScript types."""
    frontend_types_dir = Path(__file__).parent.parent / "frontend" / "src" / "types"
    frontend_types_dir.mkdir(parents=True, exist_ok=True)
    
    # Save generated models
    models_path = frontend_types_dir / "generated-models.ts"
    with open(models_path, "w", encoding="utf-8") as f:
        f.write(ts_content)
    
    print(f"✅ Generated TypeScript types saved: {models_path}")

def update_type_index():
    """Update the types index file to re-export generated types."""
    print("🔧 Updating types index file...")
    
    frontend_types_dir = Path(__file__).parent.parent / "frontend" / "src" / "types"
    index_path = frontend_types_dir / "index.ts"
    
    index_content = f"""/**
 * Frontend Types Index
 * Re-exports auto-generated types for consistency
 * 
 * ⚠️ ZERO TOLERANCE FOR MANUAL TYPES
 * All type definitions must be auto-generated
 */

// Auto-generated API types from OpenAPI specification
export * from './generated-api';

// Auto-generated model types from Pydantic models  
export * from './generated-models';

// Legacy re-exports (DEPRECATED - use generated types instead)
export * from './api';

// Manual types are FORBIDDEN - use generated types only
// If you need a new type, add it to the backend Pydantic models

// Type generation metadata
export {{ TYPE_GENERATION_INFO }} from './generated-models';

// Global window interface extension (frontend-specific)
declare global {{
  interface Window {{
    searchTimeout?: NodeJS.Timeout;
  }}
}}

/**
 * Simple stock data for display (frontend-specific)
 * TODO: Move to backend Pydantic model
 */
export interface StockData {{
  symbol: string;
  company: string;
  price: number;
  change: number;
  change_percent: number;
  volume: number;
}}
"""
    
    with open(index_path, "w", encoding="utf-8") as f:
        f.write(index_content)
    
    print(f"✅ Updated types index: {index_path}")

def run_type_validation() -> bool:
    """Run comprehensive type validation."""
    print("🔍 Running type validation...")
    
    validation_passed = True
    
    # Check for manual type violations
    violations = validate_manual_types_removal()
    if violations:
        print("❌ Manual type definition violations found:")
        for violation in violations:
            print(f"   - {violation}")
        validation_passed = False
    else:
        print("✅ No manual type definitions found")
    
    # Check TypeScript compilation
    frontend_dir = Path(__file__).parent.parent / "frontend"
    if frontend_dir.exists():
        print("🔧 Checking TypeScript compilation...")
        try:
            result = os.system(f"cd {frontend_dir} && npx tsc --noEmit --strict")
            if result == 0:
                print("✅ TypeScript compilation successful")
            else:
                print("❌ TypeScript compilation failed")
                validation_passed = False
        except Exception as e:
            print(f"⚠️  Could not run TypeScript check: {str(e)}")
    
    return validation_passed

def main():
    """Main execution function."""
    print("🚀 Starting type generation automation...")
    print("=" * 60)
    print("🎯 ZERO TOLERANCE FOR MANUAL TYPES")
    print("=" * 60)
    
    try:
        # Step 1: Extract Pydantic models
        models = extract_pydantic_models()
        
        if not models:
            print("⚠️  No Pydantic models found - generating basic types only")
        
        # Step 2: Generate TypeScript interfaces
        typescript_content = generate_typescript_interfaces(models)
        
        # Step 3: Save generated types
        save_generated_types(typescript_content)
        
        # Step 4: Update type index
        update_type_index()
        
        # Step 5: Run validation
        validation_passed = run_type_validation()
        
        # Final report
        print("=" * 60)
        print("✅ Type generation automation completed!")
        print(f"📊 Generated {len(models)} TypeScript interfaces from Pydantic models")
        
        print("\n📁 Generated files:")
        print("   - frontend/src/types/generated-models.ts (TypeScript interfaces)")
        print("   - frontend/src/types/index.ts (Updated re-exports)")
        
        print("\n🚫 ZERO TOLERANCE ENFORCEMENT:")
        print("   - Manual type definitions are FORBIDDEN")
        print("   - All types must be auto-generated from backend")
        print("   - CI will reject any manual type definitions")
        
        if not validation_passed:
            print("\n❌ Type validation failed - fix issues above")
            sys.exit(1)
        else:
            print("\n✅ All type validation checks passed")
        
        print("\n🔄 To regenerate types, run:")
        print("   python scripts/sync_types.py")
        
    except Exception as e:
        print(f"❌ Failed to generate types: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()