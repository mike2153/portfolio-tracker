#!/usr/bin/env python3
"""
Automated OpenAPI Documentation Generation Pipeline
Generates comprehensive API documentation from FastAPI application with zero manual maintenance.

Part of Phase 1 Documentation Updates - Portfolio Tracker Overhaul Plan
"""

import json
import sys
import os
import subprocess
from pathlib import Path
from typing import Dict, Any, List
from datetime import datetime
import requests

# Add backend to path for imports
sys.path.append(str(Path(__file__).parent.parent / "backend"))

def generate_openapi_spec() -> Dict[str, Any]:
    """Generate OpenAPI specification from FastAPI application."""
    try:
        print("🔄 Generating OpenAPI specification from FastAPI app...")
        
        # Import the FastAPI app
        from main import app
        
        # Generate OpenAPI spec
        openapi_spec = app.openapi()
        
        # Enhance spec with additional metadata
        openapi_spec["info"].update({
            "contact": {
                "name": "Portfolio Tracker API Support",
                "url": "https://github.com/your-repo/portfolio-tracker"
            },
            "license": {
                "name": "MIT",
                "url": "https://opensource.org/licenses/MIT"
            },
            "version": "2.0.0"
        })
        
        # Add servers information
        openapi_spec["servers"] = [
            {
                "url": "http://localhost:8000",
                "description": "Development server"
            },
            {
                "url": "https://api.portfoliotracker.com",
                "description": "Production server"
            }
        ]
        
        # Save OpenAPI spec
        output_path = Path(__file__).parent.parent / "docs" / "openapi.json"
        with open(output_path, "w") as f:
            json.dump(openapi_spec, f, indent=2)
        
        print(f"✅ OpenAPI specification generated: {output_path}")
        return openapi_spec
        
    except Exception as e:
        print(f"❌ Failed to generate OpenAPI spec: {str(e)}")
        sys.exit(1)

def validate_openapi_completeness(spec: Dict[str, Any]) -> List[str]:
    """Validate that OpenAPI spec has complete documentation."""
    print("🔍 Validating OpenAPI specification completeness...")
    
    issues = []
    
    # Check for missing descriptions
    for path, methods in spec.get("paths", {}).items():
        for method, operation in methods.items():
            if method.upper() in ["GET", "POST", "PUT", "DELETE", "PATCH"]:
                # Check for description
                if not operation.get("description"):
                    issues.append(f"Missing description: {method.upper()} {path}")
                
                # Check for response descriptions
                responses = operation.get("responses", {})
                for status_code, response in responses.items():
                    if not response.get("description"):
                        issues.append(f"Missing response description: {method.upper()} {path} - {status_code}")
                
                # Check for parameter descriptions
                parameters = operation.get("parameters", [])
                for param in parameters:
                    if not param.get("description"):
                        issues.append(f"Missing parameter description: {method.upper()} {path} - {param.get('name', 'unknown')}")
    
    # Check for missing schemas
    components = spec.get("components", {})
    schemas = components.get("schemas", {})
    
    for schema_name, schema in schemas.items():
        if not schema.get("description"):
            issues.append(f"Missing schema description: {schema_name}")
    
    if issues:
        print(f"⚠️  Found {len(issues)} documentation issues:")
        for issue in issues[:10]:  # Show first 10
            print(f"   - {issue}")
        if len(issues) > 10:
            print(f"   ... and {len(issues) - 10} more")
    else:
        print("✅ OpenAPI specification is complete")
    
    return issues

def generate_markdown_documentation(spec: Dict[str, Any]) -> str:
    """Generate comprehensive Markdown documentation from OpenAPI spec."""
    print("📝 Generating Markdown documentation from OpenAPI spec...")
    
    # Start with header
    md_content = f"""# Portfolio Tracker API Documentation

**Auto-Generated on**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}  
**API Version**: {spec['info']['version']}  
**OpenAPI Version**: {spec['openapi']}

⚠️ **This documentation is auto-generated from the FastAPI application. Do not edit manually.**

## Overview

{spec['info']['description']}

## Base URLs

"""
    
    # Add servers
    for server in spec.get("servers", []):
        md_content += f"- **{server['description']}**: `{server['url']}`\n"
    
    md_content += "\n## Authentication\n\n"
    md_content += "All endpoints require JWT authentication unless otherwise specified.\n\n"
    md_content += "```\nAuthorization: Bearer <jwt_token>\n```\n\n"
    
    # Add endpoints by tags
    paths = spec.get("paths", {})
    tags = set()
    
    # Extract all tags
    for path, methods in paths.items():
        for method, operation in methods.items():
            if method.upper() in ["GET", "POST", "PUT", "DELETE", "PATCH"]:
                for tag in operation.get("tags", []):
                    tags.add(tag)
    
    # Document each tag section
    for tag in sorted(tags):
        md_content += f"## {tag}\n\n"
        
        # Find all endpoints for this tag
        for path, methods in paths.items():
            for method, operation in methods.items():
                if method.upper() in ["GET", "POST", "PUT", "DELETE", "PATCH"]:
                    if tag in operation.get("tags", []):
                        md_content += f"### {operation.get('summary', f'{method.upper()} {path}')}\n\n"
                        md_content += f"```http\n{method.upper()} {path}\n```\n\n"
                        
                        if operation.get("description"):
                            md_content += f"**Description**: {operation['description']}\n\n"
                        
                        # Parameters
                        parameters = operation.get("parameters", [])
                        if parameters:
                            md_content += "**Parameters**:\n\n"
                            for param in parameters:
                                param_type = param.get("schema", {}).get("type", "string")
                                required = "required" if param.get("required") else "optional"
                                description = param.get("description", "No description")
                                md_content += f"- `{param['name']}` ({param_type}, {required}): {description}\n"
                            md_content += "\n"
                        
                        # Request body
                        request_body = operation.get("requestBody")
                        if request_body:
                            md_content += "**Request Body**:\n\n"
                            content = request_body.get("content", {})
                            if "application/json" in content:
                                schema_ref = content["application/json"].get("schema", {})
                                if "$ref" in schema_ref:
                                    schema_name = schema_ref["$ref"].split("/")[-1]
                                    md_content += f"See schema: `{schema_name}`\n\n"
                                else:
                                    md_content += "JSON object (see OpenAPI spec for details)\n\n"
                        
                        # Responses
                        responses = operation.get("responses", {})
                        if responses:
                            md_content += "**Responses**:\n\n"
                            for status_code, response in responses.items():
                                description = response.get("description", "No description")
                                md_content += f"- **{status_code}**: {description}\n"
                            md_content += "\n"
                        
                        md_content += "---\n\n"
    
    # Add schemas section
    components = spec.get("components", {})
    schemas = components.get("schemas", {})
    
    if schemas:
        md_content += "## Data Models\n\n"
        for schema_name, schema in schemas.items():
            md_content += f"### {schema_name}\n\n"
            if schema.get("description"):
                md_content += f"{schema['description']}\n\n"
            
            properties = schema.get("properties", {})
            if properties:
                md_content += "**Properties**:\n\n"
                for prop_name, prop_schema in properties.items():
                    prop_type = prop_schema.get("type", "unknown")
                    prop_description = prop_schema.get("description", "No description")
                    required = prop_name in schema.get("required", [])
                    required_text = " (required)" if required else ""
                    md_content += f"- `{prop_name}` ({prop_type}{required_text}): {prop_description}\n"
                md_content += "\n"
            
            md_content += "---\n\n"
    
    # Add footer
    md_content += f"""
## Auto-Generation Information

- **Generated**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}
- **Source**: FastAPI application (`backend/main.py`)
- **Generator**: `scripts/generate_api_docs.py`
- **OpenAPI Spec**: `docs/openapi.json`

⚠️ **Warning**: This file is automatically generated. Manual changes will be overwritten.
"""
    
    return md_content

def generate_typescript_types(spec: Dict[str, Any]) -> str:
    """Generate TypeScript type definitions from OpenAPI spec."""
    print("🔧 Generating TypeScript types from OpenAPI spec...")
    
    ts_content = f"""/**
 * Auto-generated TypeScript types from OpenAPI specification
 * Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}
 * 
 * ⚠️ DO NOT EDIT MANUALLY - This file is auto-generated
 */

"""
    
    # Generate interfaces from schemas
    components = spec.get("components", {})
    schemas = components.get("schemas", {})
    
    for schema_name, schema in schemas.items():
        # Convert OpenAPI schema to TypeScript interface
        ts_content += f"export interface {schema_name} {{\n"
        
        properties = schema.get("properties", {})
        required_fields = set(schema.get("required", []))
        
        for prop_name, prop_schema in properties.items():
            optional = "?" if prop_name not in required_fields else ""
            ts_type = convert_openapi_type_to_typescript(prop_schema)
            description = prop_schema.get("description", "")
            
            if description:
                ts_content += f"  /** {description} */\n"
            ts_content += f"  {prop_name}{optional}: {ts_type};\n"
        
        ts_content += "}\n\n"
    
    # Add API response wrapper types
    ts_content += """
// Standard API response wrapper
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  metadata?: {
    timestamp: string;
    version: string;
    cache_status?: string;
    computation_time_ms?: number;
  };
}

// Error response type
export interface APIError {
  success: false;
  error: string;
  message: string;
  details?: Array<{
    code: string;
    message: string;
    field?: string;
  }>;
  request_id?: string;
  timestamp: string;
}
"""
    
    return ts_content

def convert_openapi_type_to_typescript(prop_schema: Dict[str, Any]) -> str:
    """Convert OpenAPI property schema to TypeScript type."""
    prop_type = prop_schema.get("type", "any")
    
    type_mapping = {
        "string": "string",
        "integer": "number",
        "number": "number",
        "boolean": "boolean",
        "array": "Array<any>",  # Would need more specific handling
        "object": "Record<string, any>"
    }
    
    # Handle specific formats
    if prop_type == "string":
        format_type = prop_schema.get("format")
        if format_type == "date":
            return "string"  # ISO date string
        elif format_type == "date-time":
            return "string"  # ISO datetime string
        elif format_type == "email":
            return "string"
        elif format_type == "uuid":
            return "string"
    
    # Handle enums
    if "enum" in prop_schema:
        enum_values = prop_schema["enum"]
        return " | ".join(f'"{value}"' for value in enum_values)
    
    # Handle arrays
    if prop_type == "array":
        items = prop_schema.get("items", {})
        item_type = convert_openapi_type_to_typescript(items)
        return f"Array<{item_type}>"
    
    # Handle references
    if "$ref" in prop_schema:
        ref_name = prop_schema["$ref"].split("/")[-1]
        return ref_name
    
    return type_mapping.get(prop_type, "any")

def save_generated_files(spec: Dict[str, Any], markdown_content: str, typescript_content: str):
    """Save all generated documentation files."""
    docs_dir = Path(__file__).parent.parent / "docs"
    frontend_types_dir = Path(__file__).parent.parent / "frontend" / "src" / "types"
    
    # Save markdown documentation
    api_doc_path = docs_dir / "api_doc.md"
    with open(api_doc_path, "w", encoding="utf-8") as f:
        f.write(markdown_content)
    print(f"✅ Markdown documentation saved: {api_doc_path}")
    
    # Save TypeScript types
    types_path = frontend_types_dir / "generated-api.ts"
    with open(types_path, "w", encoding="utf-8") as f:
        f.write(typescript_content)
    print(f"✅ TypeScript types saved: {types_path}")
    
    # Save OpenAPI spec (already saved in generate_openapi_spec but confirm)
    openapi_path = docs_dir / "openapi.json"
    print(f"✅ OpenAPI specification saved: {openapi_path}")

def run_validation_checks(spec: Dict[str, Any]) -> bool:
    """Run comprehensive validation checks."""
    print("🔍 Running validation checks...")
    
    validation_passed = True
    
    # Check OpenAPI completeness
    issues = validate_openapi_completeness(spec)
    if issues:
        print(f"⚠️  Found {len(issues)} documentation issues")
        validation_passed = False
    
    # Validate required sections
    required_info = ["title", "description", "version"]
    for field in required_info:
        if not spec.get("info", {}).get(field):
            print(f"❌ Missing required info field: {field}")
            validation_passed = False
    
    # Check for security definitions
    if not spec.get("components", {}).get("securitySchemes"):
        print("⚠️  No security schemes defined in OpenAPI spec")
    
    # Validate paths exist
    if not spec.get("paths"):
        print("❌ No API paths defined")
        validation_passed = False
    
    return validation_passed

def main():
    """Main execution function."""
    print("🚀 Starting automated API documentation generation...")
    print("=" * 60)
    
    try:
        # Step 1: Generate OpenAPI specification
        openapi_spec = generate_openapi_spec()
        
        # Step 2: Validate completeness
        validation_passed = run_validation_checks(openapi_spec)
        
        # Step 3: Generate Markdown documentation
        markdown_content = generate_markdown_documentation(openapi_spec)
        
        # Step 4: Generate TypeScript types
        typescript_content = generate_typescript_types(openapi_spec)
        
        # Step 5: Save all files
        save_generated_files(openapi_spec, markdown_content, typescript_content)
        
        # Final report
        print("=" * 60)
        print("✅ API documentation generation completed successfully!")
        print(f"📊 Generated {len(openapi_spec.get('paths', {}))} API endpoints")
        print(f"📋 Generated {len(openapi_spec.get('components', {}).get('schemas', {}))} data models")
        
        if not validation_passed:
            print("⚠️  Documentation has validation issues (see above)")
            print("🔧 Consider fixing these issues for better API documentation")
        
        print("\n📁 Generated files:")
        print("   - docs/openapi.json (OpenAPI specification)")
        print("   - docs/api_doc.md (Markdown documentation)")
        print("   - frontend/src/types/generated-api.ts (TypeScript types)")
        
        print("\n🔄 To regenerate documentation, run:")
        print("   python scripts/generate_api_docs.py")
        
    except Exception as e:
        print(f"❌ Failed to generate API documentation: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()