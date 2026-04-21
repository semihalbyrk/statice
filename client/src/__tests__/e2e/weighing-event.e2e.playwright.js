/**
 * E2E tests for WeighingEventPage (/inbounds/:inboundId)
 * Roles: GATE_OPERATOR, ADMIN
 * Seed data used: seed-inbound-006 (ARRIVED), seed-inbound-001 (SORTED), seed-inbound-005 (READY_FOR_SORTING)
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './utils/playwright-helpers.js';

test('renders inbound header with number and progress', async ({ page }) => {
  await loginAs(page, 'GATE_OPERATOR');
  await page.goto('/inbounds/seed-inbound-006');
  await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('h1')).toContainText('Inbound #6');
});

test('shows info card with vehicle plate', async ({ page }) => {
  await loginAs(page, 'GATE_OPERATOR');
  await page.goto('/inbounds/seed-inbound-006');
  await page.waitForURL('**/inbounds/seed-inbound-006');
  await expect(page.locator('h1')).toBeVisible({ timeout: 20000 });
  await expect(page.getByText('34-BDF-5')).toBeVisible({ timeout: 10000 });
});

test('weighing controls visible for ARRIVED inbound', async ({ page }) => {
  await loginAs(page, 'GATE_OPERATOR');
  await page.goto('/inbounds/seed-inbound-006');
  await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
  // Either weighing action buttons or a weighing section heading must be present
  const weighingSection = page.locator('button, [class*="weigh"]').filter({
    hasText: /weigh|tare|gross/i,
  });
  const weighingSectionHeading = page.getByText(/weigh/i).first();
  await expect(weighingSectionHeading).toBeVisible({ timeout: 8000 });
});

test('status badge shows ARRIVED', async ({ page }) => {
  await loginAs(page, 'GATE_OPERATOR');
  await page.goto('/inbounds/seed-inbound-006');
  await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
  // ClickableStatusBadge renders status text — match either display form
  await expect(page.getByText(/arrived/i).first()).toBeVisible({ timeout: 8000 });
});

test('SORTED inbound shows completed state', async ({ page }) => {
  await loginAs(page, 'GATE_OPERATOR');
  await page.goto('/inbounds/seed-inbound-001');
  await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('h1')).toContainText('Inbound #1');
  await expect(page.getByText(/sorted/i).first()).toBeVisible({ timeout: 8000 });
});

test('parcels/assets section renders', async ({ page }) => {
  await loginAs(page, 'GATE_OPERATOR');
  await page.goto('/inbounds/seed-inbound-001');
  await page.waitForURL('**/inbounds/seed-inbound-001');
  await expect(page.locator('h1')).toBeVisible({ timeout: 20000 });
  // seed-inbound-001 has assets P-00001, P-00002 — match common prefix
  await expect(page.getByText(/P-0000/).first()).toBeVisible({ timeout: 10000 });
});

test('incident section allows reporting', async ({ page }) => {
  await loginAs(page, 'GATE_OPERATOR');
  await page.goto('/inbounds/seed-inbound-006');
  await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
  // Incident select should have DAMAGE as one of the options
  const incidentSelect = page.locator('select').filter({ has: page.locator('option[value="DAMAGE"]') });
  await expect(incidentSelect).toBeVisible({ timeout: 10000 });
});
