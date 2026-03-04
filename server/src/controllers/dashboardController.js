const prisma = require('../utils/prismaClient');

async function getStats(req, res, next) {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [todayArrivals, plannedOrders, inProgressOrders, completedToday, recentOrders] = await Promise.all([
      prisma.inboundOrder.count({
        where: {
          status: { in: ['ARRIVED', 'IN_PROGRESS', 'COMPLETED'] },
          updated_at: { gte: todayStart, lte: todayEnd },
        },
      }),
      prisma.inboundOrder.count({ where: { status: 'PLANNED' } }),
      prisma.inboundOrder.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.inboundOrder.count({
        where: {
          status: 'COMPLETED',
          updated_at: { gte: todayStart, lte: todayEnd },
        },
      }),
      prisma.inboundOrder.findMany({
        take: 5,
        orderBy: { updated_at: 'desc' },
        include: {
          carrier: { select: { id: true, name: true } },
          supplier: { select: { id: true, name: true } },
        },
      }),
    ]);

    return res.json({
      todayArrivals,
      plannedOrders,
      inProgressOrders,
      completedToday,
      recentOrders,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getStats };
