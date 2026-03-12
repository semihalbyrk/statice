/**
 * Inbound status state machine.
 *
 * Valid transitions:
 *   ARRIVED           → WEIGHED_IN         (auto: after Pfister gross)
 *   WEIGHED_IN        → WEIGHED_OUT        (auto: after Pfister tare + distribution)
 *   WEIGHED_OUT       → READY_FOR_SORTING  (manual: operator marks ready)
 *   READY_FOR_SORTING → SORTED             (auto: sorting process submitted)
 *   SORTED            → (terminal)
 */

const TRANSITIONS = {
  ARRIVED: ['WEIGHED_IN'],
  WEIGHED_IN: ['WEIGHED_OUT'],
  WEIGHED_OUT: ['READY_FOR_SORTING'],
  READY_FOR_SORTING: ['SORTED'],
  SORTED: [],
};

function canTransition(from, to) {
  return TRANSITIONS[from]?.includes(to) || false;
}

function getAllowedTransitions(from) {
  return TRANSITIONS[from] || [];
}

module.exports = { canTransition, getAllowedTransitions, TRANSITIONS };
