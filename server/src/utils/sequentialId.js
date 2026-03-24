const MAX_RETRIES = 5;

/**
 * Generate a sequential ID in format `PREFIX-NNNNN` with collision protection.
 *
 * Algorithm:
 *  1. Fetch ALL records whose field starts with `prefix`.
 *  2. Keep only those whose suffix is pure digits (ignores legacy formats like ORD-2026-001).
 *  3. Take the max sequence number and increment.
 *  4. Verify uniqueness; retry on collision (up to MAX_RETRIES).
 *  5. Fallback: append a base-36 timestamp to guarantee uniqueness.
 *
 * @param {import('@prisma/client').PrismaClient} client  Prisma client (or tx)
 * @param {string} model    Prisma model name (e.g. 'inboundOrder')
 * @param {string} field    The unique field name (e.g. 'order_number')
 * @param {string} prefix   ID prefix including trailing dash (e.g. 'ORD-')
 * @param {number} [pad=5]  Zero-pad width
 * @returns {Promise<string>}
 */
async function generateSequentialId(client, model, field, prefix, pad = 5) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    // 1. Fetch all records with the prefix
    const records = await client[model].findMany({
      where: { [field]: { startsWith: prefix } },
      select: { [field]: true },
    });

    // 2. Extract max sequence from records with pure-digit suffix only
    let maxSeq = 0;
    for (const r of records) {
      const suffix = r[field].slice(prefix.length);
      if (/^\d+$/.test(suffix)) {
        const seq = parseInt(suffix, 10);
        if (seq > maxSeq) maxSeq = seq;
      }
    }

    const nextSeq = maxSeq + 1 + attempt; // offset by attempt to avoid re-generating same number
    const number = `${prefix}${String(nextSeq).padStart(pad, '0')}`;

    // 3. Verify uniqueness
    const existing = await client[model].findFirst({
      where: { [field]: number },
      select: { [field]: true },
    });

    if (!existing) return number;
  }

  // Fallback: timestamp-based to guarantee uniqueness
  const ts = Date.now().toString(36);
  return `${prefix}${ts}`;
}

module.exports = { generateSequentialId };
