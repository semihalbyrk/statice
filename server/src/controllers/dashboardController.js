const prisma = require('../utils/prismaClient');

async function getStats(req, res, next) {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const tomorrowEnd = new Date(tomorrowStart);
    tomorrowEnd.setHours(23, 59, 59, 999);

    const [
      todayArrivals,
      plannedOrders,
      inProgressOrders,
      completedToday,
      tomorrowOrders,
      activeInbounds,
      recentOrders,
      todayInboundsTable,
      recentReports,
    ] = await Promise.all([
      prisma.inboundOrder.count({
        where: {
          status: { in: ['IN_PROGRESS', 'COMPLETED'] },
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
      prisma.inboundOrder.count({
        where: {
          status: 'PLANNED',
          planned_date: { gte: tomorrowStart, lte: tomorrowEnd },
        },
      }),
      prisma.inbound.count({
        where: {
          status: { in: ['ARRIVED', 'WEIGHED_IN', 'WEIGHED_OUT', 'READY_FOR_SORTING'] },
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
      prisma.inbound.findMany({
        where: {
          arrived_at: { gte: todayStart, lte: todayEnd },
        },
        take: 20,
        orderBy: { arrived_at: 'desc' },
        include: {
          vehicle: { select: { registration_plate: true } },
          order: {
            select: {
              order_number: true,
              vehicle_plate: true,
              carrier: { select: { name: true } },
              supplier: { select: { name: true } },
            },
          },
          assets: { select: { id: true } },
        },
      }),
      prisma.report.findMany({
        take: 5,
        orderBy: { generated_at: 'desc' },
        select: {
          id: true,
          type: true,
          generated_at: true,
          file_path_pdf: true,
          file_path_xlsx: true,
        },
      }),
    ]);

    return res.json({
      todayArrivals,
      plannedOrders,
      inProgressOrders,
      completedToday,
      tomorrowOrders,
      activeInbounds,
      recentOrders,
      todayInboundsTable: todayInboundsTable.map((e) => ({
        id: e.id,
        vehicle_plate: e.vehicle?.registration_plate || e.order?.vehicle_plate || '—',
        carrier: e.order?.carrier?.name || '—',
        supplier: e.order?.supplier?.name || '—',
        order_number: e.order?.order_number,
        skips_registered: e.assets?.length || 0,
        status: e.status,
        arrived_at: e.arrived_at,
      })),
      recentReports,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getStats };
