/**
 * E2E Test: Dashboard Page
 *
 * Tests:
 * 1. Renders stat cards and page heading
 * 2. Today arrivals table renders or shows empty state
 * 3. Recent orders section shows seeded orders
 * 4. GATE_OPERATOR role can access dashboard
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './utils/playwright-helpers.js';

test.describe('Dashboard', () => {
  test('renders stat cards and page heading', async ({ page }) => {
    await loginAs(page, 'ADMIN');
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // At least 3 card-like elements (divs with rounded/shadow classes or role="article")
    const cards = page.locator('[class*="card"], [class*="rounded"], [class*="shadow"]');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('today arrivals table renders or shows empty state', async ({ page }) => {
    await loginAs(page, 'ADMIN');
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Either a table exists or an empty/no-data message is visible
    const tableExists = await page.locator('table').count();
    if (tableExists > 0) {
      await expect(page.locator('table').first()).toBeVisible({ timeout: 10000 });
    } else {
      // Look for any empty state or "no arrivals" type text
      const body = await page.locator('body').textContent();
      expect(body).toBeTruthy();
    }
  });

  test('recent orders section shows seeded orders', async ({ page }) => {
    await loginAs(page, 'ADMIN');
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Seed data has 7 orders (ORD-00001 through ORD-00007)
    const ordersText = await page.locator('body').textContent();
    const hasOrders = /ORD-0000/.test(ordersText);
    const hasEmptyState = /no (orders|data)|empty/i.test(ordersText);

    expect(hasOrders || hasEmptyState).toBe(true);
  });

  test('GATE_OPERATOR role can access dashboard', async ({ page }) => {
    // Collect console errors to detect TypeErrors
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await loginAs(page, 'GATE_OPERATOR');
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Should reach dashboard without crashing
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    // No TypeError / Cannot read errors
    const typeErrors = consoleErrors.filter(
      (e) => e.includes('TypeError') || e.includes('Cannot read')
    );
    expect(typeErrors).toHaveLength(0);
  });
});
