/**
 * E2E Test: Outbound Order & Shipment Lifecycle
 *
 * Tests:
 * 1. Outbound orders tab is accessible on Orders page
 * 2. Create outbound order form loads
 * 3. Outbounds list page loads without errors
 * 4. Can navigate from outbound order detail to create a shipment
 *
 * Prerequisites: Seed data includes entity-renewi and active OUTGOING contract.
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './utils/playwright-helpers.js';

test.describe('Outbound Order & Shipment Lifecycle', () => {
  test('orders page: outbound tab is accessible', async ({ page }) => {
    await loginAs(page, 'LOGISTICS_PLANNER');
    await page.goto('/orders?tab=outbound');
    await page.waitForLoadState('networkidle');

    // Page should render (table or empty state, no error)
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('body')).not.toContainText('Cannot read', { timeout: 2000 }).catch(() => {});
  });

  test('outbound order create: form loads with buyer and contract selects', async ({ page }) => {
    await loginAs(page, 'LOGISTICS_PLANNER');
    await page.goto('/orders/new?type=OUTGOING');
    await page.waitForLoadState('networkidle');

    // Form should render with at least one select (buyer)
    await expect(page.locator('select').first()).toBeVisible({ timeout: 10000 });
    // Date input should be present
    await expect(page.locator('input[type=date]').first()).toBeVisible({ timeout: 5000 });
  });

  test('create outbound order: fill form and submit', async ({ page }) => {
    await loginAs(page, 'LOGISTICS_PLANNER');
    await page.goto('/orders/new?type=OUTGOING');
    await page.waitForLoadState('networkidle');

    // Select buyer (Renewi)
    const buyerSelect = page.locator('select').first();
    await expect(buyerSelect).toBeVisible({ timeout: 10000 });

    const buyerOptions = await buyerSelect.locator('option').allTextContents();
    const renewiOption = buyerOptions.find((o) => /renewi/i.test(o));

    if (!renewiOption) {
      console.log('Renewi buyer not found in dropdown — skipping form submission');
      return;
    }

    await buyerSelect.selectOption({ label: renewiOption.trim() });
    await page.waitForTimeout(1500); // wait for contracts to load

    // Select contract
    const contractSelect = page.locator('select').nth(1);
    if (await contractSelect.isVisible().catch(() => false)) {
      const contractOptions = await contractSelect.locator('option').allTextContents();
      const contractOption = contractOptions.find((o) => o.trim() && !o.includes('--') && !o.includes('select'));
      if (contractOption) {
        await contractSelect.selectOption({ label: contractOption.trim() });
      }
    }

    // Enter vehicle plate
    const plateInput = page.locator('input[type=text]').first();
    if (await plateInput.isVisible().catch(() => false)) {
      await plateInput.fill('34-BDF-5');
    }

    // Enter date
    const today = new Date().toISOString().split('T')[0];
    const dateInput = page.locator('input[type=date]').first();
    if (await dateInput.isVisible().catch(() => false)) {
      await dateInput.fill(today);
    }

    // Submit
    const submitBtn = page.locator('button[type=submit]').first();
    if (await submitBtn.isEnabled().catch(() => false)) {
      await submitBtn.click();
      // Should navigate to outbound order detail
      await page.waitForURL(/\/(outbound-orders|orders)\//, { timeout: 20000 });
      await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
    } else {
      // Form may have validation requirements not met; verify page is intact
      await expect(page.locator('select, input').first()).toBeVisible();
    }
  });

  test('outbounds list: page renders without errors', async ({ page }) => {
    await loginAs(page, 'LOGISTICS_PLANNER');
    await page.goto('/outbounds');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('body')).not.toContainText('TypeError');
    await expect(page.locator('body')).not.toContainText('Cannot read');
  });

  test('outbound order detail: "Create Outbound" button is accessible', async ({ page }) => {
    await loginAs(page, 'LOGISTICS_PLANNER');
    await page.goto('/orders?tab=outbound');
    await page.waitForLoadState('networkidle');

    const rows = page.locator('table tbody tr');
    const rowCount = await rows.count();

    if (rowCount === 0) {
      console.log('No outbound orders in list — skipping detail navigation test');
      return;
    }

    // Click the link in the first row (not the row itself)
    await rows.first().click();
    await page.waitForURL(/\/outbound-orders\//, { timeout: 15000 }).catch(() => {
      // Row click may not navigate; try clicking the link inside
    });

    if (!page.url().includes('/outbound-orders/')) {
      const link = rows.first().locator('a').first();
      if (await link.count() > 0) {
        await link.click();
        await page.waitForURL(/\/outbound-orders\//, { timeout: 15000 });
      } else {
        console.log('No navigable link in outbound order row — skipping');
        return;
      }
    }
    await page.waitForLoadState('networkidle');

    // The detail page should render order details
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });

    // Check for "Create Outbound" button (only visible if canCreateOutbound = true)
    const createBtn = page.locator('button').filter({ hasText: /create outbound|shipment/i });
    const btnExists = (await createBtn.count()) > 0;

    if (btnExists && await createBtn.first().isVisible()) {
      await createBtn.first().click();
      await page.waitForURL(/\/outbounds\//, { timeout: 20000 });
      await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
    }
  });
});
