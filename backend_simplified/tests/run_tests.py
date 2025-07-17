#!/usr/bin/env python3
"""
Test runner for PriceManager test suite
Provides options for running different test categories with coverage reporting
"""
import sys
import subprocess
import argparse
from pathlib import Path


def run_tests(test_type='all', verbose=False, coverage=False, markers=None):
    """Run tests with specified options"""
    cmd = ['pytest']
    
    # Add test directory based on type
    test_dir = Path(__file__).parent
    if test_type == 'unit':
        cmd.append(str(test_dir / 'unit'))
    elif test_type == 'integration':
        cmd.append(str(test_dir / 'integration'))
    elif test_type == 'performance':
        cmd.append(str(test_dir / 'performance'))
    elif test_type == 'e2e':
        cmd.append(str(test_dir / 'e2e'))
    else:
        cmd.append(str(test_dir))
    
    # Add verbosity
    if verbose:
        cmd.append('-vv')
    else:
        cmd.append('-v')
    
    # Add coverage
    if coverage:
        cmd.extend([
            '--cov=services.current_price_manager',
            '--cov=services.market_status_service',
            '--cov=vantage_api',
            '--cov=supa_api',
            '--cov-report=term-missing',
            '--cov-report=html:coverage_report'
        ])
    
    # Add markers if specified
    if markers:
        cmd.extend(['-m', markers])
    
    # Add color output
    cmd.append('--color=yes')
    
    # Show test durations
    cmd.append('--durations=10')
    
    # Run tests
    print(f"Running command: {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=test_dir.parent)
    
    return result.returncode


def main():
    parser = argparse.ArgumentParser(description='Run PriceManager tests')
    parser.add_argument(
        'type',
        nargs='?',
        default='all',
        choices=['all', 'unit', 'integration', 'performance', 'e2e'],
        help='Type of tests to run (default: all)'
    )
    parser.add_argument(
        '-v', '--verbose',
        action='store_true',
        help='Verbose output'
    )
    parser.add_argument(
        '-c', '--coverage',
        action='store_true',
        help='Generate coverage report'
    )
    parser.add_argument(
        '-m', '--markers',
        help='Pytest markers to filter tests (e.g., "not slow")'
    )
    parser.add_argument(
        '--quick',
        action='store_true',
        help='Run only quick tests (excludes performance tests)'
    )
    
    args = parser.parse_args()
    
    # Handle quick mode
    if args.quick:
        args.markers = 'not slow and not performance'
    
    # Run tests
    exit_code = run_tests(
        test_type=args.type,
        verbose=args.verbose,
        coverage=args.coverage,
        markers=args.markers
    )
    
    # Print coverage report location if generated
    if args.coverage and exit_code == 0:
        print("\nCoverage report generated at: coverage_report/index.html")
    
    sys.exit(exit_code)


if __name__ == '__main__':
    main()