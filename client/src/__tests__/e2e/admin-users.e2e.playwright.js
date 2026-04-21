/**
 * E2E Test: Admin UsersPage (/admin/users)
 *
 * Tests:
 * 1. Renders user list with seeded users (>= 6 rows)
 * 2. "Add User" button opens create modal
 * 3. Search filter works (filter by "admin")
 * 4. Role filter dropdown works (filter by ADMIN role)
 * 5. Status badges are visible in table
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './utils/playwright-helpers.js';

test.describe('Admin — Users Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'ADMIN');
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');
  });

  test('renders user list with seeded users', async ({ page }) => {
    // Wait for table body rows to appear
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 15000 });

    const rows = page.locator('table tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(6);
  });

  test('"Add User" button opens create modal', async ({ page }) => {
    // Click the Add User button
    await page.getByRole('button', { name: /add user/i }).click();

    // Modal should appear — check for email and text inputs
    const emailInput = page.locator('input[type="email"]');
    const textInputs = page.locator('input[type="text"], input[type="password"]');

    // At least one email-type input in the modal
    await expect(emailInput.first()).toBeVisible({ timeout: 8000 });

    // Multiple text/password inputs (full_name, password, confirm_password)
    const inputCount = await textInputs.count();
    expect(inputCount).toBeGreaterThanOrEqual(2);
  });

  test('search filter works', async ({ page }) => {
    // Ensure table is loaded first
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 15000 });

    // Fill search input
    const searchInput = page.locator('input[type="text"]').first();
    await searchInput.fill('admin');

    // Wait for debounce / network request to settle
    await page.waitForTimeout(600);
    await page.waitForLoadState('networkidle');

    // At least 1 row should remain (admin@statice.nl)
    const rows = page.locator('table tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // Confirm the visible rows relate to "admin"
    const bodyText = await page.locator('table tbody').textContent();
    expect(bodyText.toLowerCase()).toContain('admin');
  });

  test('role filter dropdown works', async ({ page }) => {
    // Ensure table is loaded first
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 15000 });

    // Find the role filter select — it contains ADMIN as an option
    const roleSelect = page.locator('select').filter({ has: page.locator('option[value="ADMIN"]') }).first();
    await expect(roleSelect).toBeVisible({ timeout: 8000 });

    // Select ADMIN role
    await roleSelect.selectOption('ADMIN');

    // Wait for filter to apply
    await page.waitForTimeout(600);
    await page.waitForLoadState('networkidle');

    // Table should still have rows (at least the seeded admin user)
    const rows = page.locator('table tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('status badges are visible in table', async ({ page }) => {
    // Ensure table is loaded
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 15000 });

    // ClickableStatusBadge renders as a <button> with inline-flex + rounded-md classes inside each row
    // Target buttons inside tbody that look like status badges (have rounded-md and inline-flex)
    const badgesInTable = page.locator('table tbody').locator(
      'button[class*="rounded-md"], button[class*="inline-flex"]'
    );

    const badgeCount = await badgesInTable.count();
    expect(badgeCount).toBeGreaterThanOrEqual(1);
  });
});
