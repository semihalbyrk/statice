export function getSortingName(session) {
  const inboundNumber = session?.inbound?.inbound_number;
  if (inboundNumber) {
    return inboundNumber.replace(/^INB-/i, 'SRT-');
  }

  if (session?.id) {
    return `SRT-${session.id.slice(0, 8).toUpperCase()}`;
  }

  return 'SRT-';
}
