const VALID_TRANSITIONS = {
  PLANNED:     ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED:   ['INVOICED'],
  INVOICED:    [],
  CANCELLED:   [],
};

/**
 * Check whether a status transition is allowed.
 *
 * @param {string} from - current status
 * @param {string} to   - target status
 * @returns {boolean}
 */
function canTransition(from, to) {
  return VALID_TRANSITIONS[from]?.includes(to) || false;
}

/**
 * Validate a status transition; throws if not allowed.
 *
 * @param {string} from - current status
 * @param {string} to   - target status
 * @throws {Error} when the transition is invalid
 */
function validateTransition(from, to) {
  if (!canTransition(from, to)) {
    const allowed = VALID_TRANSITIONS[from] || [];
    const msg = allowed.length
      ? `Cannot transition from ${from} to ${to}. Allowed: ${allowed.join(', ')}`
      : `Cannot transition from ${from} — no transitions allowed`;
    const err = new Error(msg);
    err.statusCode = 400;
    throw err;
  }
}

module.exports = { VALID_TRANSITIONS, canTransition, validateTransition };
