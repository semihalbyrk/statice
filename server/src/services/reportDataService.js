const prisma = require('../utils/prismaClient');

/**
 * Convert Prisma Decimal fields to plain Numbers on an object.
 */
function decimalToNumber(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(decimalToNumber);
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === 'object' && typeof value.toNumber === 'function') {
      result[key] = value.toNumber();
    } else if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      result[key] = decimalToNumber(value);
    } else if (Array.isArray(value)) {
      result[key] = value.map(decimalToNumber);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Compute weighted average: sum(value_i * weight_i) / sum(weight_i)
 */
function weightedAvg(items, pctField, weightField) {
  let sumProduct = 0;
  let sumWeight = 0;
  for (const item of items) {
    const w = Number(item[weightField]) || 0;
    const p = Number(item[pctField]) || 0;
    sumProduct += p * w;
    sumWeight += w;
  }
  return sumWeight > 0 ? Math.round((sumProduct / sumWeight) * 100) / 100 : 0;
}

/* ───── RPT-01: Supplier / Client Circularity Statement ───── */

async function fetchSupplierStatementData({ supplierId, dateFrom, dateTo, categoryIds }) {
  const supplier = await prisma.supplier.findUniqueOrThrow({ where: { id: supplierId } });

  const orders = await prisma.inboundOrder.findMany({
    where: {
      supplier_id: supplierId,
      status: { in: ['IN_PROGRESS', 'COMPLETED'] },
      planned_date: { gte: new Date(dateFrom), lte: new Date(dateTo) },
    },
    include: {
      carrier: { select: { id: true, name: true } },
      waste_stream: { select: { id: true, name_en: true, code: true } },
      inbounds: {
        where: { status: 'COMPLETED' },
        include: {
          vehicle: { select: { registration_plate: true } },
          gross_ticket: { select: { ticket_number: true } },
          tare_ticket: { select: { ticket_number: true } },
          assets: {
            include: {
              material_category: true,
              sorting_lines: {
                include: {
                  category: { include: { waste_stream: { select: { name_en: true, code: true } } } },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { planned_date: 'asc' },
  });

  // Flatten all sorting lines across orders
  const allLines = [];
  for (const order of orders) {
    for (const event of order.inbounds) {
      for (const asset of event.assets) {
        for (const line of asset.sorting_lines) {
          allLines.push({
            ...line,
            orderId: order.id,
            orderNumber: order.order_number,
            vehiclePlate: event.vehicle?.registration_plate,
          });
        }
      }
    }
  }

  // Filter by category if specified
  const filteredLines = categoryIds && categoryIds.length > 0
    ? allLines.filter((l) => categoryIds.includes(l.category_id))
    : allLines;

  // Aggregate per product category
  const categoryMap = {};
  for (const line of filteredLines) {
    const catId = line.category_id;
    if (!categoryMap[catId]) {
      categoryMap[catId] = {
        categoryId: catId,
        codeCbs: line.category.code_cbs,
        descriptionEn: line.category.description_en,
        wasteStream: line.category.waste_stream?.name_en,
        lines: [],
        downstreamProcessors: new Set(),
      };
    }
    categoryMap[catId].lines.push(line);
    if (line.downstream_processor) {
      categoryMap[catId].downstreamProcessors.add(line.downstream_processor);
    }
  }

  const categories = Object.values(categoryMap).map((cat) => {
    const totalWeight = cat.lines.reduce((s, l) => s + Number(l.net_weight_kg), 0);
    return {
      categoryId: cat.categoryId,
      codeCbs: cat.codeCbs,
      descriptionEn: cat.descriptionEn,
      wasteStream: cat.wasteStream,
      totalNetWeightKg: Math.round(totalWeight * 100) / 100,
      recycledKg: Math.round(cat.lines.reduce((s, l) => s + Number(l.net_weight_kg) * Number(l.recycled_pct) / 100, 0) * 100) / 100,
      reusedKg: Math.round(cat.lines.reduce((s, l) => s + Number(l.net_weight_kg) * Number(l.reused_pct) / 100, 0) * 100) / 100,
      disposedKg: Math.round(cat.lines.reduce((s, l) => s + Number(l.net_weight_kg) * Number(l.disposed_pct) / 100, 0) * 100) / 100,
      landfillKg: Math.round(cat.lines.reduce((s, l) => s + Number(l.net_weight_kg) * Number(l.landfill_pct) / 100, 0) * 100) / 100,
      weightedAvgRecycledPct: weightedAvg(cat.lines, 'recycled_pct', 'net_weight_kg'),
      weightedAvgReusedPct: weightedAvg(cat.lines, 'reused_pct', 'net_weight_kg'),
      weightedAvgDisposedPct: weightedAvg(cat.lines, 'disposed_pct', 'net_weight_kg'),
      weightedAvgLandfillPct: weightedAvg(cat.lines, 'landfill_pct', 'net_weight_kg'),
      downstreamProcessors: [...cat.downstreamProcessors],
    };
  });

  const totalWeight = categories.reduce((s, c) => s + c.totalNetWeightKg, 0);

  // Simplify orders for output
  const orderSummaries = orders.map((o) => ({
    id: o.id,
    orderNumber: o.order_number,
    plannedDate: o.planned_date,
    carrierName: o.carrier.name,
    vehiclePlates: o.inbounds.map((e) => e.vehicle?.registration_plate).filter(Boolean),
    netWeightKg: o.inbounds.reduce((s, e) => s + (Number(e.net_weight_kg) || 0), 0),
  }));

  return {
    supplier: decimalToNumber(supplier),
    orders: orderSummaries,
    categories,
    totals: {
      totalNetWeightKg: Math.round(totalWeight * 100) / 100,
      weightedAvgRecycledPct: weightedAvg(filteredLines, 'recycled_pct', 'net_weight_kg'),
      weightedAvgReusedPct: weightedAvg(filteredLines, 'reused_pct', 'net_weight_kg'),
      weightedAvgDisposedPct: weightedAvg(filteredLines, 'disposed_pct', 'net_weight_kg'),
      weightedAvgLandfillPct: weightedAvg(filteredLines, 'landfill_pct', 'net_weight_kg'),
    },
    period: { from: dateFrom, to: dateTo },
  };
}

/* ───── RPT-02: Material Recovery Summary ───── */

async function fetchMaterialRecoveryData({ dateFrom, dateTo, wasteStreamIds }) {
  const from = new Date(dateFrom);
  const to = new Date(dateTo);

  const whereClause = {
    session: {
      status: 'SUBMITTED',
      inbound: {
        status: 'COMPLETED',
        order: {
          planned_date: { gte: from, lte: to },
        },
      },
    },
  };

  if (wasteStreamIds && wasteStreamIds.length > 0) {
    whereClause.category = { waste_stream_id: { in: wasteStreamIds } };
  }

  const lines = await prisma.sortingLine.findMany({
    where: whereClause,
    include: {
      category: { include: { waste_stream: { select: { name_en: true, code: true } } } },
    },
  });

  const categories = aggregateByCategory(lines);

  // Prior period (same duration)
  const durationMs = to.getTime() - from.getTime();
  const priorFrom = new Date(from.getTime() - durationMs);
  const priorTo = new Date(from.getTime() - 1);

  const priorWhereClause = {
    session: {
      status: 'SUBMITTED',
      inbound: {
        status: 'COMPLETED',
        order: {
          planned_date: { gte: priorFrom, lte: priorTo },
        },
      },
    },
  };
  if (wasteStreamIds && wasteStreamIds.length > 0) {
    priorWhereClause.category = { waste_stream_id: { in: wasteStreamIds } };
  }

  const priorLines = await prisma.sortingLine.findMany({
    where: priorWhereClause,
    include: {
      category: { include: { waste_stream: { select: { name_en: true, code: true } } } },
    },
  });

  const priorCategories = aggregateByCategory(priorLines);

  return {
    categories,
    totals: computeTotals(categories),
    priorCategories: priorCategories.length > 0 ? priorCategories : null,
    priorTotals: priorCategories.length > 0 ? computeTotals(priorCategories) : null,
    period: { from: dateFrom, to: dateTo },
    priorPeriod: priorCategories.length > 0 ? { from: priorFrom.toISOString(), to: priorTo.toISOString() } : null,
  };
}

function aggregateByCategory(lines) {
  const map = {};
  for (const line of lines) {
    const catId = line.category_id;
    if (!map[catId]) {
      map[catId] = {
        categoryId: catId,
        codeCbs: line.category.code_cbs,
        descriptionEn: line.category.description_en,
        wasteStream: line.category.waste_stream?.name_en,
        lines: [],
      };
    }
    map[catId].lines.push(line);
  }

  return Object.values(map).map((cat) => {
    const totalWeight = cat.lines.reduce((s, l) => s + Number(l.net_weight_kg), 0);
    return {
      categoryId: cat.categoryId,
      codeCbs: cat.codeCbs,
      descriptionEn: cat.descriptionEn,
      wasteStream: cat.wasteStream,
      totalInboundKg: Math.round(totalWeight * 100) / 100,
      recycledKg: Math.round(cat.lines.reduce((s, l) => s + Number(l.net_weight_kg) * Number(l.recycled_pct) / 100, 0) * 100) / 100,
      reusedKg: Math.round(cat.lines.reduce((s, l) => s + Number(l.net_weight_kg) * Number(l.reused_pct) / 100, 0) * 100) / 100,
      disposedKg: Math.round(cat.lines.reduce((s, l) => s + Number(l.net_weight_kg) * Number(l.disposed_pct) / 100, 0) * 100) / 100,
      landfillKg: Math.round(cat.lines.reduce((s, l) => s + Number(l.net_weight_kg) * Number(l.landfill_pct) / 100, 0) * 100) / 100,
      recycledPct: weightedAvg(cat.lines, 'recycled_pct', 'net_weight_kg'),
      reusedPct: weightedAvg(cat.lines, 'reused_pct', 'net_weight_kg'),
      disposedPct: weightedAvg(cat.lines, 'disposed_pct', 'net_weight_kg'),
      landfillPct: weightedAvg(cat.lines, 'landfill_pct', 'net_weight_kg'),
    };
  });
}

function computeTotals(categories) {
  const totalKg = categories.reduce((s, c) => s + c.totalInboundKg, 0);
  return {
    totalInboundKg: Math.round(totalKg * 100) / 100,
    recycledKg: Math.round(categories.reduce((s, c) => s + c.recycledKg, 0) * 100) / 100,
    reusedKg: Math.round(categories.reduce((s, c) => s + c.reusedKg, 0) * 100) / 100,
    disposedKg: Math.round(categories.reduce((s, c) => s + c.disposedKg, 0) * 100) / 100,
    landfillKg: Math.round(categories.reduce((s, c) => s + c.landfillKg, 0) * 100) / 100,
    recycledPct: totalKg > 0 ? Math.round(categories.reduce((s, c) => s + c.recycledKg, 0) / totalKg * 10000) / 100 : 0,
    reusedPct: totalKg > 0 ? Math.round(categories.reduce((s, c) => s + c.reusedKg, 0) / totalKg * 10000) / 100 : 0,
    disposedPct: totalKg > 0 ? Math.round(categories.reduce((s, c) => s + c.disposedKg, 0) / totalKg * 10000) / 100 : 0,
    landfillPct: totalKg > 0 ? Math.round(categories.reduce((s, c) => s + c.landfillKg, 0) / totalKg * 10000) / 100 : 0,
  };
}

/* ───── RPT-03: Chain of Custody ───── */

async function fetchChainOfCustodyData({ orderId, dateFrom, dateTo }) {
  const where = {};
  if (orderId) {
    where.id = orderId;
  } else {
    where.planned_date = { gte: new Date(dateFrom), lte: new Date(dateTo) };
  }
  where.status = { in: ['IN_PROGRESS', 'COMPLETED'] };

  const orders = await prisma.inboundOrder.findMany({
    where,
    include: {
      carrier: true,
      supplier: true,
      waste_stream: { select: { name_en: true, code: true } },
      inbounds: {
        where: { status: 'COMPLETED' },
        include: {
          vehicle: { select: { registration_plate: true } },
          gross_ticket: { select: { ticket_number: true, timestamp: true } },
          tare_ticket: { select: { ticket_number: true, timestamp: true } },
          assets: {
            include: {
              material_category: { select: { code_cbs: true, description_en: true } },
              sorting_lines: {
                include: {
                  category: { select: { code_cbs: true, description_en: true } },
                },
              },
            },
            orderBy: { created_at: 'asc' },
          },
        },
      },
    },
    orderBy: { planned_date: 'asc' },
  });

  const consignments = orders.map((order) => ({
    orderId: order.id,
    orderNumber: order.order_number,
    plannedDate: order.planned_date,
    carrier: { name: order.carrier.name, kvkNumber: order.carrier.kvk_number },
    supplier: { name: order.supplier.name, kvkNumber: order.supplier.kvk_number },
    wasteStream: order.waste_stream,
    afvalstroomnummer: order.afvalstroomnummer,
    inboundsData: order.inbounds.map((event) => ({
      id: event.id,
      arrivedAt: event.arrived_at,
      vehiclePlate: event.vehicle?.registration_plate,
      grossWeightKg: Number(event.gross_weight_kg) || 0,
      tareWeightKg: Number(event.tare_weight_kg) || 0,
      netWeightKg: Number(event.net_weight_kg) || 0,
      grossTicket: event.gross_ticket?.ticket_number,
      tareTicket: event.tare_ticket?.ticket_number,
      assets: event.assets.map((asset) => ({
        assetLabel: asset.asset_label,
        skipType: asset.skip_type,
        category: asset.material_category?.code_cbs,
        categoryDescription: asset.material_category?.description_en,
        grossWeightKg: Number(asset.gross_weight_kg) || 0,
        tareWeightKg: Number(asset.tare_weight_kg) || 0,
        netWeightKg: Number(asset.net_weight_kg) || 0,
        sortingLines: asset.sorting_lines.map((line) => ({
          codeCbs: line.category.code_cbs,
          descriptionEn: line.category.description_en,
          netWeightKg: Number(line.net_weight_kg),
          recycledPct: Number(line.recycled_pct),
          reusedPct: Number(line.reused_pct),
          disposedPct: Number(line.disposed_pct),
          landfillPct: Number(line.landfill_pct),
          downstreamProcessor: line.downstream_processor,
        })),
      })),
    })),
  }));

  return { consignments };
}

/* ───── RPT-04: Inbound Weight Register ───── */

async function fetchInboundWeightRegisterData({ dateFrom, dateTo, carrierId, wasteStreamId }) {
  const orderWhere = {
    planned_date: { gte: new Date(dateFrom), lte: new Date(dateTo) },
  };
  if (carrierId) orderWhere.carrier_id = carrierId;
  if (wasteStreamId) orderWhere.waste_stream_id = wasteStreamId;

  const events = await prisma.inbound.findMany({
    where: {
      status: 'COMPLETED',
      order: orderWhere,
    },
    include: {
      order: {
        include: {
          carrier: { select: { id: true, name: true } },
          supplier: { select: { id: true, name: true } },
          waste_stream: { select: { id: true, name_en: true, code: true } },
        },
      },
      vehicle: { select: { registration_plate: true } },
      gross_ticket: { select: { ticket_number: true } },
      tare_ticket: { select: { ticket_number: true } },
      assets: { select: { id: true } },
    },
    orderBy: { arrived_at: 'asc' },
  });

  const eventRows = events.map((e) => ({
    id: e.id,
    arrivedAt: e.arrived_at,
    orderNumber: e.order.order_number,
    supplierName: e.order.supplier.name,
    carrierName: e.order.carrier.name,
    carrierId: e.order.carrier.id,
    vehiclePlate: e.vehicle?.registration_plate,
    skipCount: e.assets.length,
    grossWeightKg: Number(e.gross_weight_kg) || 0,
    tareWeightKg: Number(e.tare_weight_kg) || 0,
    netWeightKg: Number(e.net_weight_kg) || 0,
    grossTicketNumber: e.gross_ticket?.ticket_number,
    tareTicketNumber: e.tare_ticket?.ticket_number,
    afvalstroomnummer: e.order.afvalstroomnummer,
    wasteStreamId: e.order.waste_stream.id,
    wasteStreamName: e.order.waste_stream.name_en,
    wasteStreamCode: e.order.waste_stream.code,
  }));

  // Subtotals by carrier
  const carrierMap = {};
  for (const row of eventRows) {
    if (!carrierMap[row.carrierId]) {
      carrierMap[row.carrierId] = { name: row.carrierName, eventCount: 0, grossKg: 0, tareKg: 0, netKg: 0, skipCount: 0 };
    }
    carrierMap[row.carrierId].eventCount++;
    carrierMap[row.carrierId].grossKg += row.grossWeightKg;
    carrierMap[row.carrierId].tareKg += row.tareWeightKg;
    carrierMap[row.carrierId].netKg += row.netWeightKg;
    carrierMap[row.carrierId].skipCount += row.skipCount;
  }

  // Subtotals by waste stream
  const wsMap = {};
  for (const row of eventRows) {
    if (!wsMap[row.wasteStreamId]) {
      wsMap[row.wasteStreamId] = { name: row.wasteStreamName, code: row.wasteStreamCode, eventCount: 0, grossKg: 0, tareKg: 0, netKg: 0, skipCount: 0 };
    }
    wsMap[row.wasteStreamId].eventCount++;
    wsMap[row.wasteStreamId].grossKg += row.grossWeightKg;
    wsMap[row.wasteStreamId].tareKg += row.tareWeightKg;
    wsMap[row.wasteStreamId].netKg += row.netWeightKg;
    wsMap[row.wasteStreamId].skipCount += row.skipCount;
  }

  const grandTotals = {
    eventCount: eventRows.length,
    grossKg: eventRows.reduce((s, r) => s + r.grossWeightKg, 0),
    tareKg: eventRows.reduce((s, r) => s + r.tareWeightKg, 0),
    netKg: eventRows.reduce((s, r) => s + r.netWeightKg, 0),
    skipCount: eventRows.reduce((s, r) => s + r.skipCount, 0),
  };

  return {
    events: eventRows,
    subtotalsByCarrier: Object.values(carrierMap),
    subtotalsByWasteStream: Object.values(wsMap),
    grandTotals,
    period: { from: dateFrom, to: dateTo },
  };
}

/* ───── RPT-05: Waste Stream Analysis ───── */

async function fetchWasteStreamAnalysisData({ dateFrom, dateTo, wasteStreamIds }) {
  const whereClause = {
    session: {
      status: 'SUBMITTED',
      inbound: {
        status: 'COMPLETED',
        order: { planned_date: { gte: new Date(dateFrom), lte: new Date(dateTo) } },
      },
    },
  };

  if (wasteStreamIds && wasteStreamIds.length > 0) {
    whereClause.category = { waste_stream_id: { in: wasteStreamIds } };
  }

  const lines = await prisma.sortingLine.findMany({
    where: whereClause,
    include: {
      category: { include: { waste_stream: true } },
    },
  });

  // Group by waste stream, then by category
  const streamMap = {};
  for (const line of lines) {
    const ws = line.category.waste_stream;
    const wsId = ws.id;
    if (!streamMap[wsId]) {
      streamMap[wsId] = {
        streamId: wsId,
        streamName: ws.name_en,
        streamCode: ws.code,
        categoryMap: {},
      };
    }
    const catId = line.category_id;
    if (!streamMap[wsId].categoryMap[catId]) {
      streamMap[wsId].categoryMap[catId] = {
        categoryId: catId,
        codeCbs: line.category.code_cbs,
        descriptionEn: line.category.description_en,
        lines: [],
      };
    }
    streamMap[wsId].categoryMap[catId].lines.push(line);
  }

  const wasteStreams = Object.values(streamMap).map((stream) => {
    const categories = Object.values(stream.categoryMap).map((cat) => {
      const totalWeight = cat.lines.reduce((s, l) => s + Number(l.net_weight_kg), 0);
      return {
        categoryId: cat.categoryId,
        codeCbs: cat.codeCbs,
        descriptionEn: cat.descriptionEn,
        totalInboundKg: Math.round(totalWeight * 100) / 100,
        recycledPct: weightedAvg(cat.lines, 'recycled_pct', 'net_weight_kg'),
        reusedPct: weightedAvg(cat.lines, 'reused_pct', 'net_weight_kg'),
        disposedPct: weightedAvg(cat.lines, 'disposed_pct', 'net_weight_kg'),
        landfillPct: weightedAvg(cat.lines, 'landfill_pct', 'net_weight_kg'),
      };
    });

    const streamTotal = categories.reduce((s, c) => s + c.totalInboundKg, 0);
    return {
      streamId: stream.streamId,
      streamName: stream.streamName,
      streamCode: stream.streamCode,
      categories,
      totals: {
        totalInboundKg: Math.round(streamTotal * 100) / 100,
        recycledPct: weightedAvg(
          Object.values(stream.categoryMap).flatMap((c) => c.lines),
          'recycled_pct', 'net_weight_kg'
        ),
        reusedPct: weightedAvg(
          Object.values(stream.categoryMap).flatMap((c) => c.lines),
          'reused_pct', 'net_weight_kg'
        ),
        disposedPct: weightedAvg(
          Object.values(stream.categoryMap).flatMap((c) => c.lines),
          'disposed_pct', 'net_weight_kg'
        ),
        landfillPct: weightedAvg(
          Object.values(stream.categoryMap).flatMap((c) => c.lines),
          'landfill_pct', 'net_weight_kg'
        ),
      },
    };
  });

  return {
    wasteStreams,
    period: { from: dateFrom, to: dateTo },
  };
}

/* ───── RPT-06: Skip Asset Utilisation ───── */

async function fetchAssetUtilisationData({ dateFrom, dateTo, skipType }) {
  const where = {
    inbound: {
      status: 'COMPLETED',
      order: { planned_date: { gte: new Date(dateFrom), lte: new Date(dateTo) } },
    },
  };
  if (skipType) where.skip_type = skipType;

  const assets = await prisma.asset.findMany({
    where,
    select: {
      id: true,
      asset_label: true,
      skip_type: true,
      inbound_id: true,
    },
  });

  // Count by skip type
  const typeMap = {};
  for (const a of assets) {
    typeMap[a.skip_type] = (typeMap[a.skip_type] || 0) + 1;
  }
  const byType = Object.entries(typeMap).map(([type, count]) => ({ type, count }));

  // Average per event
  const eventIds = new Set(assets.map((a) => a.inbound_id));
  const avgPerEvent = eventIds.size > 0 ? Math.round(assets.length / eventIds.size * 100) / 100 : 0;

  // Top 20 most-used labels
  const labelCount = {};
  for (const a of assets) {
    labelCount[a.asset_label] = (labelCount[a.asset_label] || 0) + 1;
  }
  const topAssets = Object.entries(labelCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([label, count]) => ({ label, count }));

  return {
    totalSkips: assets.length,
    avgPerEvent,
    byType,
    topAssets,
    period: { from: dateFrom, to: dateTo },
  };
}

module.exports = {
  fetchSupplierStatementData,
  fetchMaterialRecoveryData,
  fetchChainOfCustodyData,
  fetchInboundWeightRegisterData,
  fetchWasteStreamAnalysisData,
  fetchAssetUtilisationData,
};
