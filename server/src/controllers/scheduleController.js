const prisma = require('../utils/prismaClient');
const { writeAuditLog } = require('../utils/auditLog');

const VALID_FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY'];
const VALID_FORMATS = ['PDF', 'XLSX', 'BOTH'];
const VALID_REPORT_TYPES = ['RPT-01', 'RPT-02', 'RPT-03', 'RPT-04', 'RPT-05', 'RPT-06', 'RPT-07'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function computeNextRunAt(frequency, dayOfWeek, dayOfMonth, fromDate) {
  const now = fromDate || new Date();
  const next = new Date(now);

  switch (frequency) {
    case 'DAILY':
      next.setDate(next.getDate() + 1);
      next.setHours(6, 0, 0, 0);
      break;

    case 'WEEKLY': {
      const targetDay = dayOfWeek != null ? dayOfWeek : 1; // default Monday
      let daysUntil = targetDay - now.getDay();
      if (daysUntil <= 0) daysUntil += 7;
      next.setDate(now.getDate() + daysUntil);
      next.setHours(6, 0, 0, 0);
      break;
    }

    case 'MONTHLY': {
      const targetDom = dayOfMonth || 1;
      next.setMonth(next.getMonth() + 1);
      const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      next.setDate(Math.min(targetDom, lastDay));
      next.setHours(6, 0, 0, 0);
      break;
    }

    default:
      next.setDate(next.getDate() + 1);
      next.setHours(6, 0, 0, 0);
  }

  return next;
}

async function create(req, res, next) {
  try {
    const { report_type, frequency, day_of_week, day_of_month, recipient_emails, format, parameters } = req.body;

    // Validate
    if (!VALID_REPORT_TYPES.includes(report_type)) {
      return res.status(400).json({ error: `Invalid report_type. Valid: ${VALID_REPORT_TYPES.join(', ')}` });
    }
    if (!VALID_FREQUENCIES.includes(frequency)) {
      return res.status(400).json({ error: `Invalid frequency. Valid: ${VALID_FREQUENCIES.join(', ')}` });
    }
    if (!VALID_FORMATS.includes(format)) {
      return res.status(400).json({ error: `Invalid format. Valid: ${VALID_FORMATS.join(', ')}` });
    }
    if (frequency === 'WEEKLY' && (day_of_week == null || day_of_week < 0 || day_of_week > 6)) {
      return res.status(422).json({ error: 'day_of_week (0-6) is required for WEEKLY frequency' });
    }
    if (frequency === 'MONTHLY' && (day_of_month == null || day_of_month < 1 || day_of_month > 28)) {
      return res.status(422).json({ error: 'day_of_month (1-28) is required for MONTHLY frequency' });
    }

    const emails = Array.isArray(recipient_emails) ? recipient_emails : (recipient_emails || '').split(',').map((e) => e.trim()).filter(Boolean);
    for (const email of emails) {
      if (!EMAIL_REGEX.test(email)) {
        return res.status(422).json({ error: `Invalid email: ${email}` });
      }
    }

    const nextRunAt = computeNextRunAt(frequency, day_of_week, day_of_month);

    const schedule = await prisma.$transaction(async (tx) => {
      const s = await tx.reportSchedule.create({
        data: {
          report_type,
          frequency,
          day_of_week: frequency === 'WEEKLY' ? day_of_week : null,
          day_of_month: frequency === 'MONTHLY' ? day_of_month : null,
          recipient_emails: emails,
          format,
          parameters_json: parameters || {},
          next_run_at: nextRunAt,
        },
      });

      await writeAuditLog({
        userId: req.user.userId,
        action: 'CREATE',
        entityType: 'ReportSchedule',
        entityId: s.id,
        after: { report_type, frequency, format },
      }, tx);

      return s;
    });

    res.status(201).json({ data: schedule });
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const schedules = await prisma.reportSchedule.findMany({
      orderBy: { created_at: 'desc' },
    });
    res.json({ data: schedules });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const schedule = await prisma.reportSchedule.findUnique({ where: { id: req.params.id } });
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    res.json({ data: schedule });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { id } = req.params;
    const existing = await prisma.reportSchedule.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    const { report_type, frequency, day_of_week, day_of_month, recipient_emails, format, parameters } = req.body;

    const updateData = {};
    if (report_type && VALID_REPORT_TYPES.includes(report_type)) updateData.report_type = report_type;
    if (frequency && VALID_FREQUENCIES.includes(frequency)) updateData.frequency = frequency;
    if (format && VALID_FORMATS.includes(format)) updateData.format = format;
    if (parameters !== undefined) updateData.parameters_json = parameters;

    const finalFreq = updateData.frequency || existing.frequency;
    if (finalFreq === 'WEEKLY' && day_of_week != null) updateData.day_of_week = day_of_week;
    if (finalFreq === 'MONTHLY' && day_of_month != null) updateData.day_of_month = day_of_month;

    if (recipient_emails) {
      const emails = Array.isArray(recipient_emails) ? recipient_emails : recipient_emails.split(',').map((e) => e.trim()).filter(Boolean);
      for (const email of emails) {
        if (!EMAIL_REGEX.test(email)) {
          return res.status(422).json({ error: `Invalid email: ${email}` });
        }
      }
      updateData.recipient_emails = emails;
    }

    // Recompute next_run_at if frequency or day changed
    if (updateData.frequency || day_of_week != null || day_of_month != null) {
      updateData.next_run_at = computeNextRunAt(
        updateData.frequency || existing.frequency,
        updateData.day_of_week ?? existing.day_of_week,
        updateData.day_of_month ?? existing.day_of_month,
      );
    }

    const schedule = await prisma.$transaction(async (tx) => {
      const s = await tx.reportSchedule.update({ where: { id }, data: updateData });
      await writeAuditLog({
        userId: req.user.userId,
        action: 'UPDATE',
        entityType: 'ReportSchedule',
        entityId: id,
        before: existing,
        after: updateData,
      }, tx);
      return s;
    });

    res.json({ data: schedule });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const { id } = req.params;
    const existing = await prisma.reportSchedule.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.reportSchedule.update({ where: { id }, data: { is_active: false } });
      await writeAuditLog({
        userId: req.user.userId,
        action: 'DELETE',
        entityType: 'ReportSchedule',
        entityId: id,
        before: { is_active: true },
        after: { is_active: false },
      }, tx);
    });

    res.json({ message: 'Schedule deactivated' });
  } catch (err) {
    next(err);
  }
}

module.exports = { create, list, getById, update, remove, computeNextRunAt };
