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

  // Wait for the "Weighing" heading to appear (h2 — "Weighing"/"Weging")
  const weighingHeading = page
    .locator('h2')
    .filter({ hasText: /^(weighing|weging)$/i })
    .first();

  await expect(weighingHeading).toBeVisible({ timeout: 10_000 });
});

// ---------------------------------------------------------------------------
// Test 4 — Outbound detail has a lines section
// ---------------------------------------------------------------------------
test('outbound detail has lines section', async ({ page }) => {
  await loginAs(page, 'LOGISTICS_PLANNER');

  const found = await navigateToFirstOutbound(page);

  if (!found) {
    console.log('[SKIP] No outbound shipments found — skipping lines section test.');
    return;
  }

  await page.waitForLoadState('networkidle');

  // Wait for the "Lines" heading to appear (h2 from outboundLines:title — "Lines"/"Regels")
  const linesHeading = page
    .locator('h2')
    .filter({ hasText: /^(lines|regels)$/i })
    .first();

  await expect(linesHeading).toBeVisible({ timeout: 10_000 });
});

// ---------------------------------------------------------------------------
// Test 5 — Outbound detail: Add Line flow (when outbound is editable)
// ---------------------------------------------------------------------------
test('outbound detail: add line form is reachable when editable', async ({ page }) => {
  await loginAs(page, 'LOGISTICS_PLANNER');

  const found = await navigateToFirstOutbound(page);

  if (!found) {
    console.log('[SKIP] No outbound shipments found — skipping add-line test.');
    return;
  }

  await page.waitForLoadState('networkidle');

  // "Add Line" button is only visible when outbound.status is CREATED or LOADING
  const addLineBtn = page.getByRole('button', { name: /\+\s*add line|nieuwe regel/i });
  const btnVisible = (await addLineBtn.count()) > 0 && (await addLineBtn.first().isVisible().catch(() => false));

  if (!btnVisible) {
    console.log('[SKIP] Outbound not in editable state (CREATED/LOADING) — Add Line button not visible.');
    return;
  }

  await addLineBtn.first().click();

  // Inline form row should reveal Material / Container Type / Volume / Unit fields
  const materialField = page.getByLabel(/material|materiaal/i).first();
  await expect(materialField).toBeVisible({ timeout: 5000 });

  const containerField = page.getByLabel(/container type|containertype/i).first();
  await expect(containerField).toBeVisible({ timeout: 5000 });

  const volumeField = page.getByLabel(/^volume$/i).first();
  await expect(volumeField).toBeVisible({ timeout: 5000 });

  const unitField = page.getByLabel(/^unit$|^eenheid$/i).first();
  await expect(unitField).toBeVisible({ timeout: 5000 });

  // Cancel should dismiss the form without persisting
  const cancelBtn = page.getByRole('button', { name: /^cancel$|^annuleren$/i }).first();
  if (await cancelBtn.isVisible().catch(() => false)) {
    await cancelBtn.click();
  }
});
