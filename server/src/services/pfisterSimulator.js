/**
 * Pfister Weighbridge Simulator
 *
 * PRD §6.2 Interface Contract:
 *   requestWeighing(weighingType, previousWeightKg?) → Promise<PfisterTicket>
 *
 * This module is the ONLY place Pfister integration lives.
 * Replacing this file with a real Pfister API client requires zero changes elsewhere.
 *
 * Simulated behaviour:
 *   - 1500ms network delay
 *   - GROSS: random weight 8000–24000 kg
 *   - INTERMEDIATE: previousWeight minus a realistic parcel weight (500–4000 kg)
 *   - TARE: random 4000–7000 kg, capped at previousWeight - 200
 *   - Ticket number: PF-NNNNN (random 5-digit)
 *   - Creates PfisterTicket record in DB
 */

const prisma = require('../utils/prismaClient');

/**
 * Generate a random 5-digit Pfister ticket number.
 * @returns {string}
 */
function generateTicketNumber() {
  const num = Math.floor(10000 + Math.random() * 90000);
  return `PF-${num}`;
}

/**
 * Simulate a random weight within a range.
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function randomWeight(min, max) {
  return Math.round(min + Math.random() * (max - min));
}

/**
 * Request a weighing from the Pfister weighbridge.
 *
 * @param {'GROSS' | 'INTERMEDIATE' | 'TARE'} weighingType
 * @param {number} [previousWeightKg] - required for INTERMEDIATE and TARE
 * @returns {Promise<object>} PfisterTicket record
 */
async function requestWeighing(weighingType, previousWeightKg) {
  // Simulate network/hardware delay
  await new Promise((r) => setTimeout(r, 1500));

  let weightKg;
  if (weighingType === 'GROSS') {
    weightKg = randomWeight(8000, 24000);
  } else if (weighingType === 'INTERMEDIATE') {
    if (!previousWeightKg) throw new Error('previousWeightKg required for INTERMEDIATE weighing');
    const parcelWeight = randomWeight(500, 4000);
    weightKg = Math.max(5000, previousWeightKg - parcelWeight);
  } else if (weighingType === 'TARE') {
    const rawTare = randomWeight(4000, 7000);
    const maxTare = previousWeightKg ? previousWeightKg - 200 : 7000;
    weightKg = Math.min(rawTare, maxTare);
  } else {
    throw new Error(`Invalid weighing type: ${weighingType}`);
  }

  const timestamp = new Date();

  const ticket = await prisma.$transaction(async (tx) => {
    const ticketNumber = generateTicketNumber();

    return tx.pfisterTicket.create({
      data: {
        ticket_number: ticketNumber,
        weighing_type: weighingType,
        weight_kg: weightKg,
        unit: 'kg',
        timestamp,
        raw_payload: JSON.stringify({
          simulator: true,
          weighing_type: weighingType,
          weight_kg: weightKg,
          ticket_number: ticketNumber,
          timestamp: timestamp.toISOString(),
        }),
      },
    });
  });

  return ticket;
}

module.exports = { requestWeighing };
