/**
 * Order status state machine.
 *
 * Valid transitions:
 *   PLANNED     → ARRIVED, CANCELLED
 *   ARRIVED     → IN_PROGRESS, CANCELLED
 *   IN_PROGRESS → COMPLETED
 *   COMPLETED   → (terminal)
 *   CANCELLED   → (terminal)
 */

const TRANSITIONS = {
  PLANNED: ['ARRIVED', 'CANCELLED'],
  ARRIVED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

function canTransition(from, to) {
  return TRANSITIONS[from]?.includes(to) || false;
}

function getAllowedTransitions(from) {
  return TRANSITIONS[from] || [];
}

module.exports = { canTransition, getAllowedTransitions, TRANSITIONS };
