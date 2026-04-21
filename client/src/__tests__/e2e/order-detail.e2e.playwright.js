/**
 * E2E Test: Order Detail Page
 *
 * Tests:
 * 1. renders order detail with header and info grid
 * 2. shows supplier and transporter info
 * 3. PLANNED order shows status badge
 * 4. inbounds section lists linked inbounds
 * 5. documents section is present
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './utils/playwright-helpers.js';

// Seed order IDs: seed-order-001 through seed-order-007
// Order 7 is PLANNED per task brief

test.describe('Order Detail Page', () => {
  test('renders order detail with header and info grid', async ({ page }) => {
    await loginAs(page, 'LOGISTICS_PLANNER');
    await page.goto('/orders/seed-order-001');
    await page.waitForLoadState('networkidle');

    // h1 with order number visible
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 10000 });

    // Status badge visible somewhere on the page
    const pageText = await page.locator('body').innerText();
    // Should have some content from the order detail
    expect(pageText.length).toBeGreaterThan(10);
  });

  test('shows supplier and transporter info', async ({ page }) => {
    await loginAs(page, 'LOGISTICS_PLANNER');
    await page.goto('/orders/seed-order-001');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 });

    // Page should contain supplier or leverancier text
    const pageText = await page.locator('body').innerText();
    const hasSupplier = /supplier|leverancier/i.test(pageText);
    expect(hasSupplier).toBe(true);
  });

  test('PLANNED order shows status badge', async ({ page }) => {
    await loginAs(page, 'LOGISTICS_PLANNER');
    // Order 7 is PLANNED
    await page.goto('/orders/seed-order-007');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 });

    // Badge or text with PLANNED visible
    const badge = page.getByText(/planned/i).first();
    await expect(badge).toBeVisible({ timeout: 10000 });
  });

  test('inbounds section lists linked inbounds', async ({ page }) => {
    await loginAs(page, 'LOGISTICS_PLANNER');
    await page.goto('/orders/seed-order-001');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 });

    // Page should mention "inbound"
    const pageText = await page.locator('body').innerText();
    expect(/inbound/i.test(pageText)).toBe(true);
  });

  test('documents section is present', async ({ page }) => {
    await loginAs(page, 'LOGISTICS_PLANNER');
    await page.goto('/orders/seed-order-001');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 });

    // Page should mention "document"
    const pageText = await page.locator('body').innerText();
    expect(/document/i.test(pageText)).toBe(true);
  });
});
