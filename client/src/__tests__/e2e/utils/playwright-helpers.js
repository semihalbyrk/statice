/**
 * Playwright Test Helpers for Statice E2E Tests
 * Common navigation, login, and assertion utilities.
 * ES module (client/ has "type": "module").
 */
import { expect } from '@playwright/test';

const ROLE_EMAILS = {
  ADMIN: 'admin@statice.nl',
  GATE_OPERATOR: 'gate@statice.nl',
  LOGISTICS_PLANNER: 'planner@statice.nl',
  WEIGHBRIDGE_OPERATOR: 'weighbridge@statice.nl',
  SORTING_EMPLOYEE: 'sorting@statice.nl',
  FINANCE_MANAGER: 'finance@statice.nl',
};

const ROLE_PASSWORDS = {
  ADMIN: 'Admin1234!',
  GATE_OPERATOR: 'Gate1234!',
  LOGISTICS_PLANNER: 'Planner123!',
  WEIGHBRIDGE_OPERATOR: 'Gate1234!',
  SORTING_EMPLOYEE: 'Sorting123!',
  FINANCE_MANAGER: 'Finance123!',
};

/**
 * Login as a specific role.
 * LoginPage uses id="email" and id="password", and button[type=submit].
 */
export async function loginAs(page, role = 'ADMIN', password = null) {
  const email = ROLE_EMAILS[role] || `${role.toLowerCase()}@statice.nl`;
  password = password || ROLE_PASSWORDS[role] || 'Admin1234!';
  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('button[type=submit]').click();
  await page.waitForURL(/\/(dashboard|orders|sorting|inbounds|arrival|outbounds)/, { timeout: 15000 });
}

/**
 * Navigate to a path and wait for an optional selector.
 */
export async function navigateTo(page, path, waitForSelector = null) {
  await page.goto(path);
  if (waitForSelector) {
    await page.waitForSelector(waitForSelector, { timeout: 15000 });
  } else {
    await page.waitForLoadState('networkidle');
  }
}

/**
 * Fill a form field by selector.
 */
export async function fillField(page, selector, value) {
  await page.locator(selector).fill(String(value));
}

/**
 * Select from a native <select> or shadcn custom dropdown.
 */
export async function selectOption(page, selector, optionText) {
  const el = page.locator(selector);
  const tagName = await el.evaluate((node) => node.tagName.toLowerCase());
  if (tagName === 'select') {
    await el.selectOption({ label: optionText });
  } else {
    await el.click();
    await page.getByText(optionText, { exact: true }).first().click();
  }
}

/**
 * Click a button by CSS selector, optionally wait for URL after click.
 */
export async function clickButton(page, selector, waitForUrl = null) {
  await page.locator(selector).click();
  if (waitForUrl) {
    await page.waitForURL(waitForUrl, { timeout: 15000 });
  }
}

/**
 * Assert an element is visible and optionally contains text.
 */
export async function expectVisible(page, selector, expectedText = null) {
  const el = page.locator(selector).first();
  await expect(el).toBeVisible({ timeout: 10000 });
  if (expectedText) {
    await expect(el).toContainText(expectedText);
  }
}

/**
 * Assert an element is hidden or absent.
 */
export async function expectHidden(page, selector) {
  await expect(page.locator(selector)).toBeHidden({ timeout: 5000 });
}

/**
 * Get text content of an element.
 */
export async function getText(page, selector) {
  return page.locator(selector).first().textContent();
}

/**
 * Get attribute value of an element.
 */
export async function getAttribute(page, selector, attribute) {
  return page.locator(selector).first().getAttribute(attribute);
}

/**
 * Expect any visible text matching the message (for toasts or inline feedback).
 */
export async function expectToast(page, message) {
  await expect(page.getByText(message, { exact: false })).toBeVisible({ timeout: 8000 });
}

/**
 * Wait for a table to have exactly N rows.
 */
export async function expectTableRows(page, tableSelector, count) {
  await expect(page.locator(`${tableSelector} tbody tr`)).toHaveCount(count, { timeout: 10000 });
}

/**
 * Click row N (0-based) of 'table tbody tr', optionally waiting for URL.
 */
export async function clickTableRow(page, rowIndex = 0, expectedUrlPattern = null) {
  const rows = page.locator('table tbody tr');
  await rows.nth(rowIndex).click();
  if (expectedUrlPattern) {
    await page.waitForURL(expectedUrlPattern, { timeout: 15000 });
  }
}

/**
 * Open Playwright Inspector for interactive debugging.
 */
export async function debug(page) {
  await page.pause();
}
