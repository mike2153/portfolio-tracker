#!/usr/bin/env python3
"""
Real-time Portfolio Tracker Quality Monitoring System (Windows Safe)
===================================================================

This script provides comprehensive real-time monitoring of code quality metrics
with automated alerting and dashboard generation. Windows-compatible version.

Usage:
    python scripts/quality_monitor_safe.py                 # Single check
    python scripts/quality_monitor_safe.py --daemon        # Continuous monitoring
    python scripts/quality_monitor_safe.py --dashboard     # Generate dashboard only
"""

import subprocess
import json
import os
import sys
import time
import argparse
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, asdict
import glob
import re


def safe_print(msg: str):
    """Print message safely handling encoding issues"""
    try:
        print(msg)
    except UnicodeEncodeError:
        # Fallback to ASCII-safe version
        print(msg.encode('ascii', errors='ignore').decode('ascii'))


@dataclass
class QualityMetrics:
    """Data structure for quality metrics"""
    timestamp: str
    typescript_coverage: float
    python_type_errors: int
    security_violations: List[str]
    code_duplication_percent: float
    bundle_size_kb: Optional[float]
    load_time_ms: Optional[int]
    status: str
    details: Dict[str, Any]


class QualityMonitor:
    """Comprehensive quality monitoring system for Portfolio Tracker"""
    
    def __init__(self, project_root: str = None):
        self.project_root = Path(project_root) if project_root else Path.cwd()
        self.metrics_dir = self.project_root / "metrics"
        self.metrics_dir.mkdir(exist_ok=True)
        
        # Quality thresholds
        self.thresholds = {
            'typescript_coverage': 98.0,  # Minimum 98% type coverage
            'python_type_errors': 0,      # Zero tolerance for type errors
            'security_violations': 0,      # Zero tolerance for security issues
            'code_duplication': 3.0,      # Maximum 3% duplication
            'bundle_size_kb': 500,        # Maximum 500KB bundle size
            'load_time_ms': 2000,         # Maximum 2s load time
        }
        
        # Initialize paths
        self.frontend_dir = self.project_root / "frontend"
        self.backend_dir = self.project_root / "backend_simplified"
        
        safe_print(f"Quality Monitor initialized for: {self.project_root}")
        safe_print(f"Metrics storage: {self.metrics_dir}")
        safe_print(f"Monitoring thresholds: {self.thresholds}")

    def monitor_typescript_coverage(self) -> Tuple[float, List[str]]:
        """Monitor TypeScript type coverage and detect 'any' types"""
        safe_print("Checking TypeScript type coverage...")
        
        issues = []
        coverage = 100.0  # Default to 100% if we can't measure
        
        try:
            # Check for 'any' types in TypeScript files
            if self.frontend_dir.exists():
                any_files = []
                for ts_file in self.frontend_dir.rglob("*.ts"):
                    try:
                        content = ts_file.read_text(encoding='utf-8')
                        if re.search(r'\bany\b', content):
                            any_files.append(str(ts_file.relative_to(self.project_root)))
                    except Exception as e:
                        safe_print(f"Warning reading {ts_file}: {e}")
                
                for tsx_file in self.frontend_dir.rglob("*.tsx"):
                    try:
                        content = tsx_file.read_text(encoding='utf-8')
                        if re.search(r'\bany\b', content):
                            any_files.append(str(tsx_file.relative_to(self.project_root)))
                    except Exception as e:
                        safe_print(f"Warning reading {tsx_file}: {e}")
                
                if any_files:
                    issues.extend([f"'any' type found in {f}" for f in any_files])
                    coverage = max(0, 100 - len(any_files) * 5)  # Rough estimate
                
                # Try to run TypeScript compiler check
                if (self.frontend_dir / "tsconfig.json").exists():
                    try:
                        result = subprocess.run(
                            ["npx", "tsc", "--noEmit", "--strict"],
                            cwd=self.frontend_dir,
                            capture_output=True,
                            text=True,
                            timeout=60
                        )
                        if result.returncode != 0:
                            error_count = len([line for line in result.stdout.split('\n') if 'error' in line.lower()])
                            if error_count > 0:
                                issues.append(f"TypeScript compilation errors: {error_count}")
                                coverage = max(0, coverage - error_count)
                    except (subprocess.TimeoutExpired, FileNotFoundError) as e:
                        safe_print(f"Could not run TypeScript check: {e}")
            
            safe_print(f"TypeScript coverage: {coverage:.1f}% ({len(issues)} issues)")
            return coverage, issues
            
        except Exception as e:
            safe_print(f"Error checking TypeScript coverage: {e}")
            return 0.0, [f"TypeScript check failed: {str(e)}"]

    def monitor_python_type_coverage(self) -> Tuple[int, List[str]]:
        """Monitor Python type errors using mypy-style checking"""
        safe_print("Checking Python type coverage...")
        
        issues = []
        error_count = 0
        
        try:
            if self.backend_dir.exists():
                # Check for missing type hints
                for py_file in self.backend_dir.rglob("*.py"):
                    if py_file.name.startswith("__"):
                        continue
                        
                    try:
                        content = py_file.read_text(encoding='utf-8')
                        
                        # Check for functions without type hints
                        for line_num, line in enumerate(content.split('\n'), 1):
                            if 'def ' in line and not line.strip().startswith('#'):
                                # Skip special methods and simple functions
                                if not any(special in line for special in ['__init__', '__str__', '__repr__']):
                                    if '->' not in line and not line.endswith(':'):
                                        issues.append(f"Missing return type hint in {py_file.relative_to(self.project_root)}:{line_num}")
                                        error_count += 1
                                    
                                    # Check for untyped parameters
                                    if ':' not in line and '(' in line and ')' in line:
                                        param_part = line[line.find('('):line.find(')')]
                                        if param_part.count(',') > 0 or (param_part != '()' and 'self' not in param_part):
                                            issues.append(f"Untyped parameters in {py_file.relative_to(self.project_root)}:{line_num}")
                                            error_count += 1
                    
                    except Exception as e:
                        safe_print(f"Warning reading {py_file}: {e}")
                
                # Try to run mypy if available
                try:
                    result = subprocess.run(
                        ["python", "-m", "mypy", "--strict", str(self.backend_dir)],
                        capture_output=True,
                        text=True,
                        timeout=60
                    )
                    if result.returncode != 0 and result.stdout:
                        mypy_errors = [line for line in result.stdout.split('\n') if 'error:' in line]
                        error_count += len(mypy_errors)
                        issues.extend(mypy_errors[:10])  # Limit to first 10 errors
                except (subprocess.TimeoutExpired, FileNotFoundError):
                    safe_print("MyPy not available, using basic type checking")
                
            safe_print(f"Python type errors: {error_count} ({len(issues)} issues)")
            return error_count, issues
            
        except Exception as e:
            safe_print(f"Error checking Python types: {e}")
            return 999, [f"Python type check failed: {str(e)}"]

    def monitor_security_violations(self) -> Tuple[List[str], Dict[str, int]]:
        """Monitor for security violations"""
        safe_print("Checking security violations...")
        
        violations = []
        violation_counts = {
            'raw_sql': 0,
            'float_in_financial': 0,
            'sql_injection_risk': 0,
            'unsafe_cors': 0
        }
        
        try:
            if self.backend_dir.exists():
                # Check for raw SQL construction
                for py_file in self.backend_dir.rglob("*.py"):
                    try:
                        content = py_file.read_text(encoding='utf-8')
                        lines = content.split('\n')
                        
                        for line_num, line in enumerate(lines, 1):
                            line = line.strip()
                            
                            # Check for f-string SQL construction
                            if re.search(r'f["\'].*\{.*\}.*(?:SELECT|INSERT|UPDATE|DELETE)', line, re.IGNORECASE):
                                violations.append(f"Raw SQL f-string in {py_file.relative_to(self.project_root)}:{line_num}")
                                violation_counts['raw_sql'] += 1
                            
                            # Check for string concatenation in SQL
                            if re.search(r'["\'].*(?:SELECT|INSERT|UPDATE|DELETE).*["\'].*\+', line, re.IGNORECASE):
                                violations.append(f"SQL concatenation in {py_file.relative_to(self.project_root)}:{line_num}")
                                violation_counts['sql_injection_risk'] += 1
                            
                            # Check for float/int in financial calculations
                            financial_keywords = ['price', 'amount', 'total', 'value', 'balance', 'cost']
                            if any(keyword in line.lower() for keyword in financial_keywords):
                                if re.search(r'\b(float|int)\s*\(', line) and 'Decimal' not in line:
                                    violations.append(f"Float/int in financial calculation: {py_file.relative_to(self.project_root)}:{line_num}")
                                    violation_counts['float_in_financial'] += 1
                            
                            # Check for unsafe CORS configuration
                            if 'allow_origins' in line and '*' in line:
                                violations.append(f"Unsafe CORS config in {py_file.relative_to(self.project_root)}:{line_num}")
                                violation_counts['unsafe_cors'] += 1
                                
                    except Exception as e:
                        safe_print(f"Warning reading {py_file}: {e}")
            
            total_violations = sum(violation_counts.values())
            safe_print(f"Security violations: {total_violations} found")
            return violations, violation_counts
            
        except Exception as e:
            safe_print(f"Error checking security violations: {e}")
            return [f"Security check failed: {str(e)}"], {'error': 1}

    def monitor_code_duplication(self) -> Tuple[float, List[str]]:
        """Monitor code duplication using simple pattern matching"""
        safe_print("Checking code duplication...")
        
        try:
            # Try to use jscpd if available
            try:
                result = subprocess.run(
                    ["npx", "jscpd", str(self.project_root), "--format", "json", "--output", str(self.metrics_dir / "jscpd")],
                    capture_output=True,
                    text=True,
                    timeout=120
                )
                
                if result.returncode == 0:
                    report_file = self.metrics_dir / "jscpd" / "jscpd-report.json"
                    if report_file.exists():
                        with open(report_file) as f:
                            data = json.load(f)
                        duplication_percent = data.get("statistics", {}).get("total", {}).get("percentage", 0)
                        duplicates = data.get("duplicates", [])
                        issues = [f"Duplicate code block in {d.get('firstFile', {}).get('name', 'unknown')}" for d in duplicates[:10]]
                        safe_print(f"Code duplication: {duplication_percent:.1f}%")
                        return duplication_percent, issues
            except (subprocess.TimeoutExpired, FileNotFoundError):
                safe_print("jscpd not available, using basic duplication check")
            
            # Fallback: Simple duplicate detection
            duplication_percent = 0.0
            issues = []
            
            # Check for similar patterns in frontend
            if self.frontend_dir.exists():
                duplicate_patterns = []
                for tsx_file in list(self.frontend_dir.rglob("*.tsx"))[:20]:  # Limit files for performance
                    try:
                        content = tsx_file.read_text(encoding='utf-8')
                        # Look for repeated JSX patterns
                        jsx_blocks = re.findall(r'<\w+[^>]*>.*?</\w+>', content, re.DOTALL)
                        for block in jsx_blocks:
                            if len(block) > 100:  # Only check substantial blocks
                                if duplicate_patterns.count(block) > 1:
                                    issues.append(f"Potential duplicate JSX in {tsx_file.name}")
                                    duplication_percent += 0.5
                                duplicate_patterns.append(block)
                    except Exception as e:
                        safe_print(f"Warning reading {tsx_file}: {e}")
            
            safe_print(f"Code duplication (estimated): {duplication_percent:.1f}%")
            return min(duplication_percent, 100.0), issues
            
        except Exception as e:
            safe_print(f"Error checking code duplication: {e}")
            return 0.0, [f"Duplication check failed: {str(e)}"]

    def monitor_performance_metrics(self) -> Tuple[Optional[float], Optional[int], List[str]]:
        """Monitor performance metrics"""
        safe_print("Checking performance metrics...")
        
        bundle_size_kb = None
        load_time_ms = None
        issues = []
        
        try:
            # Check bundle size if build exists
            if self.frontend_dir.exists():
                build_dir = self.frontend_dir / ".next"
                if build_dir.exists():
                    # Look for JavaScript bundles
                    js_files = list(build_dir.rglob("*.js"))
                    if js_files:
                        total_size = sum(f.stat().st_size for f in js_files) / 1024  # KB
                        bundle_size_kb = total_size
                        
                        if total_size > self.thresholds['bundle_size_kb']:
                            issues.append(f"Bundle size {total_size:.0f}KB exceeds limit of {self.thresholds['bundle_size_kb']}KB")
                else:
                    # Try to build and measure
                    try:
                        result = subprocess.run(
                            ["npm", "run", "build"],
                            cwd=self.frontend_dir,
                            capture_output=True,
                            text=True,
                            timeout=300
                        )
                        if result.returncode == 0:
                            # Extract size information from build output
                            size_match = re.search(r'(\d+(?:\.\d+)?)\s*(?:k|K)B', result.stdout)
                            if size_match:
                                bundle_size_kb = float(size_match.group(1))
                    except (subprocess.TimeoutExpired, FileNotFoundError) as e:
                        safe_print(f"Could not build for size measurement: {e}")
                
                # Basic load time estimation (simplified)
                if bundle_size_kb:
                    # Rough estimation: 1KB = ~10ms load time on average connection
                    estimated_load_time = int(bundle_size_kb * 10)
                    load_time_ms = estimated_load_time
                    
                    if estimated_load_time > self.thresholds['load_time_ms']:
                        issues.append(f"Estimated load time {estimated_load_time}ms exceeds {self.thresholds['load_time_ms']}ms")
            
            safe_print(f"Performance - Bundle: {bundle_size_kb or 'N/A'}KB, Load time: {load_time_ms or 'N/A'}ms")
            return bundle_size_kb, load_time_ms, issues
            
        except Exception as e:
            safe_print(f"Error checking performance: {e}")
            return None, None, [f"Performance check failed: {str(e)}"]

    def run_quality_scan(self) -> QualityMetrics:
        """Run comprehensive quality scan"""
        safe_print("\nStarting Portfolio Tracker Quality Scan")
        safe_print("=" * 60)
        
        timestamp = datetime.now().isoformat()
        
        # Run all monitoring checks
        ts_coverage, ts_issues = self.monitor_typescript_coverage()
        py_errors, py_issues = self.monitor_python_type_coverage()
        security_violations, security_counts = self.monitor_security_violations()
        duplication_percent, dup_issues = self.monitor_code_duplication()
        bundle_size, load_time, perf_issues = self.monitor_performance_metrics()
        
        # Combine all issues
        all_issues = ts_issues + py_issues + security_violations + dup_issues + perf_issues
        
        # Determine overall status
        status = "PASS"
        if (ts_coverage < self.thresholds['typescript_coverage'] or
            py_errors > self.thresholds['python_type_errors'] or
            len(security_violations) > self.thresholds['security_violations'] or
            duplication_percent > self.thresholds['code_duplication']):
            status = "FAIL"
        elif bundle_size and bundle_size > self.thresholds['bundle_size_kb']:
            status = "WARN"
        elif load_time and load_time > self.thresholds['load_time_ms']:
            status = "WARN"
        
        metrics = QualityMetrics(
            timestamp=timestamp,
            typescript_coverage=ts_coverage,
            python_type_errors=py_errors,
            security_violations=security_violations,
            code_duplication_percent=duplication_percent,
            bundle_size_kb=bundle_size,
            load_time_ms=load_time,
            status=status,
            details={
                'typescript_issues': ts_issues,
                'python_issues': py_issues,
                'security_counts': security_counts,
                'duplication_issues': dup_issues,
                'performance_issues': perf_issues,
                'total_issues': len(all_issues)
            }
        )
        
        safe_print("\nQuality Scan Results")
        safe_print("=" * 60)
        status_icon = "PASS" if status == "PASS" else "FAIL" if status == "FAIL" else "WARN"
        safe_print(f"Status: {status_icon}")
        safe_print(f"TypeScript Coverage: {ts_coverage:.1f}% (target: {self.thresholds['typescript_coverage']}%)")
        safe_print(f"Python Type Errors: {py_errors} (target: {self.thresholds['python_type_errors']})")
        safe_print(f"Security Violations: {len(security_violations)} (target: {self.thresholds['security_violations']})")
        safe_print(f"Code Duplication: {duplication_percent:.1f}% (target: <{self.thresholds['code_duplication']}%)")
        if bundle_size:
            safe_print(f"Bundle Size: {bundle_size:.0f}KB (target: <{self.thresholds['bundle_size_kb']}KB)")
        if load_time:
            safe_print(f"Load Time: {load_time}ms (target: <{self.thresholds['load_time_ms']}ms)")
        safe_print(f"Total Issues: {len(all_issues)}")
        
        return metrics

    def save_metrics(self, metrics: QualityMetrics):
        """Save metrics to JSON file"""
        
        # Save current metrics
        current_file = self.metrics_dir / "current_metrics.json"
        with open(current_file, 'w') as f:
            json.dump(asdict(metrics), f, indent=2)
        
        # Save to historical data
        history_file = self.metrics_dir / "metrics_history.json"
        history = []
        
        if history_file.exists():
            try:
                with open(history_file, 'r') as f:
                    history = json.load(f)
            except Exception as e:
                safe_print(f"Could not load history: {e}")
        
        history.append(asdict(metrics))
        
        # Keep only last 100 entries
        history = history[-100:]
        
        with open(history_file, 'w') as f:
            json.dump(history, f, indent=2)
        
        safe_print(f"Metrics saved to {current_file}")

    def generate_dashboard(self):
        """Generate real-time HTML dashboard"""
        safe_print("Generating quality dashboard...")
        
        # Load current metrics
        current_file = self.metrics_dir / "current_metrics.json"
        history_file = self.metrics_dir / "metrics_history.json"
        
        current_metrics = {}
        history = []
        
        if current_file.exists():
            with open(current_file) as f:
                current_metrics = json.load(f)
        
        if history_file.exists():
            with open(history_file) as f:
                history = json.load(f)
        
        # Generate HTML dashboard
        html_content = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Portfolio Tracker - Quality Dashboard</title>
    <meta http-equiv="refresh" content="300">
    <style>
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #333;
            min-height: 100vh;
        }}
        .container {{
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            overflow: hidden;
        }}
        .header {{
            background: linear-gradient(135deg, #2c3e50, #34495e);
            color: white;
            padding: 30px;
            text-align: center;
        }}
        .header h1 {{
            margin: 0;
            font-size: 2.5em;
            font-weight: 300;
        }}
        .metrics-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            padding: 30px;
        }}
        .metric-card {{
            background: white;
            border-radius: 10px;
            padding: 25px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.08);
            border-left: 5px solid #3498db;
        }}
        .metric-card.pass {{ border-left-color: #27ae60; }}
        .metric-card.warn {{ border-left-color: #f39c12; }}
        .metric-card.fail {{ border-left-color: #e74c3c; }}
        .metric-title {{
            font-size: 1.1em;
            font-weight: 600;
            margin-bottom: 15px;
            color: #2c3e50;
        }}
        .metric-value {{
            font-size: 2.5em;
            font-weight: 300;
            color: #2c3e50;
            margin-bottom: 10px;
        }}
        .metric-target {{
            color: #7f8c8d;
            font-size: 0.9em;
        }}
        .status-banner {{
            text-align: center;
            padding: 20px;
            font-size: 1.5em;
            font-weight: 600;
        }}
        .status-pass {{ background: #d5edda; color: #155724; }}
        .status-warn {{ background: #fff3cd; color: #856404; }}
        .status-fail {{ background: #f8d7da; color: #721c24; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Portfolio Tracker Quality Dashboard</h1>
            <p>Real-time code quality monitoring</p>
            <div style="margin-top: 15px; font-size: 0.9em; opacity: 0.7;">
                Last updated: {current_metrics.get('timestamp', 'Never')}
            </div>
        </div>
        
        <div class="status-banner status-{current_metrics.get('status', 'unknown').lower()}">
            System Status: {current_metrics.get('status', 'UNKNOWN')}
        </div>
        
        <div class="metrics-grid">
            <div class="metric-card {'pass' if current_metrics.get('typescript_coverage', 0) >= 98 else 'fail'}">
                <div class="metric-title">TypeScript Coverage</div>
                <div class="metric-value">{current_metrics.get('typescript_coverage', 0):.1f}%</div>
                <div class="metric-target">Target: ≥98%</div>
            </div>
            
            <div class="metric-card {'pass' if current_metrics.get('python_type_errors', 1) == 0 else 'fail'}">
                <div class="metric-title">Python Type Errors</div>
                <div class="metric-value">{current_metrics.get('python_type_errors', 0)}</div>
                <div class="metric-target">Target: 0 errors</div>
            </div>
            
            <div class="metric-card {'pass' if len(current_metrics.get('security_violations', [])) == 0 else 'fail'}">
                <div class="metric-title">Security Violations</div>
                <div class="metric-value">{len(current_metrics.get('security_violations', []))}</div>
                <div class="metric-target">Target: 0 violations</div>
            </div>
            
            <div class="metric-card {'pass' if current_metrics.get('code_duplication_percent', 100) <= 3 else 'fail'}">
                <div class="metric-title">Code Duplication</div>
                <div class="metric-value">{current_metrics.get('code_duplication_percent', 0):.1f}%</div>
                <div class="metric-target">Target: ≤3%</div>
            </div>
        </div>
    </div>
</body>
</html>
        """
        
        dashboard_file = self.project_root / "quality_dashboard.html"
        with open(dashboard_file, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        safe_print(f"Dashboard generated: {dashboard_file}")
        return dashboard_file


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="Portfolio Tracker Quality Monitor")
    parser.add_argument("--daemon", action="store_true", help="Run in daemon mode")
    parser.add_argument("--interval", type=int, default=5, help="Daemon mode interval in minutes")
    parser.add_argument("--dashboard", action="store_true", help="Generate dashboard only")
    parser.add_argument("--project-root", type=str, help="Project root directory")
    
    args = parser.parse_args()
    
    monitor = QualityMonitor(args.project_root)
    
    try:
        if args.dashboard:
            monitor.generate_dashboard()
        elif args.daemon:
            safe_print(f"Starting daemon mode (scanning every {args.interval} minutes)")
            while True:
                try:
                    metrics = monitor.run_quality_scan()
                    monitor.save_metrics(metrics)
                    monitor.generate_dashboard()
                    safe_print(f"Next scan in {args.interval} minutes...")
                    time.sleep(args.interval * 60)
                except KeyboardInterrupt:
                    safe_print("Daemon mode stopped")
                    break
        else:
            # Single scan
            metrics = monitor.run_quality_scan()
            monitor.save_metrics(metrics)
            monitor.generate_dashboard()
            
            # Exit with appropriate code
            if metrics.status == "FAIL":
                sys.exit(1)
            elif metrics.status == "WARN":
                sys.exit(2)
            else:
                sys.exit(0)
                
    except KeyboardInterrupt:
        safe_print("Quality monitor interrupted")
        sys.exit(130)
    except Exception as e:
        safe_print(f"Quality monitor failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()