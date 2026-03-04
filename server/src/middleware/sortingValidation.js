const prisma = require('../utils/prismaClient');

const PCT_FIELDS = ['recycled_pct', 'reused_pct', 'disposed_pct', 'landfill_pct'];

/**
 * Validate that recovery rate percentages sum to exactly 100.
 * If no pct fields are present in the body, passes through (allows partial PUT).
 * If any pct field is present, all four must be present and sum to 100.
 */
function validatePctSum(req, res, next) {
  const anyPresent = PCT_FIELDS.some((f) => req.body[f] !== undefined);
  if (!anyPresent) return next();

  const missing = PCT_FIELDS.filter((f) => req.body[f] === undefined);
  if (missing.length > 0) {
    return res.status(422).json({
      error: 'All four recovery rate fields are required when updating percentages',
      missing_fields: missing,
    });
  }

  const values = PCT_FIELDS.map((f) => Number(req.body[f]));
  const sum = Math.round(values.reduce((a, b) => a + b, 0) * 100) / 100;

  if (sum !== 100) {
    return res.status(422).json({
      error: 'Recovery rates must sum to 100',
      received_sum: sum,
      fields: {
        recycled_pct: Number(req.body.recycled_pct),
        reused_pct: Number(req.body.reused_pct),
        disposed_pct: Number(req.body.disposed_pct),
        landfill_pct: Number(req.body.landfill_pct),
      },
    });
  }

  next();
}

/**
 * Validate that the sorting session (from :sessionId param) is in DRAFT status.
 * Returns 404 if session not found, 409 if session is SUBMITTED.
 */
async function validateSessionDraft(req, res, next) {
  try {
    const session = await prisma.sortingSession.findUnique({
      where: { id: req.params.sessionId },
      select: { status: true },
    });

    if (!session) {
      return res.status(404).json({ error: 'Sorting session not found' });
    }

    if (session.status !== 'DRAFT') {
      return res.status(409).json({
        error: 'Sorting session is locked',
        message: 'This record has been submitted and cannot be modified. Contact an administrator to reopen.',
      });
    }

    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { validatePctSum, validateSessionDraft };
