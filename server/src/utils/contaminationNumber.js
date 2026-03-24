const prisma = require('./prismaClient');

const MAX_RETRIES = 3;

async function generateContaminationNumber(tx) {
  const client = tx || prisma;
  const prefix = 'CON-';

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const last = await client.contaminationIncident.findFirst({
      where: { incident_number: { startsWith: prefix } },
      orderBy: { incident_number: 'desc' },
      select: { incident_number: true },
    });

    let nextSeq = 1;
    if (last) {
      const lastSeq = parseInt(last.incident_number.replace(prefix, ''), 10);
      if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
    }

    const number = `${prefix}${String(nextSeq).padStart(5, '0')}`;

    const existing = await client.contaminationIncident.findFirst({
      where: { incident_number: number },
      select: { incident_number: true },
    });

    if (!existing) return number;
  }

  const ts = Date.now().toString(36);
  return `${prefix}${ts}`;
}

module.exports = { generateContaminationNumber };
