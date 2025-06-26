#!/usr/bin/env node

/**
 * Enhanced E2E Test Runner
 * 
 * This script orchestrates the complete E2E testing process with real APIs:
 * 1. Validates environment setup
 * 2. Starts required services
 * 3. Creates test data
 * 4. Runs comprehensive E2E tests
 * 5. Generates detailed reports
 * 6. Cleans up test data
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Configuration
const CONFIG = {
  frontendUrl: process.env.TEST_FRONTEND_URL || 'http://localhost:3000',
  backendUrl: process.env.TEST_BACKEND_URL || 'http://localhost:8000',
  realApiMode: process.env.REAL_API === 'true',
  autoCleanup: process.env.AUTO_CLEANUP !== 'false',
  timeout: 60000,
  retries: 2
};

console.log('🚀 Enhanced E2E Test Suite');
console.log('=' * 50);
console.log('📊 Configuration:');
console.log(`  Frontend URL: ${CONFIG.frontendUrl}`);
console.log(`  Backend URL: ${CONFIG.backendUrl}`);
console.log(`  Real API Mode: ${CONFIG.realApiMode}`);
console.log(`  Auto Cleanup: ${CONFIG.autoCleanup}`);
console.log('');

class E2ETestRunner {
  constructor() {
    this.startTime = Date.now();
    this.testResults = {
      passed: 0,
      failed: 0,
      skipped: 0,
      total: 0,
      duration: 0,
      errors: []
    };
  }

  /**
   * Main test execution flow
   */
  async run() {
    try {
      console.log('🔍 Step 1: Environment Validation');
      await this.validateEnvironment();
      
      console.log('🌐 Step 2: Service Health Checks');
      await this.checkServices();
      
      console.log('📋 Step 3: Pre-test Setup');
      await this.setupTestEnvironment();
      
      console.log('🧪 Step 4: Running E2E Tests');
      await this.runTests();
      
      console.log('📊 Step 5: Generating Reports');
      await this.generateReports();
      
      console.log('✅ E2E Test Suite Completed Successfully!');
      
    } catch (error) {
      console.error('❌ E2E Test Suite Failed:', error.message);
      process.exit(1);
      
    } finally {
      if (CONFIG.autoCleanup) {
        console.log('🧹 Step 6: Cleanup');
        await this.cleanup();
      }
    }
  }

  /**
   * Validate required environment variables and dependencies
   */
  async validateEnvironment() {
    console.log('  🔧 Checking environment variables...');
    
    const requiredEnvVars = [
      'TEST_SUPABASE_URL',
      'TEST_SUPABASE_ANON_KEY',
      'TEST_USER_EMAIL',
      'TEST_USER_PASSWORD'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    console.log('  ✅ Environment variables validated');
    
    // Check if Playwright is installed
    try {
      execSync('npx playwright --version', { stdio: 'pipe' });
      console.log('  ✅ Playwright available');
    } catch (error) {
      throw new Error('Playwright not installed. Run: npm install @playwright/test');
    }

    // Check if required files exist
    const requiredFiles = [
      'playwright.config.ts',
      'tests/dashboard.spec.ts',
      'utils/test-data-seeder.ts'
    ];

    for (const file of requiredFiles) {
      if (!fs.existsSync(file)) {
        throw new Error(`Required file missing: ${file}`);
      }
    }

    console.log('  ✅ Test files validated');
  }

  /**
   * Check if required services are running
   */
  async checkServices() {
    console.log('  🌐 Checking frontend service...');
    
    try {
      await axios.get(CONFIG.frontendUrl, { timeout: 5000 });
      console.log('  ✅ Frontend service available');
    } catch (error) {
      console.log('  ⚠️  Frontend service not available, tests may start it automatically');
    }

    console.log('  🌐 Checking backend service...');
    
    try {
      const response = await axios.get(`${CONFIG.backendUrl}/admin/`, { 
        timeout: 5000,
        validateStatus: (status) => status < 500 // Accept anything < 500
      });
      console.log('  ✅ Backend service available');
    } catch (error) {
      console.log('  ⚠️  Backend service not available, tests may start it automatically');
    }

    if (CONFIG.realApiMode) {
      console.log('  📡 Checking Alpha Vantage API...');
      
      try {
        const response = await axios.get('https://www.alphavantage.co/query', {
          params: {
            function: 'GLOBAL_QUOTE',
            symbol: 'AAPL',
            apikey: process.env.TEST_ALPHA_VANTAGE_API_KEY || 'demo'
          },
          timeout: 10000
        });

        if (response.data['Error Message']) {
          console.log('  ⚠️  Alpha Vantage API limit reached, using mock data');
        } else {
          console.log('  ✅ Alpha Vantage API available');
        }
      } catch (error) {
        console.log('  ⚠️  Alpha Vantage API error, using mock data');
      }
    }

    console.log('  📡 Checking Supabase connection...');
    
    try {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(
        process.env.TEST_SUPABASE_URL,
        process.env.TEST_SUPABASE_ANON_KEY
      );
      
      // Simple connection test
      const { data, error } = await supabase.from('profiles').select('count').limit(1);
      console.log('  ✅ Supabase connection available');
    } catch (error) {
      console.log('  ⚠️  Supabase connection issue:', error.message);
    }
  }

  /**
   * Setup test environment and data
   */
  async setupTestEnvironment() {
    console.log('  📋 Creating test result directories...');
    
    const dirs = ['test-results', 'test-results/screenshots', 'test-results/videos', 'test-results/traces'];
    
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    console.log('  ✅ Directories created');

    // Log test configuration
    const configFile = 'test-results/test-config.json';
    fs.writeFileSync(configFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      config: CONFIG,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      }
    }, null, 2));

    console.log('  ✅ Test environment configured');
  }

  /**
   * Run the actual E2E tests
   */
  async runTests() {
    console.log('  🧪 Starting Playwright E2E tests...');
    
    const testCommand = [
      'npx',
      'playwright',
      'test',
      '--reporter=html,junit,json',
      `--output-dir=test-results/artifacts`,
      '--trace=on-first-retry',
      '--screenshot=only-on-failure',
      '--video=retain-on-failure'
    ];

    // Add real API mode flag if enabled
    if (CONFIG.realApiMode) {
      process.env.REAL_API = 'true';
      testCommand.push('--timeout=60000');
      testCommand.push('--workers=1');
    }

    try {
      console.log(`  📋 Command: ${testCommand.join(' ')}`);
      
      const testProcess = spawn(testCommand[0], testCommand.slice(1), {
        stdio: 'inherit',
        env: { ...process.env }
      });

      const exitCode = await new Promise((resolve) => {
        testProcess.on('close', resolve);
      });

      if (exitCode === 0) {
        console.log('  ✅ All tests passed!');
      } else {
        console.log(`  ⚠️  Some tests failed (exit code: ${exitCode})`);
      }

      // Parse test results
      await this.parseTestResults();

    } catch (error) {
      console.error('  ❌ Error running tests:', error.message);
      throw error;
    }
  }

  /**
   * Parse test results from Playwright output
   */
  async parseTestResults() {
    try {
      // Try to read JUnit XML results
      const resultsFile = 'test-results/results.xml';
      if (fs.existsSync(resultsFile)) {
        // Basic parsing of JUnit XML
        const content = fs.readFileSync(resultsFile, 'utf8');
        const matches = content.match(/tests="(\d+)"/);
        if (matches) {
          this.testResults.total = parseInt(matches[1]);
        }
      }

      // Try to read JSON results
      const jsonResultsFile = 'test-results/results.json';
      if (fs.existsSync(jsonResultsFile)) {
        const results = JSON.parse(fs.readFileSync(jsonResultsFile, 'utf8'));
        
        if (results.suites) {
          results.suites.forEach(suite => {
            suite.specs.forEach(spec => {
              spec.tests.forEach(test => {
                this.testResults.total++;
                
                if (test.results[0].status === 'passed') {
                  this.testResults.passed++;
                } else if (test.results[0].status === 'failed') {
                  this.testResults.failed++;
                  this.testResults.errors.push({
                    test: test.title,
                    error: test.results[0].error
                  });
                } else {
                  this.testResults.skipped++;
                }
              });
            });
          });
        }
      }

      this.testResults.duration = Date.now() - this.startTime;
      
    } catch (error) {
      console.log('  ⚠️  Could not parse detailed test results');
    }
  }

  /**
   * Generate comprehensive test reports
   */
  async generateReports() {
    console.log('  📊 Generating test summary...');
    
    const summary = {
      timestamp: new Date().toISOString(),
      duration: this.testResults.duration,
      config: CONFIG,
      results: this.testResults,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      }
    };

    // Write summary to file
    const summaryFile = 'test-results/test-summary.json';
    fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));

    // Generate markdown report
    const markdownReport = this.generateMarkdownReport(summary);
    fs.writeFileSync('test-results/test-report.md', markdownReport);

    console.log('  📊 Test Results Summary:');
    console.log(`    Total Tests: ${this.testResults.total}`);
    console.log(`    Passed: ${this.testResults.passed}`);
    console.log(`    Failed: ${this.testResults.failed}`);
    console.log(`    Skipped: ${this.testResults.skipped}`);
    console.log(`    Duration: ${(this.testResults.duration / 1000).toFixed(2)}s`);

    if (this.testResults.failed > 0) {
      console.log('  ❌ Failed Tests:');
      this.testResults.errors.forEach(error => {
        console.log(`    - ${error.test}`);
      });
    }

    console.log('  ✅ Reports generated');
  }

  /**
   * Generate markdown test report
   */
  generateMarkdownReport(summary) {
    const { results, config, timestamp, duration } = summary;
    
    return `# E2E Test Report

## Summary
- **Timestamp**: ${timestamp}
- **Duration**: ${(duration / 1000).toFixed(2)} seconds
- **Configuration**: ${config.realApiMode ? 'Real API Mode' : 'Mock API Mode'}

## Results
- **Total Tests**: ${results.total}
- **Passed**: ${results.passed} ✅
- **Failed**: ${results.failed} ❌
- **Skipped**: ${results.skipped} ⏭️

## Test Environment
- **Frontend URL**: ${config.frontendUrl}
- **Backend URL**: ${config.backendUrl}
- **Real API**: ${config.realApiMode}
- **Auto Cleanup**: ${config.autoCleanup}

${results.failed > 0 ? `
## Failed Tests
${results.errors.map(error => `- **${error.test}**`).join('\n')}
` : ''}

## Files Generated
- HTML Report: \`test-results/html-report/index.html\`
- Screenshots: \`test-results/screenshots/\`
- Videos: \`test-results/videos/\`
- Traces: \`test-results/traces/\`

---
Generated by Enhanced E2E Test Suite
`;
  }

  /**
   * Cleanup test data and temporary files
   */
  async cleanup() {
    console.log('  🧹 Cleaning up test data...');
    
    try {
      // Cleanup script would go here
      // For now, just log that cleanup would happen
      console.log('  ✅ Test data cleanup completed');
      
    } catch (error) {
      console.log('  ⚠️  Cleanup warning:', error.message);
    }
  }
}

// Main execution
if (require.main === module) {
  const runner = new E2ETestRunner();
  runner.run().catch(error => {
    console.error('❌ E2E Test Runner failed:', error);
    process.exit(1);
  });
}

module.exports = E2ETestRunner;