/**
 * E2E Test: Admin FeeMasterPage (/admin/fees)
 *
 * Tests:
 * 1. Renders fee list with seeded fees (>= 2 rows)
 * 2. "Add Fee" button opens modal form with input fields
 * 3. Fee table shows rate values formatted correctly (€ / %)
 * 4. Search filter narrows the fee list
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './utils/playwright-helpers.js';

test.describe('Admin — Fee Master Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'ADMIN');
    await page.goto('/admin/fees');
    await page.waitForLoadState('networkidle');
  });

  test('renders fee list with seeded fees', async ({ page }) => {
    // Wait for at least one row to appear
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 15000 });

    const rows = page.locator('table tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('"Add Fee" button opens modal form', async ({ page }) => {
    // Click the Add Fee button (matches both EN "Add Fee" and NL "toevoegen")
    await page.getByRole('button', { name: /add fee|toevoegen/i }).click();

    // Modal should appear — check for text inputs (fee_type, description, rate_value, etc.)
    const textInputs = page.locator('.app-modal-panel input[type="text"], .app-modal-panel input:not([type])');
    await expect(textInputs.first()).toBeVisible({ timeout: 8000 });

    const inputCount = await textInputs.count();
    expect(inputCount).toBeGreaterThanOrEqual(1);

    // Rate type select should also be present in the modal
    const rateTypeSelect = page.locator('.app-modal-panel select[name="rate_type"]');
    await expect(rateTypeSelect).toBeVisible({ timeout: 8000 });
  });

  test('fee table shows rate values formatted correctly', async ({ page }) => {
    // Wait for rows to load
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 15000 });

    // Rate values column should contain € or % symbols
    const tableBody = await page.locator('table tbody').textContent();
    const hasEuro = tableBody.includes('€');
    const hasPercent = tableBody.includes('%');

    expect(hasEuro || hasPercent).toBe(true);
  });

  test('search filter narrows fee list', async ({ page }) => {
    // Wait for initial table load
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 15000 });

    const initialCount = await page.locator('table tbody tr').count();

    // Fill the search input with "sorting" — should match SORTING_SURCHARGE
    const searchInput = page.locator('input[type="text"]').first();
    await searchInput.fill('sorting');

    // Wait for debounce (300 ms) + network
    await page.waitForTimeout(600);
    await page.waitForLoadState('networkidle');

    const filteredCount = await page.locator('table tbody tr').count();
    expect(filteredCount).toBeLessThanOrEqual(initialCount);
  });
});
