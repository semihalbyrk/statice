const prisma = require('../utils/prismaClient');

async function list(req, res, next) {
  try {
    const notifications = await prisma.notification.findMany({
      where: { user_id: req.user.userId },
      orderBy: { created_at: 'desc' },
      take: 50,
    });
    const unreadCount = await prisma.notification.count({
      where: { user_id: req.user.userId, is_read: false },
    });
    res.json({ data: notifications, unreadCount });
  } catch (err) { next(err); }
}

async function markRead(req, res, next) {
  try {
    await prisma.notification.update({
      where: { id: req.params.id },
      data: { is_read: true },
    });
    res.json({ success: true });
  } catch (err) { next(err); }
}

async function markAllRead(req, res, next) {
  try {
    await prisma.notification.updateMany({
      where: { user_id: req.user.userId, is_read: false },
      data: { is_read: true },
    });
    res.json({ success: true });
  } catch (err) { next(err); }
}

module.exports = { list, markRead, markAllRead };
