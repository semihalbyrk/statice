/**
 * Weighing event status state machine.
 *
 * Valid transitions:
 *   PENDING_GROSS → GROSS_COMPLETE
 *   GROSS_COMPLETE → PENDING_TARE
 *   PENDING_TARE → TARE_COMPLETE
 *   TARE_COMPLETE → CONFIRMED
 *   CONFIRMED → (terminal)
 */

const TRANSITIONS = {
  PENDING_GROSS: ['GROSS_COMPLETE'],
  GROSS_COMPLETE: ['PENDING_TARE'],
  PENDING_TARE: ['TARE_COMPLETE'],
  TARE_COMPLETE: ['CONFIRMED'],
  CONFIRMED: [],
};

function canTransition(from, to) {
  return TRANSITIONS[from]?.includes(to) || false;
}

function getAllowedTransitions(from) {
  return TRANSITIONS[from] || [];
}

module.exports = { canTransition, getAllowedTransitions, TRANSITIONS };
