import { test, expect } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load test environment variables
dotenv.config({ path: path.resolve(__dirname, '../config/test.env') });

test.describe('Research Page Test', () => {
  test('should search for AAPL and view company overview', async ({ page }) => {
    console.log('=== Starting Research Page Test ===');
    console.log('Test URL:', process.env.FRONTEND_URL);
    console.log('Test Email:', process.env.TEST_USER_EMAIL);
    
    // Capture console logs from the browser
    page.on('console', msg => {
      console.log(`[Browser Console ${msg.type()}]:`, msg.text());
    });
    
    // Capture network requests
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        console.log(`[Network Request]: ${request.method()} ${request.url()}`);
      }
    });
    
    // Capture network responses
    page.on('response', response => {
      if (response.url().includes('/api/')) {
        console.log(`[Network Response]: ${response.status()} ${response.url()}`);
        // Log response body for API calls
        if (response.url().includes('stock_overview') || response.url().includes('research')) {
          response.text().then(body => {
            console.log(`[API Response Body]: ${body.substring(0, 500)}...`);
          }).catch(e => {
            console.log(`[API Response Error]: Could not read body - ${e.message}`);
          });
        }
      }
    });
    
    // Capture page errors
    page.on('pageerror', error => {
      console.log(`[Page Error]:`, error.message);
    });
    
    // Step 1: Navigate to the application
    console.log('Step 1: Navigating to application...');
    await page.goto(process.env.FRONTEND_URL || 'http://localhost:3000');
    
    // Take screenshot of initial page
    await page.screenshot({ path: 'e2e_test_suite/test-results/research-01-initial.png' });
    console.log('Screenshot saved: research-01-initial.png');
    
    // Step 2: Navigate to auth page
    console.log('Step 2: Navigating to auth page...');
    await page.goto(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth`);
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of auth page
    await page.screenshot({ path: 'e2e_test_suite/test-results/research-02-auth.png' });
    console.log('Screenshot saved: research-02-auth.png');
    
    // Step 3: Fill in login credentials
    console.log('Step 3: Filling login form...');
    console.log('Looking for email input...');
    await page.fill('input[type="email"]', process.env.TEST_USER_EMAIL || '');
    console.log('Email filled');
    
    console.log('Looking for password input...');
    await page.fill('input[type="password"]', process.env.TEST_USER_PASSWORD || '');
    console.log('Password filled');
    
    // Take screenshot after filling form
    await page.screenshot({ path: 'e2e_test_suite/test-results/research-03-form-filled.png' });
    console.log('Screenshot saved: research-03-form-filled.png');
    
    // Step 4: Submit login form
    console.log('Step 4: Submitting login form...');
    await page.click('button[type="submit"]');
    
    // Wait for navigation after login
    console.log('Waiting for navigation after login...');
    await page.waitForURL('**/dashboard', { timeout: 30000 });
    console.log('Successfully navigated to dashboard');
    
    // Take screenshot of dashboard
    await page.screenshot({ path: 'e2e_test_suite/test-results/research-04-dashboard.png' });
    console.log('Screenshot saved: research-04-dashboard.png');
    
    // Step 5: Navigate to Research page
    console.log('Step 5: Navigating to Research page...');
    
    // Try multiple selectors for the research link
    const researchSelectors = [
      'a[href="/research"]',
      'a:has-text("Research")',
      '[data-testid="nav-research"]',
      'nav a:has-text("Research")',
      '.sidebar a:has-text("Research")'
    ];
    
    let researchLinkFound = false;
    for (const selector of researchSelectors) {
      try {
        console.log(`Trying selector: ${selector}`);
        const element = await page.locator(selector).first();
        if (await element.isVisible()) {
          console.log(`Found research link with selector: ${selector}`);
          await element.click();
          researchLinkFound = true;
          break;
        }
      } catch (e) {
        console.log(`Selector ${selector} not found or not clickable`);
      }
    }
    
    if (!researchLinkFound) {
      console.error('Could not find Research link in navigation');
      // Take screenshot to debug
      await page.screenshot({ path: 'e2e_test_suite/test-results/research-05-nav-error.png' });
      throw new Error('Research link not found');
    }
    
    // Wait for research page to load
    console.log('Waiting for research page to load...');
    await page.waitForURL('**/research', { timeout: 30000 });
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of research page
    await page.screenshot({ path: 'e2e_test_suite/test-results/research-06-research-page.png' });
    console.log('Screenshot saved: research-06-research-page.png');
    
    // Step 6: Search for AAPL
    console.log('Step 6: Searching for AAPL...');
    
    // Try multiple selectors for the search input
    const searchSelectors = [
      'input[placeholder*="Search"]',
      'input[placeholder*="search"]',
      'input[type="search"]',
      '[data-testid="symbol-search"]',
      '.search-input',
      'input[name="symbol"]'
    ];
    
    let searchInputFound = false;
    for (const selector of searchSelectors) {
      try {
        console.log(`Trying search selector: ${selector}`);
        const element = await page.locator(selector).first();
        if (await element.isVisible()) {
          console.log(`Found search input with selector: ${selector}`);
          
          // Clear the input first
          await element.clear();
          await page.waitForTimeout(500);
          
          // Type AAPL
          await element.type('AAPL', { delay: 100 });
          console.log('Typed AAPL in search input');
          searchInputFound = true;
          
          // Wait a bit for autocomplete/suggestions
          console.log('Waiting for suggestions to appear...');
          await page.waitForTimeout(2000);
          
          // Take screenshot after typing
          await page.screenshot({ path: 'e2e_test_suite/test-results/research-07-search-typed.png' });
          console.log('Screenshot saved: research-07-search-typed.png');
          
          // Try to click on AAPL suggestion or press Enter
          console.log('Looking for AAPL suggestion...');
          const suggestionSelectors = [
            'text=AAPL',
            '[data-testid="search-suggestion-AAPL"]',
            '.suggestion:has-text("AAPL")',
            '.autocomplete-item:has-text("AAPL")'
          ];
          
          let suggestionClicked = false;
          for (const suggestionSelector of suggestionSelectors) {
            try {
              const suggestion = await page.locator(suggestionSelector).first();
              if (await suggestion.isVisible()) {
                console.log(`Found AAPL suggestion with selector: ${suggestionSelector}`);
                await suggestion.click();
                suggestionClicked = true;
                break;
              }
            } catch (e) {
              console.log(`Suggestion selector ${suggestionSelector} not found`);
            }
          }
          
          if (!suggestionClicked) {
            console.log('No suggestion found, pressing Enter...');
            await element.press('Enter');
          }
          
          break;
        }
      } catch (e) {
        console.log(`Search selector ${selector} not found or not visible`);
      }
    }
    
    if (!searchInputFound) {
      console.error('Could not find search input on research page');
      // Take screenshot to debug
      await page.screenshot({ path: 'e2e_test_suite/test-results/research-08-search-error.png' });
      throw new Error('Search input not found');
    }
    
    // Wait for search results/stock data to load
    console.log('Waiting for stock data to load...');
    await page.waitForTimeout(5000); // Increased wait time
    
    // Take screenshot of results
    await page.screenshot({ path: 'e2e_test_suite/test-results/research-09-search-results.png' });
    console.log('Screenshot saved: research-09-search-results.png');
    
    // Step 7: Check for company overview
    console.log('Step 7: Looking for company overview...');
    
    // Try to find overview tab or section
    const overviewSelectors = [
      'text=Overview',
      '[data-testid="overview-tab"]',
      '.tab:has-text("Overview")',
      'button:has-text("Overview")'
    ];
    
    let overviewFound = false;
    for (const selector of overviewSelectors) {
      try {
        const element = await page.locator(selector).first();
        if (await element.isVisible()) {
          console.log(`Found overview tab with selector: ${selector}`);
          await element.click();
          overviewFound = true;
          await page.waitForTimeout(2000);
          break;
        }
      } catch (e) {
        console.log(`Overview selector ${selector} not found`);
      }
    }
    
    // Look for company information
    console.log('Looking for company information...');
    const companyInfoSelectors = [
      'text=Apple Inc',
      'text=Technology',
      'text=Market Cap',
      'text=Description',
      '.company-overview',
      '[data-testid="company-info"]'
    ];
    
    let companyInfoFound = false;
    for (const selector of companyInfoSelectors) {
      try {
        const element = await page.locator(selector).first();
        if (await element.isVisible()) {
          console.log(`Found company info with selector: ${selector}`);
          const text = await element.textContent();
          console.log(`Company info text: ${text?.substring(0, 100)}...`);
          companyInfoFound = true;
          break;
        }
      } catch (e) {
        console.log(`Company info selector ${selector} not found`);
      }
    }
    
    // Take final screenshot
    await page.screenshot({ path: 'e2e_test_suite/test-results/research-10-final.png', fullPage: true });
    console.log('Screenshot saved: research-10-final.png');
    
    // Log page content for debugging
    console.log('\n=== Page Content Debug Info ===');
    const pageTitle = await page.title();
    console.log('Page title:', pageTitle);
    
    const pageUrl = page.url();
    console.log('Current URL:', pageUrl);
    
    // Get all visible text on page
    const visibleText = await page.locator('body').innerText();
    console.log('\nVisible text on page (first 500 chars):');
    console.log(visibleText.substring(0, 500));
    
    // Check for error messages
    const errorSelectors = [
      '.error',
      '.error-message',
      '[data-testid="error"]',
      'text=Error',
      'text=error',
      'text=No overview data'
    ];
    
    console.log('\n=== Checking for errors ===');
    for (const selector of errorSelectors) {
      try {
        const element = await page.locator(selector).first();
        if (await element.isVisible()) {
          const errorText = await element.textContent();
          console.log(`Found error/message with selector ${selector}: ${errorText}`);
        }
      } catch (e) {
        // No error found with this selector
      }
    }
    
    console.log('\n=== Test Summary ===');
    console.log('Research page loaded:', pageUrl.includes('/research'));
    console.log('Search performed:', searchInputFound);
    console.log('Overview found:', overviewFound);
    console.log('Company info found:', companyInfoFound);
    
    // Log what's showing in the overview section
    console.log('\n=== Overview Section Analysis ===');
    const overviewContent = await page.locator('.bg-gray-800').nth(1).innerText().catch(() => 'Could not read overview section');
    console.log('Overview section content:', overviewContent);
    
    // Assert that we're on the research page
    expect(page.url()).toContain('/research');
  });
}); 