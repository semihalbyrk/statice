/**
 * E2E Tests: Admin — Entities Page & Entity Detail Page
 * Covers list rendering, tab filtering, navigation, and detail view.
 */
import { test, expect } from '@playwright/test';
import { loginAs } from './utils/playwright-helpers.js';

test.describe('Admin Entities Page', () => {
  test('renders entity list with seeded entities', async ({ page }) => {
    await loginAs(page, 'ADMIN');
    await page.goto('/admin/entities');
    await page.waitForLoadState('networkidle');

    // Table should be present and have at least 5 rows
    const rows = page.locator('table tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 15000 });
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThanOrEqual(5);
  });

  test('tab filtering works (Suppliers and Transporters)', async ({ page }) => {
    await loginAs(page, 'ADMIN');
    await page.goto('/admin/entities');
    await page.waitForLoadState('networkidle');

    // Wait for initial table to load
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 15000 });
    const allCount = await page.locator('table tbody tr').count();

    // Click Suppliers tab
    await page.getByRole('button', { name: 'Suppliers' }).click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/tab=suppliers/);

    // Table should still be rendered (may have fewer rows)
    const suppliersRows = page.locator('table tbody tr');
    await expect(suppliersRows.first()).toBeVisible({ timeout: 10000 });
    const suppliersCount = await suppliersRows.count();
    expect(suppliersCount).toBeGreaterThanOrEqual(1);
    // Suppliers tab count should be <= all count (it's a filtered subset)
    expect(suppliersCount).toBeLessThanOrEqual(allCount);

    // Click Transporters tab
    await page.getByRole('button', { name: 'Transporters' }).click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/tab=transporters/);

    const transportersRows = page.locator('table tbody tr');
    await expect(transportersRows.first()).toBeVisible({ timeout: 10000 });
    expect(await transportersRows.count()).toBeGreaterThanOrEqual(1);
  });

  test('"Create Entity" navigates to create page', async ({ page }) => {
    await loginAs(page, 'ADMIN');
    await page.goto('/admin/entities');
    await page.waitForLoadState('networkidle');

    // Find and click the "Create Entity" link/button
    const createLink = page.getByRole('link', { name: /create entity/i });
    await expect(createLink).toBeVisible({ timeout: 10000 });
    await createLink.click();

    await page.waitForURL(/\/admin\/entities\/new/, { timeout: 15000 });
    expect(page.url()).toMatch(/\/admin\/entities\/new/);
  });

  test('entity row links to detail page', async ({ page }) => {
    await loginAs(page, 'ADMIN');
    await page.goto('/admin/entities');
    await page.waitForLoadState('networkidle');

    // Wait for first row to appear
    const firstRowLink = page.locator('table tbody tr').first().locator('a').first();
    await expect(firstRowLink).toBeVisible({ timeout: 15000 });

    // Click the company_name link (first <a> in the first row)
    await firstRowLink.click();

    // Should navigate to /admin/entities/:id (IDs are slugs, not numeric)
    await page.waitForURL(/\/admin\/entities\/[^/]+$/, { timeout: 15000 });
    expect(page.url()).toMatch(/\/admin\/entities\/[^/]+$/);

    // h1 with company name should be visible
    const heading = page.locator('h1');
    await expect(heading).toBeVisible({ timeout: 10000 });
    const headingText = await heading.textContent();
    expect(headingText?.trim().length).toBeGreaterThan(0);
  });

  test('entity detail shows roles and contact info', async ({ page }) => {
    await loginAs(page, 'ADMIN');
    await page.goto('/admin/entities');
    await page.waitForLoadState('networkidle');

    // Navigate to the first entity's detail page
    const firstRowLink = page.locator('table tbody tr').first().locator('a').first();
    await expect(firstRowLink).toBeVisible({ timeout: 15000 });
    await firstRowLink.click();
    await page.waitForURL(/\/admin\/entities\/[^/]+$/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    // Roles section heading should be visible
    const rolesHeading = page.getByText(/roles/i).first();
    await expect(rolesHeading).toBeVisible({ timeout: 10000 });

    // At least one role pill should appear (supplier, transporter, disposer, or receiver)
    const rolePill = page.locator(
      'span.rounded-full.text-xs.font-medium'
    ).filter({
      hasText: /supplier|transporter|disposer|receiver/i,
    }).first();
    await expect(rolePill).toBeVisible({ timeout: 10000 });

    // Company info section should be visible with contact fields
    const companyInfoSection = page.getByText(/company info/i).first();
    await expect(companyInfoSection).toBeVisible({ timeout: 10000 });

    // Edit button should be present for ADMIN
    const editButton = page.getByRole('link', { name: /edit/i }).first();
    await expect(editButton).toBeVisible({ timeout: 10000 });
  });
});
