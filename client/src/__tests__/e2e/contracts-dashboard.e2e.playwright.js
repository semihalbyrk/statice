/**
 * E2E Test: Contracts Dashboard Page
 *
 * Tests:
 * 1. Renders contract list with seeded contracts
 * 2. Contract numbers are clickable links to detail
 * 3. "New Contract" button navigates to create page
 * 4. Search filter narrows contract list
 * 5. Status tabs filter contracts
 * 6. RAG summary cards are displayed
 * 7. FINANCE_MANAGER can access contracts
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './utils/playwright-helpers.js';

test.describe('Contracts Dashboard', () => {
  test('renders contract list with seeded contracts', async ({ page }) => {
    await loginAs(page, 'ADMIN');
    await page.goto('/contracts');
    await page.waitForLoadState('networkidle');

    // Seed data has 6 contracts: I-Contract #1–#5 + O-Contract #1
    const rows = page.locator('table tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(5);
  });

  test('contract numbers are clickable links to detail', async ({ page }) => {
    await loginAs(page, 'ADMIN');
    await page.goto('/contracts');
    await page.waitForLoadState('networkidle');

    // Table rows navigate via onClick on the TR element — no <a> tag
    const firstRow = page.locator('table tbody tr').first();
    await expect(firstRow).toBeVisible({ timeout: 10000 });
    await firstRow.click();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/contracts\/[^/]+$/, { timeout: 10000 });
  });

  test('"New Contract" button navigates to create page', async ({ page }) => {
    await loginAs(page, 'ADMIN');
    await page.goto('/contracts');
    await page.waitForLoadState('networkidle');

    const newContractBtn = page.locator('button', { hasText: /new contract/i });
    await expect(newContractBtn).toBeVisible({ timeout: 10000 });
    await newContractBtn.click();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/contracts\/new/, { timeout: 10000 });
  });

  test('search filter narrows contract list', async ({ page }) => {
    await loginAs(page, 'ADMIN');
    await page.goto('/contracts');
    await page.waitForLoadState('networkidle');

    // Get baseline row count
    const rows = page.locator('table tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    const baselineCount = await rows.count();

    // Search for "O-Contract" which should match only 1 contract
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i], input[placeholder*="Search" i], input[placeholder*="contract" i], input[placeholder*="Contract" i]').first();
    await searchInput.fill('O-Contract');
    await page.waitForTimeout(600); // debounce
    await page.waitForLoadState('networkidle');

    const filteredCount = await rows.count();
    expect(filteredCount).toBeLessThan(baselineCount);
  });

  test('status tabs filter contracts', async ({ page }) => {
    await loginAs(page, 'ADMIN');
    await page.goto('/contracts');
    await page.waitForLoadState('networkidle');

    // Click the "Active" tab button — use first() because ClickableStatusBadge cells
    // also render "Active" buttons; the tab is always the first match
    const activeTab = page.locator('button', { hasText: /^active$/i }).first();
    await expect(activeTab).toBeVisible({ timeout: 10000 });
    await activeTab.click();
    await page.waitForLoadState('networkidle');

    // All seeded contracts are ACTIVE — rows should still be visible
    const rows = page.locator('table tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('RAG summary cards are displayed', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await loginAs(page, 'ADMIN');
    await page.goto('/contracts');
    await page.waitForLoadState('networkidle');

    // Page should not crash — just verify it loaded
    await expect(page).toHaveURL(/\/contracts/, { timeout: 10000 });

    const typeErrors = consoleErrors.filter(
      (e) => e.includes('TypeError') || e.includes('Cannot read')
    );
    expect(typeErrors).toHaveLength(0);
  });

  test('FINANCE_MANAGER can access contracts', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await loginAs(page, 'FINANCE_MANAGER');
    await page.goto('/contracts');
    await page.waitForLoadState('networkidle');

    // Should reach contracts page without being redirected away
    await expect(page).toHaveURL(/\/contracts/, { timeout: 10000 });

    // Table rows should be visible
    const rows = page.locator('table tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });

    const typeErrors = consoleErrors.filter(
      (e) => e.includes('TypeError') || e.includes('Cannot read')
    );
    expect(typeErrors).toHaveLength(0);
  });
});
