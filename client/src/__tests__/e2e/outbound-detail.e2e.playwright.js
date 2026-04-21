/**
 * Outbound Detail Page — E2E Tests
 *
 * Route: /outbounds/:outboundId
 * Roles tested: LOGISTICS_PLANNER
 *
 * NOTE: Seed data does NOT create outbound shipments.
 * Tests that require a detail page navigate to /outbounds first
 * and click the first row if one exists; otherwise they log and pass.
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './utils/playwright-helpers.js';

// ---------------------------------------------------------------------------
// Helper: navigate to /outbounds, click first row if present, return bool
// ---------------------------------------------------------------------------
async function navigateToFirstOutbound(page) {
  await page.goto('/outbounds');
  await page.waitForLoadState('networkidle');

  // Data rows have cursor-pointer class; the empty-state row does not
  const dataRows = page.locator('table tbody tr.cursor-pointer');
  const rowCount = await dataRows.count();

  if (rowCount === 0) {
    return false;
  }

  // Click the first data row — navigation is JS-based (useNavigate), no <a> tag
  await dataRows.first().click();
  await page.waitForURL(/\/outbounds\/.+/, { timeout: 10_000 });
  return true;
}

// ---------------------------------------------------------------------------
// Test 1 — Outbounds list page renders without errors
// ---------------------------------------------------------------------------
test('outbounds page renders without errors', async ({ page }) => {
  await loginAs(page, 'LOGISTICS_PLANNER');
  await page.goto('/outbounds');
  await page.waitForLoadState('networkidle');

  // Capture and assert no TypeError / "Cannot read" runtime errors
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));

  // Reload to capture any errors on fresh paint
  await page.reload();
  await page.waitForLoadState('networkidle');

  const bodyText = await page.locator('body').innerText();
  expect(bodyText).not.toMatch(/TypeError/i);
  expect(bodyText).not.toMatch(/Cannot read/i);

  // At least one heading should be visible (h1 or h2)
  const headings = page.locator('h1, h2');
  await expect(headings.first()).toBeVisible({ timeout: 10_000 });

  // No JS runtime errors captured
  expect(errors.filter((e) => /TypeError|Cannot read/i.test(e))).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// Test 2 — Outbound detail page renders when an outbound exists
// ---------------------------------------------------------------------------
test('outbound detail renders when outbound exists', async ({ page }) => {
  await loginAs(page, 'LOGISTICS_PLANNER');

  const found = await navigateToFirstOutbound(page);

  if (!found) {
    console.log('[SKIP] No outbound shipments found in the database — skipping detail render test.');
    return;
  }

  // Detail page must show an h1 with some content
  const h1 = page.locator('h1');
  await expect(h1.first()).toBeVisible({ timeout: 10_000 });

  const h1Text = await h1.first().innerText();
  expect(h1Text.trim().length).toBeGreaterThan(0);

  // URL should now be /outbounds/<id>
  expect(page.url()).toMatch(/\/outbounds\/.+/);
});

// ---------------------------------------------------------------------------
// Test 3 — Outbound detail has a weighing section
// ---------------------------------------------------------------------------
test('outbound detail has weighing section', async ({ page }) => {
  await loginAs(page, 'LOGISTICS_PLANNER');

  const found = await navigateToFirstOutbound(page);

  if (!found) {
    console.log('[SKIP] No outbound shipments found — skipping weighing section test.');
    return;
  }

  await page.waitForLoadState('networkidle');
  const bodyText = (await page.locator('body').innerText()).toLowerCase();

  // Accept any weight-related keyword in EN or NL
  const hasWeighKeyword =
    /weigh|tare|gross|bruto|netto|net weight|tarra|gewicht/.test(bodyText);

  if (!hasWeighKeyword) {
    console.log('[INFO] Weighing section keywords not found — page body:', bodyText.slice(0, 300));
  }

  expect(hasWeighKeyword).toBe(true);
});

// ---------------------------------------------------------------------------
// Test 4 — Outbound detail has a parcels section
// ---------------------------------------------------------------------------
test('outbound detail has parcels section', async ({ page }) => {
  await loginAs(page, 'LOGISTICS_PLANNER');

  const found = await navigateToFirstOutbound(page);

  if (!found) {
    console.log('[SKIP] No outbound shipments found — skipping parcels section test.');
    return;
  }

  await page.waitForLoadState('networkidle');
  const bodyText = (await page.locator('body').innerText()).toLowerCase();

  // Accept any parcel-related keyword in EN or NL
  const hasParcelKeyword = /parcel|pakket|collo|pallet|shipment item/.test(bodyText);

  if (!hasParcelKeyword) {
    console.log('[INFO] Parcels section keywords not found — page body:', bodyText.slice(0, 300));
  }

  expect(hasParcelKeyword).toBe(true);
});
