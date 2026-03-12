const cron = require('node-cron');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../utils/prismaClient');
const dataService = require('./reportDataService');
const pdfGen = require('./pdfReportGenerator');
const xlsxGen = require('./xlsxReportGenerator');
const { sendReportEmail } = require('./emailService');
const { computeNextRunAt } = require('../controllers/scheduleController');
const { REPORT_TYPES } = require('../controllers/reportsController');

const STORAGE_DIR = path.join(__dirname, '..', '..', 'storage', 'reports');

// System user email — must exist in the database (created by seed)
const SYSTEM_USER_EMAIL = 'system@statice.nl';

function timestamp() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`;
}

async function getSystemUserId() {
  const user = await prisma.user.findUnique({ where: { email: SYSTEM_USER_EMAIL }, select: { id: true } });
  return user?.id || null;
}

async function processSchedules() {
  const now = new Date();
  const dueSchedules = await prisma.reportSchedule.findMany({
    where: {
      is_active: true,
      next_run_at: { lte: now },
    },
  });

  if (dueSchedules.length === 0) return;

  const systemUserId = await getSystemUserId();
  console.log(`[ReportScheduler] Processing ${dueSchedules.length} due schedule(s)`);

  for (const schedule of dueSchedules) {
    try {
      const config = REPORT_TYPES[schedule.report_type];
      if (!config) {
        console.error(`[ReportScheduler] Unknown report type: ${schedule.report_type}`);
        continue;
      }

      // Compute date parameters for scheduled reports
      // Use "last period" logic based on frequency
      const params = { ...schedule.parameters_json };
      if (!params.dateFrom || !params.dateTo) {
        const periodDates = computeSchedulePeriod(schedule.frequency);
        params.dateFrom = params.dateFrom || periodDates.from;
        params.dateTo = params.dateTo || periodDates.to;
      }

      // Fetch data
      const data = await dataService[config.fetcher](params);

      const shortId = uuidv4().slice(0, 8);
      const ts = timestamp();
      let filePathPdf = null;
      let filePathXlsx = null;
      const fmt = schedule.format.toLowerCase();

      const user = systemUserId
        ? await prisma.user.findUnique({ where: { id: systemUserId }, select: { full_name: true } })
        : { full_name: 'System' };

      if (fmt === 'pdf' || fmt === 'both') {
        const filename = `${schedule.report_type}_${ts}_${shortId}.pdf`;
        filePathPdf = path.join(STORAGE_DIR, filename);
        await pdfGen[config.pdfGen](data, filePathPdf, user);
      }

      if (fmt === 'xlsx' || fmt === 'both') {
        const filename = `${schedule.report_type}_${ts}_${shortId}.xlsx`;
        filePathXlsx = path.join(STORAGE_DIR, filename);
        await xlsxGen[config.xlsxGen](data, filePathXlsx, user);
      }

      // Create report record
      if (systemUserId) {
        await prisma.report.create({
          data: {
            type: schedule.report_type,
            generated_by: systemUserId,
            parameters_json: params,
            file_path_pdf: filePathPdf,
            file_path_xlsx: filePathXlsx,
          },
        });
      }

      // Send email
      if (schedule.recipient_emails.length > 0) {
        const attachments = [];
        if (filePathPdf) attachments.push({ filename: `${config.name}.pdf`, path: filePathPdf });
        if (filePathXlsx) attachments.push({ filename: `${config.name}.xlsx`, path: filePathXlsx });

        const periodStr = params.dateFrom && params.dateTo
          ? `${params.dateFrom} to ${params.dateTo}`
          : new Date().toISOString().slice(0, 10);

        await sendReportEmail({
          to: schedule.recipient_emails,
          reportType: schedule.report_type,
          reportName: config.name,
          period: periodStr,
          attachments,
        });
      }

      // Update schedule
      const nextRun = computeNextRunAt(schedule.frequency, schedule.day_of_week, schedule.day_of_month, now);
      await prisma.reportSchedule.update({
        where: { id: schedule.id },
        data: { last_run_at: now, next_run_at: nextRun },
      });

      console.log(`[ReportScheduler] Schedule ${schedule.id} (${schedule.report_type}) completed. Next run: ${nextRun.toISOString()}`);
    } catch (err) {
      console.error(`[ReportScheduler] Schedule ${schedule.id} failed:`, err.message);
    }
  }
}

function computeSchedulePeriod(frequency) {
  const now = new Date();
  let from, to;

  switch (frequency) {
    case 'DAILY':
      from = new Date(now);
      from.setDate(from.getDate() - 1);
      from.setHours(0, 0, 0, 0);
      to = new Date(from);
      to.setHours(23, 59, 59, 999);
      break;

    case 'WEEKLY':
      to = new Date(now);
      to.setDate(to.getDate() - 1);
      to.setHours(23, 59, 59, 999);
      from = new Date(to);
      from.setDate(from.getDate() - 6);
      from.setHours(0, 0, 0, 0);
      break;

    case 'MONTHLY':
    default:
      to = new Date(now.getFullYear(), now.getMonth(), 0); // last day of previous month
      to.setHours(23, 59, 59, 999);
      from = new Date(to.getFullYear(), to.getMonth(), 1);
      from.setHours(0, 0, 0, 0);
      break;
  }

  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function initScheduler() {
  // Run every hour at minute 0
  cron.schedule('0 * * * *', async () => {
    try {
      await processSchedules();
    } catch (err) {
      console.error('[ReportScheduler] Unexpected error:', err.message);
    }
  });
  console.log('[ReportScheduler] Initialized — runs hourly at :00');
}

module.exports = { initScheduler, processSchedules };
