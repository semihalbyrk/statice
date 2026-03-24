const prisma = require('../utils/prismaClient');
const { writeAuditLog } = require('../utils/auditLog');
const { generateInvoiceNumber } = require('../utils/invoiceNumber');
const { canTransition } = require('../utils/invoiceStateMachine');
const { matchContractForOrder } = require('./contractService');

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

const INVOICE_LINE_INCLUDE = {
  material: { select: { id: true, code: true, name: true } },
  order: { select: { id: true, order_number: true } },
  contamination_incident: true,
};

const INVOICE_INCLUDE = {
  supplier: {
    select: { id: true, name: true, kvk_number: true, btw_number: true, address: true },
  },
  contract: {
    select: {
      id: true,
      contract_number: true,
      payment_term_days: true,
      invoicing_frequency: true,
      currency: true,
    },
  },
  created_by_user: { select: { id: true, full_name: true } },
  lines: {
    include: INVOICE_LINE_INCLUDE,
    orderBy: { sort_order: 'asc' },
  },
};

// --- Helpers ---

function round2(value) {
  return Math.round(value * 100) / 100;
}

async function recalculateInvoiceTotals(invoiceId, tx) {
  const lines = await tx.invoiceLine.findMany({
    where: { invoice_id: invoiceId },
    select: { line_subtotal: true, btw_amount: true, line_total: true },
  });

  let subtotal = 0;
  let btw_total = 0;
  let total_amount = 0;

  for (const line of lines) {
    subtotal += Number(line.line_subtotal);
    btw_total += Number(line.btw_amount);
    total_amount += Number(line.line_total);
  }

  await tx.invoice.update({
    where: { id: invoiceId },
    data: {
      subtotal: round2(subtotal),
      btw_total: round2(btw_total),
      total_amount: round2(total_amount),
    },
  });
}

// --- Generate Invoice ---

async function generateSupplierInvoice(orderIds, userId) {
  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    throw createError('order_ids must be a non-empty array', 400);
  }

  return prisma.$transaction(async (tx) => {
    // 1. Fetch and validate orders
    const orders = await tx.inboundOrder.findMany({
      where: { id: { in: orderIds } },
    });

    if (orders.length !== orderIds.length) {
      const foundIds = new Set(orders.map((o) => o.id));
      const missing = orderIds.filter((id) => !foundIds.has(id));
      throw createError(`Orders not found: ${missing.join(', ')}`, 404);
    }

    const nonCompleted = orders.filter((o) => o.status !== 'COMPLETED');
    if (nonCompleted.length > 0) {
      const nums = nonCompleted.map((o) => o.order_number || o.id);
      throw createError(`Orders not in COMPLETED status: ${nums.join(', ')}`, 400);
    }

    const supplierIds = new Set(orders.map((o) => o.supplier_id));
    if (supplierIds.size > 1) {
      throw createError('All orders must belong to the same supplier', 400);
    }

    const supplierId = orders[0].supplier_id;

    // 2. Get supplier
    const supplier = await tx.supplier.findUnique({
      where: { id: supplierId },
      select: { id: true, name: true, address: true },
    });
    if (!supplier) throw createError('Supplier not found', 404);

    // 3. Find contract
    const referenceDate = orders[0].planned_date;
    const contract = await tx.supplierContract.findFirst({
      where: {
        supplier_id: supplierId,
        status: 'ACTIVE',
        is_active: true,
        effective_date: { lte: referenceDate },
        OR: [
          { expiry_date: { gte: referenceDate } },
          { expiry_date: null },
        ],
      },
      select: {
        id: true,
        contract_number: true,
        payment_term_days: true,
        currency: true,
      },
    });

    if (!contract) {
      throw createError('No active contract found for this supplier and date range', 404);
    }

    // 4. Calculate material lines
    const linesData = [];

    for (const order of orders) {
      const session = await tx.sortingSession.findFirst({
        where: { order_id: order.id },
      });

      if (!session) {
        throw createError(
          `Order ${order.order_number} has no sorting session — complete sorting before invoicing`,
          400
        );
      }

      const catalogueEntries = await tx.assetCatalogueEntry.findMany({
        where: { session_id: session.id },
        include: { material: true },
      });

      for (const entry of catalogueEntries) {
        const match = await matchContractForOrder(
          order.supplier_id,
          entry.material_id,
          order.planned_date,
          tx
        );

        if (match && match.rate_line) {
          const rateLine = match.rate_line;
          const pricingModel = rateLine.pricing_model;

          let quantity;
          let unit;
          if (pricingModel === 'WEIGHT') {
            quantity = Number(entry.weight_kg);
            unit = 'kg';
          } else {
            quantity = entry.reuse_eligible_quantity;
            unit = 'pcs';
          }

          const unitRate = Number(rateLine.unit_rate);
          const btwRate = Number(rateLine.btw_rate);
          const lineSubtotal = round2(quantity * unitRate);
          const btwAmount = round2(lineSubtotal * btwRate / 100);
          const lineTotal = round2(lineSubtotal + btwAmount);

          const description = `${entry.material.name} — ${entry.material.code}, ${quantity} ${unit}`;

          linesData.push({
            order_id: order.id,
            material_id: entry.material_id,
            description,
            line_type: 'material',
            quantity,
            unit,
            unit_rate: unitRate,
            btw_rate: btwRate,
            line_subtotal: lineSubtotal,
            btw_amount: btwAmount,
            line_total: lineTotal,
            rate_line_id: rateLine.id,
          });
        }
      }
    }

    // 5. Contamination fee lines
    const incidents = await tx.contaminationIncident.findMany({
      where: {
        order_id: { in: orderIds },
        is_invoiced: false,
        fee_amount: { not: null, gt: 0 },
      },
    });

    for (const incident of incidents) {
      const feeAmount = Number(incident.fee_amount);
      const description = `Contamination fee: ${incident.contamination_type.replace(/_/g, ' ').toLowerCase()}`;

      linesData.push({
        order_id: incident.order_id,
        description,
        line_type: 'contamination_fee',
        quantity: 1,
        unit: 'pcs',
        unit_rate: feeAmount,
        btw_rate: 0,
        line_subtotal: feeAmount,
        btw_amount: 0,
        line_total: feeAmount,
        contamination_incident_id: incident.id,
      });

      await tx.contaminationIncident.update({
        where: { id: incident.id },
        data: { is_invoiced: true },
      });
    }

    // 6. Generate invoice number
    const invoiceNumber = await generateInvoiceNumber(tx);

    // 7. Calculate totals
    let subtotal = 0;
    let btwTotal = 0;
    let totalAmount = 0;

    for (const line of linesData) {
      subtotal += line.line_subtotal;
      btwTotal += line.btw_amount;
      totalAmount += line.line_total;
    }

    subtotal = round2(subtotal);
    btwTotal = round2(btwTotal);
    totalAmount = round2(totalAmount);

    // 8. Due date
    const invoiceDate = new Date();
    const paymentTermDays = contract.payment_term_days || 30;
    const dueDate = new Date(invoiceDate.getTime() + paymentTermDays * 86400000);

    // 9. Create invoice
    const invoice = await tx.invoice.create({
      data: {
        invoice_number: invoiceNumber,
        status: 'DRAFT',
        supplier_id: supplierId,
        contract_id: contract.id,
        invoice_date: invoiceDate,
        due_date: dueDate,
        currency: contract.currency || 'EUR',
        subtotal,
        btw_total: btwTotal,
        total_amount: totalAmount,
        recipient_name: supplier.name,
        recipient_address: supplier.address,
        created_by: userId,
        lines: {
          create: linesData.map((l, i) => ({ ...l, sort_order: i })),
        },
      },
      include: INVOICE_INCLUDE,
    });

    // 10. Transition orders to INVOICED
    for (const order of orders) {
      await tx.inboundOrder.update({
        where: { id: order.id },
        data: { status: 'INVOICED' },
      });
    }

    // 11. Audit log
    await writeAuditLog({
      userId,
      action: 'CREATE',
      entityType: 'Invoice',
      entityId: invoice.id,
      after: {
        invoice_number: invoice.invoice_number,
        supplier_id: supplierId,
        contract_id: contract.id,
        order_ids: orderIds,
        total_amount: totalAmount,
        line_count: linesData.length,
      },
    }, tx);

    return invoice;
  });
}

// --- List Invoices ---

async function listInvoices({ status, supplier_id, search, date_from, date_to, page = 1, limit = 20 }) {
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const where = {};
  if (status) where.status = status;
  if (supplier_id) where.supplier_id = supplier_id;

  if (date_from || date_to) {
    where.invoice_date = {};
    if (date_from) where.invoice_date.gte = new Date(date_from);
    if (date_to) where.invoice_date.lte = new Date(date_to);
  }

  if (search) {
    where.OR = [
      { invoice_number: { contains: search, mode: 'insensitive' } },
      { supplier: { name: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      skip,
      take: limitNum,
      include: {
        supplier: { select: { id: true, name: true } },
        created_by_user: { select: { id: true, full_name: true } },
        _count: { select: { lines: true } },
      },
      orderBy: { invoice_date: 'desc' },
    }),
    prisma.invoice.count({ where }),
  ]);

  return {
    data: invoices,
    total,
    page: pageNum,
    limit: limitNum,
  };
}

// --- Get Invoice ---

async function getInvoice(id) {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: INVOICE_INCLUDE,
  });
  if (!invoice) throw createError('Invoice not found', 404);
  return invoice;
}

// --- Get Completed Orders for Invoicing ---

async function getCompletedOrdersForInvoicing(supplierId) {
  const orders = await prisma.inboundOrder.findMany({
    where: {
      supplier_id: supplierId,
      status: 'COMPLETED',
    },
    include: {
      inbounds: { select: { id: true, net_weight_kg: true, inbound_number: true } },
      waste_stream: { select: { id: true, name: true, code: true } },
    },
    orderBy: { planned_date: 'desc' },
  });
  return orders;
}

// --- Update Invoice Status ---

async function updateInvoiceStatus(id, newStatus, userId) {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({
      where: { id },
      select: { id: true, invoice_number: true, status: true },
    });

    if (!invoice) throw createError('Invoice not found', 404);

    if (!canTransition(invoice.status, newStatus)) {
      throw createError(
        `Cannot transition invoice from ${invoice.status} to ${newStatus}`,
        400
      );
    }

    const updated = await tx.invoice.update({
      where: { id },
      data: { status: newStatus },
      include: INVOICE_INCLUDE,
    });

    await writeAuditLog({
      userId,
      action: 'STATUS_CHANGE',
      entityType: 'Invoice',
      entityId: id,
      before: { status: invoice.status },
      after: { status: newStatus },
    }, tx);

    return updated;
  });
}

// --- Add Invoice Line ---

async function addInvoiceLine(invoiceId, data, userId) {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      select: { id: true, invoice_number: true, status: true },
    });

    if (!invoice) throw createError('Invoice not found', 404);
    if (invoice.status !== 'DRAFT') {
      throw createError('Can only add lines to DRAFT invoices', 400);
    }

    const quantity = Number(data.quantity);
    const unitRate = Number(data.unit_rate);
    const btwRate = Number(data.btw_rate || 0);
    const lineSubtotal = round2(quantity * unitRate);
    const btwAmount = round2(lineSubtotal * btwRate / 100);
    const lineTotal = round2(lineSubtotal + btwAmount);

    // Determine sort_order for new line
    const lastLine = await tx.invoiceLine.findFirst({
      where: { invoice_id: invoiceId },
      orderBy: { sort_order: 'desc' },
      select: { sort_order: true },
    });
    const sortOrder = lastLine ? lastLine.sort_order + 1 : 0;

    await tx.invoiceLine.create({
      data: {
        invoice_id: invoiceId,
        order_id: data.order_id || null,
        material_id: data.material_id || null,
        description: data.description,
        line_type: data.line_type || 'material',
        quantity,
        unit: data.unit || 'kg',
        unit_rate: unitRate,
        btw_rate: btwRate,
        line_subtotal: lineSubtotal,
        btw_amount: btwAmount,
        line_total: lineTotal,
        contamination_incident_id: data.contamination_incident_id || null,
        rate_line_id: data.rate_line_id || null,
        sort_order: sortOrder,
      },
    });

    await recalculateInvoiceTotals(invoiceId, tx);

    await writeAuditLog({
      userId,
      action: 'ADD_LINE',
      entityType: 'Invoice',
      entityId: invoiceId,
      after: { description: data.description, quantity, unit_rate: unitRate, line_total: lineTotal },
    }, tx);

    return tx.invoice.findUnique({
      where: { id: invoiceId },
      include: INVOICE_INCLUDE,
    });
  });
}

// --- Update Invoice Line ---

async function updateInvoiceLine(lineId, data, userId) {
  return prisma.$transaction(async (tx) => {
    const line = await tx.invoiceLine.findUnique({
      where: { id: lineId },
      include: { invoice: { select: { id: true, invoice_number: true, status: true } } },
    });

    if (!line) throw createError('Invoice line not found', 404);
    if (line.invoice.status !== 'DRAFT') {
      throw createError('Can only edit lines on DRAFT invoices', 400);
    }

    const quantity = Number(data.quantity ?? line.quantity);
    const unitRate = Number(data.unit_rate ?? line.unit_rate);
    const btwRate = Number(data.btw_rate ?? line.btw_rate);
    const lineSubtotal = round2(quantity * unitRate);
    const btwAmount = round2(lineSubtotal * btwRate / 100);
    const lineTotal = round2(lineSubtotal + btwAmount);

    const before = {
      description: line.description,
      quantity: Number(line.quantity),
      unit_rate: Number(line.unit_rate),
      line_total: Number(line.line_total),
    };

    await tx.invoiceLine.update({
      where: { id: lineId },
      data: {
        description: data.description ?? line.description,
        line_type: data.line_type ?? line.line_type,
        quantity,
        unit: data.unit ?? line.unit,
        unit_rate: unitRate,
        btw_rate: btwRate,
        line_subtotal: lineSubtotal,
        btw_amount: btwAmount,
        line_total: lineTotal,
      },
    });

    await recalculateInvoiceTotals(line.invoice.id, tx);

    await writeAuditLog({
      userId,
      action: 'UPDATE_LINE',
      entityType: 'Invoice',
      entityId: line.invoice.id,
      before,
      after: {
        description: data.description ?? line.description,
        quantity,
        unit_rate: unitRate,
        line_total: lineTotal,
      },
    }, tx);

    return tx.invoice.findUnique({
      where: { id: line.invoice.id },
      include: INVOICE_INCLUDE,
    });
  });
}

// --- Delete Invoice Line ---

async function deleteInvoiceLine(lineId, userId) {
  return prisma.$transaction(async (tx) => {
    const line = await tx.invoiceLine.findUnique({
      where: { id: lineId },
      include: { invoice: { select: { id: true, invoice_number: true, status: true } } },
    });

    if (!line) throw createError('Invoice line not found', 404);
    if (line.invoice.status !== 'DRAFT') {
      throw createError('Can only delete lines from DRAFT invoices', 400);
    }

    // If linked to a contamination incident, reset is_invoiced
    if (line.contamination_incident_id) {
      await tx.contaminationIncident.update({
        where: { id: line.contamination_incident_id },
        data: { is_invoiced: false },
      });
    }

    const before = {
      description: line.description,
      quantity: Number(line.quantity),
      unit_rate: Number(line.unit_rate),
      line_total: Number(line.line_total),
    };

    await tx.invoiceLine.delete({ where: { id: lineId } });

    await recalculateInvoiceTotals(line.invoice.id, tx);

    await writeAuditLog({
      userId,
      action: 'DELETE_LINE',
      entityType: 'Invoice',
      entityId: line.invoice.id,
      before,
    }, tx);

    return tx.invoice.findUnique({
      where: { id: line.invoice.id },
      include: INVOICE_INCLUDE,
    });
  });
}

module.exports = {
  generateSupplierInvoice,
  listInvoices,
  getInvoice,
  getCompletedOrdersForInvoicing,
  updateInvoiceStatus,
  addInvoiceLine,
  updateInvoiceLine,
  deleteInvoiceLine,
};
