/**
 * E2E Tests: Auth / Login
 * Tests login form rendering, successful login, error handling, and role-based access.
 */
import { test, expect } from '@playwright/test';
import { loginAs } from './utils/playwright-helpers.js';

test.describe('Login Page', () => {
  test('renders login form with email and password fields', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type=submit]')).toBeVisible();
  });

  test('successful login redirects to dashboard', async ({ page }) => {
    await loginAs(page, 'ADMIN');
    await expect(page).toHaveURL(/\/(dashboard|orders)/);
  });

  test('invalid credentials show error message', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email').fill('admin@statice.nl');
    await page.locator('#password').fill('WrongPassword999!');
    await page.locator('button[type=submit]').click();
    await expect(page.locator('.bg-red-50')).toBeVisible({ timeout: 10000 });
  });

  test('each role can log in successfully', async ({ page }) => {
    const roles = [
      { role: 'ADMIN', email: 'admin@statice.nl', password: 'Admin1234!' },
      { role: 'LOGISTICS_PLANNER', email: 'planner@statice.nl', password: 'Planner123!' },
      { role: 'GATE_OPERATOR', email: 'gate@statice.nl', password: 'Gate1234!' },
      { role: 'SORTING_EMPLOYEE', email: 'sorting@statice.nl', password: 'Sorting123!' },
      { role: 'FINANCE_MANAGER', email: 'finance@statice.nl', password: 'Finance123!' },
    ];

    for (const { email, password } of roles) {
      await page.goto('/login');
      await page.locator('#email').fill(email);
      await page.locator('#password').fill(password);
      await page.locator('button[type=submit]').click();
      await page.waitForURL(/\/(dashboard|orders|sorting|inbounds|arrival|outbounds)/, { timeout: 15000 });
      await expect(page).toHaveURL(/\/(dashboard|orders|sorting|inbounds|arrival|outbounds)/);
    }
  });
});
