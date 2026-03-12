const TRANSITIONS = {
  PLANNED: ['ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  ARRIVED: ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: ['PLANNED', 'ARRIVED'],
};

function canTransition(from, to) {
  return TRANSITIONS[from]?.includes(to) || false;
}

function getAllowedTransitions(from) {
  return TRANSITIONS[from] || [];
}

module.exports = { canTransition, getAllowedTransitions, TRANSITIONS };
