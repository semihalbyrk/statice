const TRANSITIONS = {
  PLANNED: ['ARRIVED', 'CANCELLED'],
  ARRIVED: ['IN_PROGRESS', 'DISPUTE', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'DISPUTE', 'CANCELLED'],
  DISPUTE: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  COMPLETED: ['INVOICED'],
  INVOICED: [],
  CANCELLED: ['PLANNED'],
};

function canTransition(from, to) {
  return TRANSITIONS[from]?.includes(to) || false;
}

function getAllowedTransitions(from) {
  return TRANSITIONS[from] || [];
}

module.exports = { canTransition, getAllowedTransitions, TRANSITIONS };
