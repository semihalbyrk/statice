const prisma = require('../utils/prismaClient');
const { requestWeighing } = require('./pfisterSimulator');

async function logPfisterIngress(data) {
  return prisma.pfisterIngressLog.create({
    data: {
      source: data.source,
      protocol: data.protocol || null,
      payload: typeof data.payload === 'string' ? data.payload : JSON.stringify(data.payload),
      status: data.status || 'RECEIVED',
      error_message: data.error_message || null,
      processed_at: data.processed_at || null,
    },
  });
}

async function requestPfisterWeighing(weighingType, previousWeightKg, context = {}) {
  const payload = {
    weighing_type: weighingType,
    previous_weight_kg: previousWeightKg ?? null,
    inbound_id: context.inboundId || null,
    sequence: context.sequence || null,
    mode: context.mode || 'SIMULATOR',
  };

  const ingress = await logPfisterIngress({
    source: context.source || 'PFISTER_GATEWAY',
    protocol: context.protocol || 'SIMULATOR',
    payload,
    status: 'REQUESTED',
  });

  try {
    const ticket = await requestWeighing(weighingType, previousWeightKg);
    await prisma.pfisterIngressLog.update({
      where: { id: ingress.id },
      data: {
        status: 'PROCESSED',
        processed_at: new Date(),
        payload: JSON.stringify({
          ...payload,
          pfister_ticket_id: ticket.id,
          ticket_number: ticket.ticket_number,
          resolved_weight_kg: Number(ticket.weight_kg),
        }),
      },
    });
    return ticket;
  } catch (error) {
    await prisma.pfisterIngressLog.update({
      where: { id: ingress.id },
      data: {
        status: 'FAILED',
        error_message: error.message,
        processed_at: new Date(),
      },
    });
    throw error;
  }
}

module.exports = {
  logPfisterIngress,
  requestPfisterWeighing,
};
