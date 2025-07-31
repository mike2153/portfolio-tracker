#!/usr/bin/env python3
"""
CI/CD Quality Gate Integration
==============================

This script integrates the quality monitoring system with CI/CD pipelines.
It enforces quality standards and blocks deployments that violate thresholds.

Usage:
    python scripts/ci_quality_gate.py                    # Run quality gate check
    python scripts/ci_quality_gate.py --strict           # Strict mode (fail on warnings)
    python scripts/ci_quality_gate.py --generate-config  # Generate CI/CD config files
"""

import json
import sys
import argparse
from pathlib import Path
from quality_monitor import BulletproofQualityMonitor


class CIQualityGate:
    """CI/CD Quality Gate enforcement"""
    
    def __init__(self, project_root: str = None, strict_mode: bool = False):
        self.project_root = Path(project_root) if project_root else Path.cwd()
        self.strict_mode = strict_mode
        self.monitor = BulletproofQualityMonitor()
        
        print(f"CI/CD Quality Gate initialized")
        print(f"Project root: {self.project_root}")
        print(f"Strict mode: {'ENABLED' if strict_mode else 'DISABLED'}")

    def run_quality_gate(self) -> bool:
        """Run quality gate check and return pass/fail status"""
        print("\nRunning CI/CD Quality Gate Check")
        print("=" * 60)
        
        # Run comprehensive quality scan
        metrics = self.monitor.run_comprehensive_scan()
        
        # Save metrics for CI artifacts
        self.monitor.save_metrics(metrics)
        
        # Generate dashboard for CI artifacts
        self.monitor.generate_dashboard(metrics)
        
        # Determine pass/fail status
        passed = self._evaluate_quality_gate(metrics)
        
        # Generate CI report
        self._generate_ci_report(metrics, passed)
        
        if passed:
            print("\nQUALITY GATE PASSED")
            print("Deployment authorized - all quality standards met")
        else:
            print("\nQUALITY GATE FAILED")
            print("Deployment blocked - quality violations detected")
            self.monitor.send_alerts(metrics)
        
        return passed

    def _evaluate_quality_gate(self, metrics) -> bool:
        """Evaluate whether quality gate should pass"""
        
        # Critical failures (always block deployment)
        critical_failures = []
        
        if metrics.type_safety['typescript_coverage'] < self.monitor.THRESHOLDS['typescript_coverage_min']:
            critical_failures.append(f"TypeScript coverage {metrics.type_safety['typescript_coverage']:.1f}% below threshold")
        
        if metrics.type_safety['python_type_errors'] > self.monitor.THRESHOLDS['python_type_errors_max']:
            critical_failures.append(f"Python type errors: {metrics.type_safety['python_type_errors']}")
        
        if metrics.type_safety['any_type_count'] > self.monitor.THRESHOLDS['any_type_count_max']:
            critical_failures.append(f"'any' type count: {metrics.type_safety['any_type_count']} (zero tolerance)")
        
        if metrics.security['sql_injection_vulns'] > self.monitor.THRESHOLDS['sql_injection_vulns_max']:
            critical_failures.append(f"SQL injection vulnerabilities: {metrics.security['sql_injection_vulns']}")
        
        if metrics.code_quality['duplication_percent'] > self.monitor.THRESHOLDS['duplication_percent_max']:
            critical_failures.append(f"Code duplication {metrics.code_quality['duplication_percent']:.1f}% above threshold")
        
        # Warning conditions (block in strict mode only)
        warnings = []
        
        if metrics.performance['bundle_size_kb'] and metrics.performance['bundle_size_kb'] > self.monitor.THRESHOLDS['bundle_size_kb_max']:
            warnings.append(f"Bundle size {metrics.performance['bundle_size_kb']:.0f}KB exceeds recommended limit")
        
        if metrics.performance['load_time_ms'] and metrics.performance['load_time_ms'] > self.monitor.THRESHOLDS['load_time_ms_max']:
            warnings.append(f"Load time {metrics.performance['load_time_ms']}ms exceeds recommended limit")
        
        # Print evaluation results
        if critical_failures:
            print(f"\nCritical failures detected ({len(critical_failures)}):")
            for failure in critical_failures:
                print(f"  - {failure}")
        
        if warnings:
            print(f"\nWarnings detected ({len(warnings)}):")
            for warning in warnings:
                print(f"  - {warning}")
        
        # Determine pass/fail
        has_critical_failures = len(critical_failures) > 0
        has_warnings = len(warnings) > 0
        
        if has_critical_failures:
            return False
        elif has_warnings and self.strict_mode:
            print("\nStrict mode enabled - warnings treated as failures")
            return False
        else:
            return True

    def _generate_ci_report(self, metrics, passed: bool):
        """Generate CI-friendly report"""
        
        report = {
            "quality_gate_status": "PASS" if passed else "FAIL",
            "timestamp": metrics.timestamp,
            "strict_mode": self.strict_mode,
            "metrics": {
                "typescript_coverage": metrics.type_safety['typescript_coverage'],
                "python_type_errors": metrics.type_safety['python_type_errors'],
                "any_type_count": metrics.type_safety['any_type_count'],
                "security_violations_count": metrics.security['sql_injection_vulns'],
                "code_duplication_percent": metrics.code_quality['duplication_percent'],
                "bundle_size_kb": metrics.performance['bundle_size_kb'],
                "load_time_ms": metrics.performance['load_time_ms']
            },
            "thresholds": self.monitor.THRESHOLDS,
            "overall_status": metrics.overall_status
        }
        
        # Save report for CI artifacts
        report_file = self.project_root / "metrics" / "ci_quality_report.json"
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"\nCI quality report saved: {report_file}")
        
        # Generate JUnit XML format for CI integration
        self._generate_junit_report(metrics, passed)

    def _generate_junit_report(self, metrics, passed: bool):
        """Generate JUnit XML report for CI systems"""
        
        test_count = 7  # Number of quality checks
        failure_count = 0
        failures_xml = ""
        
        # Check each metric
        checks = [
            ("TypeScript Coverage", metrics.type_safety['typescript_coverage'] >= self.monitor.THRESHOLDS['typescript_coverage_min'], 
             f"Coverage {metrics.type_safety['typescript_coverage']:.1f}% below threshold {self.monitor.THRESHOLDS['typescript_coverage_min']}%"),
            ("Python Type Safety", metrics.type_safety['python_type_errors'] <= self.monitor.THRESHOLDS['python_type_errors_max'],
             f"Found {metrics.type_safety['python_type_errors']} type errors"),
            ("Any Type Usage", metrics.type_safety['any_type_count'] <= self.monitor.THRESHOLDS['any_type_count_max'],
             f"Found {metrics.type_safety['any_type_count']} 'any' types (zero tolerance)"),
            ("Security Violations", metrics.security['sql_injection_vulns'] <= self.monitor.THRESHOLDS['sql_injection_vulns_max'],
             f"Found {metrics.security['sql_injection_vulns']} security violations"),
            ("Code Duplication", metrics.code_quality['duplication_percent'] <= self.monitor.THRESHOLDS['duplication_percent_max'],
             f"Duplication {metrics.code_quality['duplication_percent']:.1f}% above threshold"),
            ("Bundle Size", not metrics.performance['bundle_size_kb'] or metrics.performance['bundle_size_kb'] <= self.monitor.THRESHOLDS['bundle_size_kb_max'],
             f"Bundle size {metrics.performance['bundle_size_kb'] or 0:.0f}KB exceeds limit"),
            ("Load Time", not metrics.performance['load_time_ms'] or metrics.performance['load_time_ms'] <= self.monitor.THRESHOLDS['load_time_ms_max'],
             f"Load time {metrics.performance['load_time_ms'] or 0}ms exceeds limit")
        ]
        
        for check_name, passed_check, failure_message in checks:
            if not passed_check:
                failure_count += 1
                failures_xml += f'''
    <testcase classname="QualityGate" name="{check_name}">
      <failure message="{failure_message}" type="QualityViolation">
        {failure_message}
      </failure>
    </testcase>'''
            else:
                failures_xml += f'''
    <testcase classname="QualityGate" name="{check_name}" />'''
        
        junit_xml = f'''<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="QualityGate" tests="{test_count}" failures="{failure_count}" errors="0" time="0">
{failures_xml}
</testsuite>'''
        
        junit_file = self.project_root / "metrics" / "quality_gate_junit.xml"
        with open(junit_file, 'w') as f:
            f.write(junit_xml)
        
        print(f"JUnit report saved: {junit_file}")

    def generate_ci_config(self):
        """Generate CI/CD configuration files"""
        print("Generating CI/CD configuration files...")
        
        # GitHub Actions workflow
        github_workflow = '''name: Quality Gate Enforcement

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  quality-gate:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'
    
    - name: Set up Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
    
    - name: Install monitoring dependencies
      run: |
        pip install mypy
        npm install -g jscpd type-coverage
    
    - name: Install project dependencies
      run: |
        cd frontend && npm install
        # Add backend dependency installation if needed
    
    - name: Run Quality Gate Check
      run: python scripts/ci_quality_gate.py --strict
    
    - name: Upload Quality Report
      uses: actions/upload-artifact@v3
      if: always()
      with:
        name: quality-report
        path: |
          metrics/ci_quality_report.json
          metrics/quality_gate_junit.xml
          quality_dashboard.html
    
    - name: Publish Test Results
      uses: dorny/test-reporter@v1
      if: always()
      with:
        name: Quality Gate Results
        path: metrics/quality_gate_junit.xml
        reporter: java-junit
'''
        
        # Create .github/workflows directory
        github_dir = self.project_root / ".github" / "workflows"
        github_dir.mkdir(parents=True, exist_ok=True)
        
        workflow_file = github_dir / "quality-gate.yml"
        with open(workflow_file, 'w') as f:
            f.write(github_workflow)
        
        print(f"GitHub Actions workflow: {workflow_file}")
        
        # Pre-commit hook
        pre_commit_hook = '''#!/bin/sh
# Quality Gate Pre-commit Hook
# This hook runs quality checks before allowing commits

echo "Running quality gate check..."

python scripts/ci_quality_gate.py

if [ $? -ne 0 ]; then
    echo "Quality gate failed - commit blocked"
    echo "Run 'npm run quality:check' to see detailed issues"
    exit 1
fi

echo "Quality gate passed - commit allowed"
'''
        
        # Create .git/hooks directory and hook file
        hooks_dir = self.project_root / ".git" / "hooks"
        if hooks_dir.exists():
            hook_file = hooks_dir / "pre-commit"
            with open(hook_file, 'w') as f:
                f.write(pre_commit_hook)
            
            # Make hook executable
            import os
            os.chmod(hook_file, 0o755)
            print(f"Pre-commit hook: {hook_file}")
        else:
            print(".git/hooks directory not found - skipping pre-commit hook")
        
        # Docker health check script
        docker_healthcheck = '''#!/bin/bash
# Docker Health Check for Quality Monitoring

python scripts/quality_monitor.py --dashboard > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "Quality monitoring healthy"
    exit 0
else
    echo "Quality monitoring unhealthy" 
    exit 1
fi
'''
        
        docker_script = self.project_root / "scripts" / "docker_healthcheck.sh"
        with open(docker_script, 'w') as f:
            f.write(docker_healthcheck)
        
        import os
        os.chmod(docker_script, 0o755)
        print(f"Docker health check: {docker_script}")
        
        print("\nCI/CD configuration files generated successfully!")
        print("\nNext steps:")
        print("1. Commit the generated workflow files")
        print("2. Push to trigger the first quality gate check")
        print("3. Monitor quality dashboard for continuous feedback")


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="CI/CD Quality Gate")
    parser.add_argument("--strict", action="store_true", help="Strict mode (warnings treated as failures)")
    parser.add_argument("--generate-config", action="store_true", help="Generate CI/CD configuration files")
    parser.add_argument("--project-root", type=str, help="Project root directory")
    
    args = parser.parse_args()
    
    gate = CIQualityGate(args.project_root, args.strict)
    
    try:
        if args.generate_config:
            gate.generate_ci_config()
        else:
            passed = gate.run_quality_gate()
            sys.exit(0 if passed else 1)
            
    except KeyboardInterrupt:
        print("\nQuality gate interrupted")
        sys.exit(130)
    except Exception as e:
        print(f"Quality gate failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()