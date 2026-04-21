import { test, expect } from '@playwright/test';
import { loginAs } from './utils/playwright-helpers.js';

test.describe('Admin MaterialsManagementPage', () => {
  test('renders materials page with seeded data', async ({ page }) => {
    await loginAs(page, 'ADMIN');
    await page.goto('/admin/materials');
    await page.waitForLoadState('networkidle');

    // No TypeError should be thrown
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    // Heading should be visible
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible();

    expect(errors.filter((e) => e.includes('TypeError'))).toHaveLength(0);
  });

  test('materials table shows seeded materials', async ({ page }) => {
    await loginAs(page, 'ADMIN');
    await page.goto('/admin/materials');
    await page.waitForLoadState('networkidle');

    // Click the "Materials" tab (index 1)
    await page.locator('button').filter({ hasText: /^Materials$/i }).click();
    await page.waitForLoadState('networkidle');

    // At least one of the seeded material names should appear
    const materialsText = page.locator('td').filter({ hasText: /household|screens|circuit/i }).first();
    await expect(materialsText).toBeVisible();
  });

  test('fractions section shows seeded fractions', async ({ page }) => {
    await loginAs(page, 'ADMIN');
    await page.goto('/admin/materials');
    await page.waitForLoadState('networkidle');

    // Click the "Fractions" tab (index 2)
    await page.locator('button').filter({ hasText: /^Fractions$/i }).click();
    await page.waitForLoadState('networkidle');

    // At least one of the seeded fraction names should appear
    const fractionsText = page.locator('td').filter({ hasText: /ferrous|copper|aluminium|plastics/i }).first();
    await expect(fractionsText).toBeVisible();
  });
});
