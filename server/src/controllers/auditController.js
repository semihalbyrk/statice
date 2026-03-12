const prisma = require('../utils/prismaClient');
const asyncHandler = require('../middleware/asyncHandler');
const AppError = require('../middleware/AppError');

const list = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
  const skip = (page - 1) * limit;

  const where = {};
  if (req.query.user_id) where.user_id = req.query.user_id;
  if (req.query.entity_type) where.entity_type = req.query.entity_type;
  if (req.query.action) where.action = req.query.action;
  if (req.query.search) {
    where.entity_id = { contains: req.query.search, mode: 'insensitive' };
  }

  if (req.query.date_from || req.query.date_to) {
    where.timestamp = {};
    if (req.query.date_from) where.timestamp.gte = new Date(req.query.date_from);
    if (req.query.date_to) {
      const dateTo = new Date(req.query.date_to);
      dateTo.setDate(dateTo.getDate() + 1);
      where.timestamp.lt = dateTo;
    }
  }

  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { email: true, full_name: true } } },
      orderBy: { timestamp: 'desc' },
      skip,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  res.json({ entries, total, page, totalPages: Math.ceil(total / limit) });
});

const getById = asyncHandler(async (req, res) => {
  const entry = await prisma.auditLog.findUnique({
    where: { id: req.params.id },
    include: { user: { select: { email: true, full_name: true } } },
  });
  if (!entry) throw new AppError('Audit log entry not found', 404);
  res.json({ data: entry });
});

module.exports = { list, getById };
