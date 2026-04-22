const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Resetting operational data...');

  // Outbound
  await prisma.outboundDocument.deleteMany();
  await prisma.outboundWeighingRecord.deleteMany();
  await prisma.outbound.deleteMany();
  await prisma.outboundOrderWasteStream.deleteMany();
  await prisma.outboundOrder.deleteMany();

  // Invoices
  await prisma.invoiceLine.deleteMany();
  await prisma.invoice.deleteMany();

  // Processing
  await prisma.contaminationIncident.deleteMany();
  await prisma.processingOutcomeLine.deleteMany();
  await prisma.processingRecord.deleteMany();
  await prisma.reusableItem.deleteMany();
  await prisma.assetCatalogueEntry.deleteMany();
  await prisma.sortingLine.deleteMany();
  await prisma.sortingSession.deleteMany();

  // Inbound
  await prisma.asset.deleteMany();
  await prisma.inboundWeighing.deleteMany();
  await prisma.inbound.updateMany({ data: { gross_ticket_id: null, tare_ticket_id: null } });
  await prisma.inbound.deleteMany();
  await prisma.weightAmendment.deleteMany();
  await prisma.pfisterTicket.deleteMany();
  await prisma.orderWasteStream.deleteMany();
  await prisma.inboundOrder.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.orderDocument.deleteMany();

  // Processors
  await prisma.processorCertificateMaterialScope.deleteMany();
  await prisma.processorCertificate.deleteMany();
  await prisma.processor.deleteMany();

  console.log('Operational data cleared.');

  // Contracts
  await prisma.contractContaminationPenalty.deleteMany();
  await prisma.contractRateLine.deleteMany();
  await prisma.contractWasteStream.deleteMany();
  await prisma.supplierContract.deleteMany();

  console.log('Contracts cleared.');
  console.log('Reset complete. Reference data (users, entities, materials, fees, settings) preserved.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
