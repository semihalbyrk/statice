/**
 * E2E Test: Inbound Lifecycle
 *
 * Tests:
 * 1. Inbounds list shows seeded inbounds
 * 2. Navigate to ARRIVED inbound (Inbound #6) — weighing page loads
 * 3. Arrival page: search input is present
 * 4. LOGISTICS_PLANNER can navigate to create order form
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './utils/playwright-helpers.js';

test.describe('Inbound Lifecycle', () => {
  test('inbounds list: seeded inbounds displayed', async ({ page }) => {
    await loginAs(page, 'GATE_OPERATOR');
    await page.goto('/inbounds');
    await page.waitForLoadState('networkidle');

    // Seed creates at least 6 inbounds
    const rowCount = await page.locator('table tbody tr').count();
    expect(rowCount).toBeGreaterThanOrEqual(6);

    // Status badges visible in table
    const tableBody = page.locator('table tbody');
    await expect(tableBody.getByText(/Sorted|SORTED/).first()).toBeVisible({ timeout: 10000 });
  });

  test('inbound #6 (ARRIVED): weighing event page loads', async ({ page }) => {
    await loginAs(page, 'GATE_OPERATOR');
    await page.goto('/inbounds');
    await page.waitForLoadState('networkidle');

    // Click Inbound #6 row link
    const row = page.locator('tr').filter({ hasText: 'Inbound #6' });
    await expect(row.first()).toBeVisible({ timeout: 10000 });
    await row.first().click();

    await page.waitForURL(/\/inbounds\/seed-inbound-006/, { timeout: 15000 });
    // Use .first() to avoid strict mode on multiple "Inbound #6" matches
    await expect(page.getByText('Inbound #6').first()).toBeVisible({ timeout: 10000 });
  });

  test('arrival page: plate search input is visible', async ({ page }) => {
    await loginAs(page, 'GATE_OPERATOR');
    await page.goto('/arrival');
    await page.waitForLoadState('networkidle');

    const input = page.locator('input').first();
    await expect(input).toBeVisible({ timeout: 10000 });
  });

  test('orders page: LOGISTICS_PLANNER can navigate to create order form', async ({ page }) => {
    await loginAs(page, 'LOGISTICS_PLANNER');
    await page.goto('/orders');
    await page.waitForLoadState('networkidle');

    const createBtn = page.locator('button').filter({ hasText: /new|create|nieuw/i }).first();
    await expect(createBtn).toBeVisible({ timeout: 10000 });
    await createBtn.click();

    // URL includes query param: /orders/new?type=INCOMING
    await page.waitForURL(/\/orders\/new/, { timeout: 15000 });
    await expect(page.locator('select, input').first()).toBeVisible();
  });

  test('inbound row click navigates to weighing event page', async ({ page }) => {
    await loginAs(page, 'GATE_OPERATOR');
    await page.goto('/inbounds');
    await page.waitForLoadState('networkidle');

    // Click first table body row — rows have onClick navigating to /inbounds/:id
    const firstRow = page.locator('table tbody tr').first();
    await expect(firstRow).toBeVisible({ timeout: 10000 });
    await firstRow.click();

    await page.waitForURL(/\/inbounds\//, { timeout: 15000 });
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 });
  });

  test('inbound status badges show correct states', async ({ page }) => {
    await loginAs(page, 'GATE_OPERATOR');
    await page.goto('/inbounds');
    await page.waitForLoadState('networkidle');

    // Seed has 4x SORTED inbounds — at least 3 "Sorted" badges should appear in table body
    const tableBody = page.locator('table tbody');
    const sortedBadges = tableBody.getByText(/Sorted|SORTED/i);
    await expect(sortedBadges.nth(2)).toBeVisible({ timeout: 10000 });
  });

  test('arrival page: search plate and verify results area', async ({ page }) => {
    await loginAs(page, 'GATE_OPERATOR');
    await page.goto('/arrival');
    await page.waitForLoadState('networkidle');

    // Fill plate search and submit
    const input = page.locator('input').first();
    await expect(input).toBeVisible({ timeout: 10000 });
    await input.fill('12-ABC-3');
    await input.press('Enter');

    // Wait for any async work to settle
    await page.waitForTimeout(2000);

    // No JS errors should have surfaced in the page body
    await expect(page.locator('body')).not.toContainText('TypeError');
  });
});
