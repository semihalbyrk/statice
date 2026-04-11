/**
 * Unit tests for pfisterSimulator.js
 *
 * Pure parsing functions are tested via exported helpers.
 * The full requestWeighing flow is tested with the real DB (mocked fetch)
 * and cleaned up after each test.
 */
import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';

// We need the parsing functions. Since the source only exports requestWeighing,
// we test parsing indirectly through the full flow. For the DB-writing tests,
// we use real Prisma and clean up.
const prisma = (await import('../utils/prismaClient.js')).default;

// Track created ticket IDs for cleanup
const createdTicketIds = [];

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());

  process.env.PFISTER_BASE_URL = 'https://pfister.example.com';
  process.env.PFISTER_USERNAME = 'user';
  process.env.PFISTER_PASSWORD = 'pass';
  process.env.PFISTER_TIMEOUT_MS = '5000';
  process.env.PFISTER_DEFAULT_DEVICE = 'WB_1';
});

afterEach(() => {
  vi.unstubAllGlobals();
});

afterAll(async () => {
  // Clean up any tickets created during tests
  if (createdTicketIds.length > 0) {
    await prisma.pfisterTicket.deleteMany({
      where: { id: { in: createdTicketIds } },
    });
  }
  delete process.env.PFISTER_BASE_URL;
  delete process.env.PFISTER_USERNAME;
  delete process.env.PFISTER_PASSWORD;
  delete process.env.PFISTER_TIMEOUT_MS;
  delete process.env.PFISTER_DEFAULT_DEVICE;
  await prisma.$disconnect();
});

const { requestWeighing } = await import('../services/pfisterSimulator.js');

// Use unique sequence numbers to avoid unique constraint collisions
let seqCounter = 0;
function uniqueSeq() {
  seqCounter += 1;
  return `PF-TEST-${Date.now()}-${seqCounter}`;
}

function pfisterResponse(overrides = {}) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({
      error: '0',
      errortext: '',
      result: '06040 kg',
      timestamp: '12-04-2023 11:14:03',
      sequencenumber: uniqueSeq(),
      ...overrides,
    }),
  };
}

// Helper that runs requestWeighing and tracks the ticket for cleanup
async function callAndTrack(...args) {
  const ticket = await requestWeighing(...args);
  createdTicketIds.push(ticket.id);
  return ticket;
}

describe('parsePfisterTimestamp (via requestWeighing)', () => {
  it('parses a valid Pfister timestamp correctly', async () => {
    fetch.mockResolvedValue(pfisterResponse({ timestamp: '01-01-2024 00:00:00' }));
    const ticket = await callAndTrack('GROSS');
    expect(ticket.timestamp).toEqual(new Date(2024, 0, 1, 0, 0, 0));
  });

  it('parses single-digit day (zero-padded)', async () => {
    fetch.mockResolvedValue(pfisterResponse({ timestamp: '05-03-2025 09:30:15' }));
    const ticket = await callAndTrack('GROSS');
    expect(ticket.timestamp).toEqual(new Date(2025, 2, 5, 9, 30, 15));
  });

  it('throws on invalid timestamp format', async () => {
    fetch.mockResolvedValue(pfisterResponse({ timestamp: '2024-01-01T00:00:00Z' }));
    await expect(requestWeighing('GROSS')).rejects.toThrow('Cannot parse Pfister timestamp');
  });

  it('throws on non-numeric timestamp', async () => {
    fetch.mockResolvedValue(pfisterResponse({ timestamp: 'not-a-date at all' }));
    await expect(requestWeighing('GROSS')).rejects.toThrow('Cannot parse Pfister timestamp');
  });
});

describe('parsePfisterWeight (via requestWeighing)', () => {
  it('parses zero-padded weight "06040 kg" to 6040', async () => {
    fetch.mockResolvedValue(pfisterResponse({ result: '06040 kg' }));
    const ticket = await callAndTrack('GROSS');
    expect(Number(ticket.weight_kg)).toBe(6040);
  });

  it('parses weight without leading zeros', async () => {
    fetch.mockResolvedValue(pfisterResponse({ result: '120 kg' }));
    const ticket = await callAndTrack('GROSS');
    expect(Number(ticket.weight_kg)).toBe(120);
  });

  it('parses weight with mixed case "KG"', async () => {
    fetch.mockResolvedValue(pfisterResponse({ result: '500 KG' }));
    const ticket = await callAndTrack('GROSS');
    expect(Number(ticket.weight_kg)).toBe(500);
  });

  it('throws on unparseable weight', async () => {
    fetch.mockResolvedValue(pfisterResponse({ result: 'error - no weight' }));
    await expect(requestWeighing('GROSS')).rejects.toThrow('Cannot parse Pfister weight');
  });
});

describe('URL construction', () => {
  it('uses the provided deviceId in the URL path', async () => {
    fetch.mockResolvedValue(pfisterResponse());
    await callAndTrack('GROSS', null, 'WB_2');
    const calledUrl = new URL(fetch.mock.calls[0][0]);
    expect(calledUrl.pathname).toBe('/WB_2');
    expect(calledUrl.searchParams.get('command')).toBe('weigh');
    expect(calledUrl.searchParams.get('format')).toBe('json');
  });

  it('falls back to PFISTER_DEFAULT_DEVICE when no deviceId given', async () => {
    fetch.mockResolvedValue(pfisterResponse());
    await callAndTrack('TARE', 6040);
    const calledUrl = new URL(fetch.mock.calls[0][0]);
    expect(calledUrl.pathname).toBe('/WB_1');
  });

  it('includes inboundNumber as object param when provided', async () => {
    fetch.mockResolvedValue(pfisterResponse());
    await callAndTrack('GROSS', null, 'WB_1', { inboundNumber: 'INB-100' });
    const calledUrl = new URL(fetch.mock.calls[0][0]);
    expect(calledUrl.searchParams.get('object')).toBe('INB-100');
  });

  it('sends Basic Auth header', async () => {
    fetch.mockResolvedValue(pfisterResponse());
    await callAndTrack('GROSS');
    const headers = fetch.mock.calls[0][1].headers;
    const expected = 'Basic ' + Buffer.from('user:pass').toString('base64');
    expect(headers.Authorization).toBe(expected);
  });
});

describe('HTTP error handling', () => {
  it('throws 502 when Pfister returns non-ok HTTP status', async () => {
    fetch.mockResolvedValue({ ok: false, status: 500 });
    await expect(requestWeighing('GROSS')).rejects.toThrow('Pfister API returned HTTP 500');
  });

  it('throws 502 on Pfister-level error (error !== "0")', async () => {
    fetch.mockResolvedValue(pfisterResponse({ error: '3', errortext: 'Scale busy' }));
    await expect(requestWeighing('GROSS')).rejects.toThrow(
      'Pfister weighing error (code 3): Scale busy',
    );
  });

  it('throws 502 on network failure', async () => {
    fetch.mockRejectedValue(new TypeError('fetch failed'));
    await expect(requestWeighing('GROSS')).rejects.toThrow(
      'Pfister weighbridge connection failed: fetch failed',
    );
  });

  it('throws 504 on abort (timeout)', async () => {
    const abortError = new DOMException('signal is aborted', 'AbortError');
    fetch.mockRejectedValue(abortError);
    await expect(requestWeighing('GROSS')).rejects.toThrow('Pfister weighbridge timeout');
  });

  it('throws when PFISTER_BASE_URL is not set', async () => {
    delete process.env.PFISTER_BASE_URL;
    await expect(requestWeighing('GROSS')).rejects.toThrow(
      'PFISTER_BASE_URL environment variable is not configured',
    );
    // Restore for other tests
    process.env.PFISTER_BASE_URL = 'https://pfister.example.com';
  });
});

describe('ticket persistence', () => {
  it('creates a PfisterTicket with correct fields in the database', async () => {
    const seq = uniqueSeq();
    fetch.mockResolvedValue(pfisterResponse({ sequencenumber: seq }));
    const ticket = await callAndTrack('TARE', 6040, 'WB_3');

    expect(ticket.ticket_number).toBe(seq);
    expect(ticket.weighing_type).toBe('TARE');
    expect(Number(ticket.weight_kg)).toBe(6040);
    expect(ticket.device_id).toBe('WB_3');
    expect(ticket.unit).toBe('kg');
    expect(ticket.raw_payload).toBeDefined();

    // Verify it actually persisted
    const fromDb = await prisma.pfisterTicket.findUnique({ where: { id: ticket.id } });
    expect(fromDb).not.toBeNull();
    expect(fromDb.ticket_number).toBe(seq);
  });
});
