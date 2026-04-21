/**
 * E2E Test: Contract Detail Page
 *
 * Tests:
 * 1. renders contract header with number and status
 * 2. shows contract details with currency
 * 3. waste stream sections with rate lines
 * 4. edit button navigates to edit page
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './utils/playwright-helpers.js';

// Seed data: 5 INCOMING contracts (I-Contract #1–#5) and 1 OUTGOING (O-Contract #1).
// I-Contract #1 has rate lines with EUR currency.
// Navigate from /contracts list to detail by clicking the first row.

test.describe('Contract Detail Page', () => {
  test('renders contract header with number and status', async ({ page }) => {
    await loginAs(page, 'ADMIN');
    await page.goto('/contracts');
    await page.waitForLoadState('networkidle');

    // Click the first contract row (rows are clickable via onClick)
    const firstRow = page.locator('table tbody tr').first();
    await expect(firstRow).toBeVisible({ timeout: 10000 });
    await firstRow.click();

    // Should navigate to /contracts/:id
    await page.waitForURL(/\/contracts\/[^/]+$/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    // h1 with contract number visible
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 10000 });
    const headingText = await heading.innerText();
    expect(headingText.length).toBeGreaterThan(0);

    // Status badge visible somewhere on page (ClickableStatusBadge renders a button)
    const pageText = await page.locator('body').innerText();
    const hasStatus = /ACTIVE|INACTIVE|DRAFT|EXPIRED/i.test(pageText);
    expect(hasStatus).toBe(true);
  });

  test('shows contract details with currency', async ({ page }) => {
    await loginAs(page, 'ADMIN');
    await page.goto('/contracts');
    await page.waitForLoadState('networkidle');

    // Click the first contract row
    const firstRow = page.locator('table tbody tr').first();
    await expect(firstRow).toBeVisible({ timeout: 10000 });
    await firstRow.click();

    await page.waitForURL(/\/contracts\/[^/]+$/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 });

    // I-Contract #1 is EUR — verify EUR symbol or text appears
    const pageText = await page.locator('body').innerText();
    const hasCurrency = /EUR|€|\$/i.test(pageText);
    expect(hasCurrency).toBe(true);
  });

  test('waste stream sections with rate lines', async ({ page }) => {
    await loginAs(page, 'FINANCE_MANAGER');
    await page.goto('/contracts');
    await page.waitForLoadState('networkidle');

    // Click the first contract row (I-Contract #1 has rate lines)
    const firstRow = page.locator('table tbody tr').first();
    await expect(firstRow).toBeVisible({ timeout: 10000 });
    await firstRow.click();

    await page.waitForURL(/\/contracts\/[^/]+$/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 });

    // Page should contain waste stream / rate line related content
    const pageText = await page.locator('body').innerText();
    const hasWasteStreamContent =
      /waste stream|rate|tarief|material|Weight|Quantity|Per Weight|Per Quantity/i.test(pageText);
    expect(hasWasteStreamContent).toBe(true);
  });

  test('edit button navigates to edit page', async ({ page }) => {
    await loginAs(page, 'ADMIN');
    await page.goto('/contracts');
    await page.waitForLoadState('networkidle');

    // Click first contract row
    const firstRow = page.locator('table tbody tr').first();
    await expect(firstRow).toBeVisible({ timeout: 10000 });
    await firstRow.click();

    await page.waitForURL(/\/contracts\/[^/]+$/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 });

    // Find Edit button — ContractDetailPage renders a button with onClick navigate to /contracts/:id/edit
    // The button contains a Pencil icon; look for Edit text or pencil button
    const editButton = page.locator('button').filter({ hasText: /edit|bewerken/i }).first();
    const editButtonVisible = await editButton.isVisible().catch(() => false);

    if (editButtonVisible) {
      await editButton.click();
    } else {
      // Fallback: look for any element with /edit text
      const editEl = page.getByRole('button', { name: /edit|bewerken/i }).first();
      await editEl.click();
    }

    // URL should now contain /edit
    await page.waitForURL(/\/contracts\/[^/]+\/edit/, { timeout: 15000 });
    expect(page.url()).toMatch(/\/contracts\/[^/]+\/edit/);
  });
});
