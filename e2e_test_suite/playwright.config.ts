import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from config/test.env
dotenv.config({ path: path.resolve(__dirname, 'config/test.env') });

/**
 * Playwright configuration for E2E testing with real APIs and databases
 */
export default defineConfig({
  testDir: './tests',
  
  /* Run tests in files in parallel */
  fullyParallel: true, // Disable for API rate limiting
  
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  
  /* Opt out of parallel tests on CI for API rate limiting */
  workers: process.env.CI ? 1 : 2,
  
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { outputFolder: 'test-results/html-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/results.xml' }],
    ['list']
  ],
  
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL for frontend testing */
    baseURL: process.env.TEST_FRONTEND_URL || 'http://localhost:3000',
    
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    
    /* Take screenshots on failure */
    screenshot: 'only-on-failure',
    
    /* Record video on retry */
    video: 'retain-on-failure',
    
    /* Global timeout for each test */
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },

  /* Global setup and teardown - commented out until setup files are created */
  // globalSetup: require.resolve('./scripts/global-setup.ts'),
  // globalTeardown: require.resolve('./scripts/global-teardown.ts'),

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
    
    {
      name: 'Google Chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
      dependencies: ['setup'],
    }, 
  ],

  /* Environment-specific settings */
  ...(process.env.REAL_API === 'true' && {
    timeout: 60000, // Longer timeout for real API calls
    retries: 1, // Fewer retries with real APIs
    workers: 1, // Serial execution for API rate limiting
  }),

  /* Folder for test artifacts */
  outputDir: 'test-results/artifacts',
  
  /* Run your local dev server before starting the tests */
  webServer: process.env.CI ? undefined : [
    {
      command: 'cd ../frontend && npm run dev',
      port: 3000,
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
    },
    {
      command: 'cd ../backend && python manage.py runserver',
      port: 8000,
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
    }
  ],

  /* Test configuration */
  expect: {
    /* Timeout for expect() assertions */
    timeout: 10000,
  },
}); 