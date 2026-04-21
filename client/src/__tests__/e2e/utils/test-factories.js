/**
 * Test Data Factories for Statice E2E Tests
 * Reference data matching what prisma/seed.js inserts.
 * ES module (client/ has "type": "module").
 */

const BASE_TIMESTAMP = new Date('2026-04-14').toISOString();

export function createSupplier(overrides = {}) {
  return { id: 'supplier-wecycle', name: 'Wecycle', is_active: true, created_at: BASE_TIMESTAMP, ...overrides };
}

export function createCarrier(overrides = {}) {
  return { id: 'carrier-renewi', name: 'Renewi Nederland B.V.', is_active: true, created_at: BASE_TIMESTAMP, ...overrides };
}

export function createWasteStream(overrides = {}) {
  return { id: 'ws-1', code: '160118', name: 'Mixed electronic waste', is_active: true, ...overrides };
}

export function createContract(overrides = {}) {
  return { id: 'contract-1', name: '2026 Renewi WEEE Outbound Agreement', contract_type: 'OUTGOING', status: 'ACTIVE', ...overrides };
}

export function createSortingSession(overrides = {}) {
  return { id: 'seed-session-005', status: 'PLANNED', catalogue_status: 'NOT_STARTED', ...overrides };
}

export function createInbound(overrides = {}) {
  return { id: 'seed-inbound-006', inbound_number: 'Inbound #6', status: 'ARRIVED', ...overrides };
}
