const prisma = require('../utils/prismaClient');
const { writeAuditLog } = require('../utils/auditLog');
const asyncHandler = require('../middleware/asyncHandler');
const AppError = require('../middleware/AppError');

const get = asyncHandler(async (req, res) => {
  let settings = await prisma.systemSetting.findUnique({ where: { id: 'singleton' } });
  if (!settings) {
    settings = await prisma.systemSetting.create({ data: { id: 'singleton' } });
  }

  res.json({
    data: {
      ...settings,
      smtp_configured: !!(process.env.SMTP_HOST && process.env.SMTP_HOST.trim()),
      simulation_mode: true,
    },
  });
});

const update = asyncHandler(async (req, res) => {
  const {
    facility_name, facility_address, facility_permit_number, facility_kvk,
    report_footer_text, max_skips_per_event,
  } = req.body;

  const updateData = {};

  if (facility_name !== undefined) updateData.facility_name = facility_name;
  if (facility_address !== undefined) updateData.facility_address = facility_address;
  if (facility_permit_number !== undefined) updateData.facility_permit_number = facility_permit_number;

  if (facility_kvk !== undefined) {
    if (!/^\d{8}$/.test(facility_kvk)) {
      throw new AppError('KvK number must be exactly 8 digits', 422);
    }
    updateData.facility_kvk = facility_kvk;
  }

  if (report_footer_text !== undefined) updateData.report_footer_text = report_footer_text;

  if (max_skips_per_event !== undefined) {
    const val = parseInt(max_skips_per_event);
    if (isNaN(val) || val < 1 || val > 20) {
      throw new AppError('max_skips_per_event must be an integer between 1 and 20', 422);
    }
    updateData.max_skips_per_event = val;
  }

  if (Object.keys(updateData).length === 0) {
    throw new AppError('No valid fields to update', 422);
  }

  const before = await prisma.systemSetting.findUnique({ where: { id: 'singleton' } });

  const settings = await prisma.$transaction(async (tx) => {
    const s = await tx.systemSetting.update({ where: { id: 'singleton' }, data: updateData });

    await writeAuditLog({
      userId: req.user.userId,
      action: 'UPDATE',
      entityType: 'SystemSetting',
      entityId: 'singleton',
      before: before,
      after: updateData,
    }, tx);

    return s;
  });

  res.json({
    data: {
      ...settings,
      smtp_configured: !!(process.env.SMTP_HOST && process.env.SMTP_HOST.trim()),
      simulation_mode: true,
    },
  });
});

module.exports = { get, update };
