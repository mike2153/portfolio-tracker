#!/usr/bin/env python3
"""
Master Documentation Generation Pipeline
Runs all documentation automation scripts to ensure complete documentation ecosystem.

Part of Phase 1 Documentation Updates - Portfolio Tracker Overhaul Plan
ZERO TOLERANCE for documentation drift.
"""

import subprocess
import sys
import os
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any
import json

def run_script(script_name: str, description: str) -> Dict[str, Any]:
    """Run a documentation script and capture results."""
    print(f"\n{'='*60}")
    print(f"🚀 Running: {description}")
    print(f"📝 Script: {script_name}")
    print(f"{'='*60}")
    
    script_path = Path(__file__).parent / script_name
    if not script_path.exists():
        return {
            "success": False,
            "error": f"Script not found: {script_path}",
            "duration": 0
        }
    
    start_time = datetime.now()
    
    try:
        # Run the script
        result = subprocess.run(
            [sys.executable, str(script_path)],
            capture_output=True,
            text=True,
            timeout=300  # 5 minute timeout
        )
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Print output
        if result.stdout:
            print(result.stdout)
        
        if result.stderr and result.returncode != 0:
            print(f"❌ Error output:\n{result.stderr}")
        
        success = result.returncode == 0
        
        return {
            "success": success,
            "returncode": result.returncode,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "duration": duration
        }
        
    except subprocess.TimeoutExpired:
        duration = (datetime.now() - start_time).total_seconds()
        return {
            "success": False,
            "error": "Script timed out after 5 minutes",
            "duration": duration
        }
    except Exception as e:
        duration = (datetime.now() - start_time).total_seconds()
        return {
            "success": False,
            "error": str(e),
            "duration": duration
        }

def validate_generated_files() -> List[str]:
    """Validate that all expected files were generated."""
    print("\n🔍 Validating generated documentation files...")
    
    expected_files = [
        "docs/openapi.json",
        "docs/api_doc.md", 
        "docs/security.md",
        "frontend/src/types/generated-api.ts",
        "frontend/src/types/generated-models.ts"
    ]
    
    missing_files = []
    project_root = Path(__file__).parent.parent
    
    for file_path in expected_files:
        full_path = project_root / file_path
        if not full_path.exists():
            missing_files.append(file_path)
        else:
            # Check if file is not empty
            if full_path.stat().st_size == 0:
                missing_files.append(f"{file_path} (empty)")
            else:
                print(f"✅ {file_path} ({full_path.stat().st_size} bytes)")
    
    if missing_files:
        print("❌ Missing or empty files:")
        for file_path in missing_files:
            print(f"   - {file_path}")
    
    return missing_files

def generate_documentation_report(results: Dict[str, Dict[str, Any]]) -> str:
    """Generate a comprehensive documentation generation report."""
    print("\n📊 Generating documentation report...")
    
    total_duration = sum(result.get("duration", 0) for result in results.values())
    successful_scripts = sum(1 for result in results.values() if result.get("success"))
    total_scripts = len(results)
    
    report = f"""# Documentation Generation Report

**Generated on**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}  
**Total Duration**: {total_duration:.2f} seconds  
**Success Rate**: {successful_scripts}/{total_scripts} ({successful_scripts/total_scripts*100:.1f}%)  

## Pipeline Results

"""
    
    for script_name, result in results.items():
        status = "✅ SUCCESS" if result.get("success") else "❌ FAILED"
        duration = result.get("duration", 0)
        
        report += f"### {script_name}\n\n"
        report += f"- **Status**: {status}\n"
        report += f"- **Duration**: {duration:.2f}s\n"
        
        if not result.get("success"):
            error = result.get("error", "Unknown error")
            report += f"- **Error**: {error}\n"
        
        report += "\n"
    
    # Add file validation results
    missing_files = validate_generated_files()
    report += "## Generated Files\n\n"
    
    if missing_files:
        report += "❌ **Missing or empty files detected:**\n\n"
        for file_path in missing_files:
            report += f"- {file_path}\n"
    else:
        report += "✅ **All expected files generated successfully**\n"
    
    report += "\n## Next Steps\n\n"
    
    if successful_scripts == total_scripts and not missing_files:
        report += "🎉 **All documentation generation completed successfully!**\n\n"
        report += "- Commit the generated documentation files\n"
        report += "- CI will validate documentation consistency\n"
        report += "- Documentation is now automated and drift-free\n"
    else:
        report += "🔧 **Issues detected - manual intervention required:**\n\n"
        
        if successful_scripts < total_scripts:
            report += "- Fix failed script execution errors\n"
        
        if missing_files:
            report += "- Investigate missing file generation\n"
        
        report += "- Re-run documentation generation after fixes\n"
    
    report += f"""
## Automation Information

- **Master Script**: `scripts/generate_all_docs.py`
- **Individual Scripts**: 
  - `scripts/generate_api_docs.py` - OpenAPI documentation
  - `scripts/sync_types.py` - Type generation
  - `scripts/security_docs_sync.py` - Security documentation
- **CI Validation**: `.github/workflows/docs-validation.yml`
- **Zero Manual Maintenance**: All documentation auto-generated

---

⚠️ **ZERO TOLERANCE POLICY**: Manual documentation edits are forbidden and will be overwritten.
"""
    
    return report

def run_pre_generation_checks() -> bool:
    """Run pre-generation validation checks."""
    print("🔍 Running pre-generation validation checks...")
    
    checks_passed = True
    project_root = Path(__file__).parent.parent
    
    # Check if required directories exist
    required_dirs = [
        "backend",
        "frontend/src/types",
        "docs",
        ".github/workflows"
    ]
    
    for dir_path in required_dirs:
        full_path = project_root / dir_path
        if not full_path.exists():
            print(f"❌ Required directory missing: {dir_path}")
            checks_passed = False
        else:
            print(f"✅ Directory exists: {dir_path}")
    
    # Check if backend can be imported
    backend_path = project_root / "backend"
    if backend_path.exists():
        sys.path.insert(0, str(backend_path))
        try:
            import main
            print("✅ Backend FastAPI app can be imported")
        except Exception as e:
            print(f"❌ Cannot import backend app: {str(e)}")
            print("🔧 Set required environment variables (SUPA_API_URL, SUPA_API_ANON_KEY, VANTAGE_API_KEY)")
            checks_passed = False
    
    # Check for required environment variables (for OpenAPI generation)
    required_env_vars = ["SUPA_API_URL", "SUPA_API_ANON_KEY", "VANTAGE_API_KEY"]
    missing_env = []
    
    for var in required_env_vars:
        if not os.getenv(var):
            missing_env.append(var)
    
    if missing_env:
        print(f"⚠️  Missing environment variables: {missing_env}")
        print("🔧 Setting placeholder values for documentation generation...")
        
        # Set placeholder values for documentation generation
        for var in missing_env:
            os.environ[var] = f"placeholder-{var.lower()}"
        
        print("✅ Placeholder environment variables set")
    
    return checks_passed

def main():
    """Main execution function."""
    print("🚀 MASTER DOCUMENTATION GENERATION PIPELINE")
    print("=" * 60)
    print("🎯 ZERO TOLERANCE FOR DOCUMENTATION DRIFT")
    print("🎯 ZERO TOLERANCE FOR MANUAL DOCUMENTATION")
    print("=" * 60)
    
    start_time = datetime.now()
    
    # Step 1: Pre-generation checks
    if not run_pre_generation_checks():
        print("\n❌ Pre-generation checks failed")
        print("🔧 Fix the issues above and re-run the script")
        sys.exit(1)
    
    # Step 2: Run all documentation scripts
    scripts_to_run = [
        ("generate_api_docs.py", "OpenAPI Documentation Generation"),
        ("sync_types.py", "Type Generation Automation"),
        ("security_docs_sync.py", "Security Documentation Automation")
    ]
    
    results = {}
    
    for script_name, description in scripts_to_run:
        result = run_script(script_name, description)
        results[script_name] = result
        
        if not result.get("success"):
            print(f"\n❌ {script_name} failed - continuing with other scripts...")
    
    # Step 3: Validate generated files
    missing_files = validate_generated_files()
    
    # Step 4: Generate report
    report = generate_documentation_report(results)
    
    # Save report
    report_path = Path(__file__).parent.parent / "docs" / "documentation-generation-report.md"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report)
    
    print(f"\n📊 Report saved: {report_path}")
    
    # Step 5: Final summary
    total_duration = (datetime.now() - start_time).total_seconds()
    successful_scripts = sum(1 for result in results.values() if result.get("success"))
    total_scripts = len(results)
    
    print("\n" + "=" * 60)
    print("🎉 MASTER DOCUMENTATION PIPELINE COMPLETED")
    print("=" * 60)
    print(f"⏱️  Total Duration: {total_duration:.2f} seconds")
    print(f"📊 Success Rate: {successful_scripts}/{total_scripts} ({successful_scripts/total_scripts*100:.1f}%)")
    
    if successful_scripts == total_scripts and not missing_files:
        print("✅ ALL DOCUMENTATION GENERATED SUCCESSFULLY")
        print("\n🚀 Next Steps:")
        print("   1. Review generated documentation files")
        print("   2. Commit all generated files to git")
        print("   3. Push to trigger CI validation")
        print("   4. Documentation is now fully automated!")
        
        print("\n📁 Generated Files:")
        print("   - docs/openapi.json (OpenAPI specification)")
        print("   - docs/api_doc.md (API documentation)")
        print("   - docs/security.md (Security documentation)")
        print("   - frontend/src/types/generated-api.ts (API types)")
        print("   - frontend/src/types/generated-models.ts (Model types)")
        print("   - docs/documentation-generation-report.md (This report)")
        
        print("\n🔄 To regenerate all documentation:")
        print("   python scripts/generate_all_docs.py")
        
        sys.exit(0)
    else:
        print("❌ SOME DOCUMENTATION GENERATION FAILED")
        print("\n🔧 Issues to resolve:")
        
        failed_scripts = [name for name, result in results.items() if not result.get("success")]
        if failed_scripts:
            print(f"   - Failed scripts: {', '.join(failed_scripts)}")
        
        if missing_files:
            print(f"   - Missing files: {len(missing_files)} files not generated")
        
        print("\n📋 Check the detailed report for specific errors:")
        print(f"   {report_path}")
        
        sys.exit(1)

if __name__ == "__main__":
    main()