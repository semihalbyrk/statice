/**
 * E2E Tests: Contract Create Page
 *
 * Tests:
 * 1. Renders form with contract type, supplier, dates
 * 2. Supplier dropdown populates from seed entities
 * 3. Currency dropdown shows EUR, USD, GBP
 * 4. Submit and cancel buttons are present
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './utils/playwright-helpers.js';

test.describe('Contract Create Page', () => {
  test('renders form with contract type, supplier, dates', async ({ page }) => {
    await loginAs(page, 'ADMIN');
    await page.goto('/contracts/new');
    await page.waitForLoadState('networkidle');

    // Wait for the form to be visible
    await page.waitForSelector('select', { timeout: 10000 });

    // At least 3 selects should be on the page (contract_type, supplier_id, currency, etc.)
    const selects = page.locator('select');
    await expect(selects).toHaveCount(await selects.count(), { timeout: 10000 });
    const selectCount = await selects.count();
    expect(selectCount).toBeGreaterThanOrEqual(3);

    // At least 2 date inputs (effective_date, expiry_date)
    const dateInputs = page.locator('input[type="date"]');
    const dateCount = await dateInputs.count();
    expect(dateCount).toBeGreaterThanOrEqual(2);
  });

  test('supplier dropdown populates from seed entities', async ({ page }) => {
    await loginAs(page, 'ADMIN');

    // Register response listener BEFORE navigating to catch the entities API call
    const entitiesResponsePromise = page.waitForResponse(
      (r) => r.url().includes('localhost:3001/api/entities') && r.status() === 200,
      { timeout: 30000 }
    );

    await page.goto('/contracts/new');

    // Wait for entities data to arrive, then for React to re-render with options
    await entitiesResponsePromise;

    const supplierSelect = page.locator('select[name="supplier_id"]');
    await expect(supplierSelect).toBeVisible({ timeout: 10000 });

    // Wait for at least one real option (beyond placeholder) to be populated
    await expect(supplierSelect.locator('option').nth(1)).toBeAttached({ timeout: 10000 });

    const options = await supplierSelect.locator('option').all();
    expect(options.length).toBeGreaterThan(1);

    const optionTexts = await Promise.all(options.map((o) => o.textContent()));
    const seedEntityMatch = optionTexts.some((t) => /wecycle|renewi|stichting/i.test(t ?? ''));
    expect(seedEntityMatch).toBe(true);
  });

  test('currency dropdown shows EUR, USD, GBP', async ({ page }) => {
    await loginAs(page, 'ADMIN');
    await page.goto('/contracts/new');
    await page.waitForLoadState('networkidle');

    const currencySelect = page.locator('select[name="currency"]');
    await expect(currencySelect).toBeVisible({ timeout: 10000 });

    const options = await currencySelect.locator('option').all();
    const optionValues = await Promise.all(options.map((o) => o.getAttribute('value')));

    expect(optionValues).toContain('EUR');
    expect(optionValues).toContain('USD');
    expect(optionValues).toContain('GBP');
  });

  test('submit and cancel buttons are present', async ({ page }) => {
    await loginAs(page, 'ADMIN');
    await page.goto('/contracts/new');
    await page.waitForLoadState('networkidle');

    // Submit button: type=submit or visible text matching create/save/opslaan
    const submitBtn = page
      .locator('button[type="submit"], button:text-matches("create|save|opslaan", "i")')
      .first();
    await expect(submitBtn).toBeVisible({ timeout: 10000 });

    // Cancel button: link or button with text cancel/annuleren
    const cancelEl = page
      .locator('a:text-matches("cancel|annuleren", "i"), button:text-matches("cancel|annuleren", "i")')
      .first();
    await expect(cancelEl).toBeVisible({ timeout: 10000 });
  });
});
