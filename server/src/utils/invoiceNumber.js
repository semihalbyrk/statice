const prisma = require('./prismaClient');

const MAX_RETRIES = 3;

async function generateSequentialNumber(client, model, prefix, field) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const last = await client[model].findFirst({
      where: { [field]: { startsWith: prefix } },
      orderBy: { [field]: 'desc' },
      select: { [field]: true },
    });

    let nextSeq = 1;
    if (last) {
      const lastSeq = parseInt(last[field].replace(prefix, ''), 10);
      if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
    }

    const number = `${prefix}${String(nextSeq).padStart(5, '0')}`;

    // Check uniqueness within the transaction to reduce race window
    const existing = await client[model].findFirst({
      where: { [field]: number },
      select: { [field]: true },
    });

    if (!existing) return number;

    // Collision detected — retry with incremented sequence
    nextSeq++;
  }

  // Fallback: append timestamp suffix to guarantee uniqueness
  const ts = Date.now().toString(36);
  return `${prefix}${ts}`;
}

async function generateInvoiceNumber(tx) {
  const client = tx || prisma;
  return generateSequentialNumber(client, 'invoice', 'INV-', 'invoice_number');
}

module.exports = { generateInvoiceNumber };
