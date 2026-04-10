/**
 * Pfister Cloud Weighbridge Client
 *
 * PRD §6.2 Interface Contract:
 *   requestWeighing(weighingType, previousWeightKg?, deviceId?, extra?) → Promise<PfisterTicket>
 *
 * This module is the ONLY place Pfister integration lives.
 * Makes real HTTP calls to the Pfister Cloud Service API.
 *
 * API: GET {baseUrl}/{deviceId}?command=weigh&timeout={ms}&format=json
 * Auth: HTTP Basic Authentication
 */

const prisma = require('../utils/prismaClient');

const ALLOWED_DEVICES = ['WB_1', 'WB_2', 'WB_3'];

/**
 * Parse Pfister timestamp format: "06-04-2026 11:52:16" (DD-MM-YYYY HH:MM:SS)
 * @param {string} ts
 * @returns {Date}
 */
function parsePfisterTimestamp(ts) {
  const match = ts.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) throw new Error(`Cannot parse Pfister timestamp: "${ts}"`);

  const [, day, month, year, hours, minutes, seconds] = match;
  return new Date(
    parseInt(year, 10),
    parseInt(month, 10) - 1,
    parseInt(day, 10),
    parseInt(hours, 10),
    parseInt(minutes, 10),
    parseInt(seconds, 10),
  );
}

/**
 * Parse weight from Pfister result string, e.g. "06040 kg" → 6040
 * @param {string} result
 * @returns {number}
 */
function parsePfisterWeight(result) {
  const match = result.match(/(\d+)\s*kg/i);
  if (!match) throw new Error(`Cannot parse Pfister weight: "${result}"`);
  return parseInt(match[1], 10);
}

/**
 * Request a weighing from the Pfister Cloud weighbridge.
 *
 * @param {'GROSS' | 'INTERMEDIATE' | 'TARE'} weighingType
 * @param {number} [previousWeightKg] - required for INTERMEDIATE and TARE
 * @param {string} [deviceId] - weighbridge device (WB_1, WB_2, WB_3)
 * @param {object} [extra] - optional extra params (e.g. inboundNumber for object param)
 * @returns {Promise<object>} PfisterTicket record
 */
async function requestWeighing(weighingType, previousWeightKg, deviceId, extra = {}) {
  const baseUrl = process.env.PFISTER_BASE_URL;
  const username = process.env.PFISTER_USERNAME;
  const password = process.env.PFISTER_PASSWORD;
  const timeoutMs = parseInt(process.env.PFISTER_TIMEOUT_MS || '5000', 10);
  const device = deviceId || process.env.PFISTER_DEFAULT_DEVICE || 'WB_1';

  if (!baseUrl) throw new Error('PFISTER_BASE_URL environment variable is not configured');
  if (!username) throw new Error('PFISTER_USERNAME environment variable is not configured');
  if (!password) throw new Error('PFISTER_PASSWORD environment variable is not configured');

  // Validate device against allowlist (defence-in-depth, primary check is in inboundService)
  if (!ALLOWED_DEVICES.includes(device)) {
    const err = new Error(`Invalid device ID: "${device}". Allowed: ${ALLOWED_DEVICES.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }

  // Build URL
  const url = new URL(`/${device}`, baseUrl);
  url.searchParams.set('command', 'weigh');
  url.searchParams.set('timeout', String(timeoutMs));
  url.searchParams.set('format', 'json');
  if (extra.inboundNumber) {
    url.searchParams.set('object', extra.inboundNumber);
  }

  // HTTP Basic Auth
  const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');

  // Client-side timeout (slightly longer than Pfister's own timeout)
  const controller = new AbortController();
  const clientTimeout = setTimeout(() => controller.abort(), timeoutMs + 3000);

  let response;
  try {
    response = await fetch(url.toString(), {
      method: 'GET',
      headers: { Authorization: authHeader },
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      const error = new Error(`Pfister weighbridge timeout after ${timeoutMs + 3000}ms`);
      error.statusCode = 504;
      throw error;
    }
    const error = new Error(`Pfister weighbridge connection failed: ${err.message}`);
    error.statusCode = 502;
    throw error;
  } finally {
    clearTimeout(clientTimeout);
  }

  if (!response.ok) {
    const error = new Error(`Pfister API returned HTTP ${response.status}`);
    error.statusCode = 502;
    throw error;
  }

  let data;
  try {
    data = await response.json();
  } catch (parseErr) {
    const error = new Error('Pfister API returned non-JSON response');
    error.statusCode = 502;
    throw error;
  }

  // Check Pfister-level error
  if (data.error !== '0') {
    const error = new Error(
      `Pfister weighing error (code ${data.error}): ${data.errortext || 'Unknown error'}`,
    );
    error.statusCode = 502;
    throw error;
  }

  // Parse response fields
  const weightKg = parsePfisterWeight(data.result);
  const scaleTimestamp = parsePfisterTimestamp(data.timestamp);
  const ticketNumber = data.sequencenumber;

  // Persist to database (plain insert — no transaction needed for a single write)
  const ticket = await prisma.pfisterTicket.create({
    data: {
      ticket_number: ticketNumber,
      weighing_type: weighingType,
      weight_kg: weightKg,
      unit: 'kg',
      timestamp: scaleTimestamp,
      device_id: device,
      raw_payload: JSON.stringify(data),
    },
  });

  return ticket;
}

module.exports = { requestWeighing, ALLOWED_DEVICES };
