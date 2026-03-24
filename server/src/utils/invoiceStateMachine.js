const TRANSITIONS = {
  DRAFT: ['FINALIZED', 'CANCELLED'],
  FINALIZED: ['CANCELLED'],
  CANCELLED: [],
};

function canTransition(from, to) {
  const allowed = TRANSITIONS[from];
  return Array.isArray(allowed) && allowed.includes(to);
}

function getAllowedTransitions(from) {
  return TRANSITIONS[from] || [];
}

module.exports = { canTransition, getAllowedTransitions };
