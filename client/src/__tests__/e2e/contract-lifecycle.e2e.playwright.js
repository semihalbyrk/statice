/**
 * E2E Test: Contract Lifecycle Journey
 *
 * Tests:
 * 1. Contracts list shows both INCOMING and OUTGOING contracts
 * 2. Incoming contract detail shows rate lines
 * 3. Outgoing contract detail shows Renewi buyer
 * 4. Contract create form loads and cancel returns to list
 * 5. Contract status badge is present on list
 *
 * Seed data: I-Contract #1–#5 (INCOMING, ACTIVE) + O-Contract #1 (OUTGOING, ACTIVE, buyer: Renewi)
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './utils/playwright-helpers.js';

test.describe('Contract Lifecycle', () => {
  test('contracts list shows both INCOMING and OUTGOING contracts', async ({ page }) => {
    await loginAs(page, 'ADMIN');
    await page.goto('/contracts');
    await page.waitForLoadState('networkidle');

    const tbody = page.locator('table tbody');
    await expect(tbody).toBeVisible({ timeout: 10000 });

    await expect(tbody.getByText(/I-Contract/i).first()).toBeVisible({ timeout: 10000 });
    await expect(tbody.getByText(/O-Contract/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('incoming contract detail shows rate lines', async ({ page }) => {
    await loginAs(page, 'ADMIN');
    await page.goto('/contracts');
    await page.waitForLoadState('networkidle');

    // Click first row that contains I-Contract text
    const incomingRow = page.locator('table tbody tr').filter({ hasText: /I-Contract/i }).first();
    await expect(incomingRow).toBeVisible({ timeout: 10000 });
    await incomingRow.click();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/contracts\/[^/]+$/, { timeout: 10000 });

    // Detail page should show contract info — wait for content to fully load
    await page.waitForLoadState('networkidle');
    // Check for rate/material/pricing/currency text (i18n: "Unit Rate", "Material", "Pricing", "€")
    await expect(page.getByText(/Unit Rate|Material|Pricing|rate|tarief|€/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('outgoing contract detail shows Renewi buyer', async ({ page }) => {
    await loginAs(page, 'ADMIN');
    await page.goto('/contracts');
    await page.waitForLoadState('networkidle');

    // Click the row containing O-Contract text
    const outgoingRow = page.locator('table tbody tr').filter({ hasText: /O-Contract/i }).first();
    await expect(outgoingRow).toBeVisible({ timeout: 10000 });
    await outgoingRow.click();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/contracts\/[^/]+$/, { timeout: 10000 });

    // Detail page should mention Renewi as the buyer
    await expect(page.getByText(/renewi/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('contract create form loads and cancel returns to list', async ({ page }) => {
    await loginAs(page, 'ADMIN');
    await page.goto('/contracts/new');
    await page.waitForLoadState('networkidle');

    // Fill the contract name input
    const nameInput = page.locator('input[name="name"], input[placeholder*="name" i], input[placeholder*="contract" i], input[id*="name" i]').first();
    await expect(nameInput).toBeVisible({ timeout: 10000 });
    await nameInput.fill('E2E Test Contract');

    // Fill the first date input
    const dateInput = page.locator('input[type="date"]').first();
    await expect(dateInput).toBeVisible({ timeout: 10000 });
    await dateInput.fill('2026-05-01');

    // Click cancel button
    const cancelBtn = page.locator('button', { hasText: /cancel|annuleer/i }).first();
    await expect(cancelBtn).toBeVisible({ timeout: 10000 });
    await cancelBtn.click();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/contracts$/, { timeout: 10000 });
  });

  test('contract status badge is present on list', async ({ page }) => {
    await loginAs(page, 'ADMIN');
    await page.goto('/contracts');
    await page.waitForLoadState('networkidle');

    const tbody = page.locator('table tbody');
    await expect(tbody).toBeVisible({ timeout: 10000 });

    // All seeded contracts are ACTIVE — badge should appear in table body
    await expect(tbody.getByText(/active/i).first()).toBeVisible({ timeout: 10000 });
  });
});
