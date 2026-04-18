const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

const TEMPLATE_PATH = path.join(__dirname, '../assets/begeleidingsbrief-template.pdf');
const OUTPUT_DIR = path.join(__dirname, '../../uploads/outbounds');

// ── field helpers ────────────────────────────────────────────────────

function setText(form, fieldName, value) {
  try {
    form.getTextField(fieldName).setText(value || '');
  } catch (_) {
    // Unknown field names are silently skipped
  }
}

function setCheckbox(form, fieldName, checked) {
  try {
    const cb = form.getCheckBox(fieldName);
    if (checked) {
      cb.check();
    } else {
      cb.uncheck();
    }
  } catch (_) {
    // Unknown field names are silently skipped
  }
}

// ── main generator ───────────────────────────────────────────────────

/**
 * Fills the official Begeleidingsbrief AcroForm PDF with mappedData
 * produced by begeleidingsbriefService.mapBegeleidingsbrief().
 *
 * @param {object} mappedData - Output of mapBegeleidingsbrief()
 * @returns {{ fileName: string, filePath: string, fileSize: number }}
 */
async function generateBegeleidingsbriefPDF(mappedData) {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const templateBytes = fs.readFileSync(TEMPLATE_PATH);
  const pdfDoc = await PDFDocument.load(templateBytes);
  const form = pdfDoc.getForm();

  // ── Section 1: Afzender (Sender) ────────────────────────────────
  setCheckbox(form, 'role_selection-waste_producer', mappedData.sender.isDisposer);
  setCheckbox(form, 'role_selection-receiver', mappedData.sender.isReceiver);
  setCheckbox(form, 'role_selection-trader', false);
  setCheckbox(form, 'role_selection-intermediary', false);
  setText(form, 'sender_name', mappedData.sender.name);
  setText(form, 'sender_address', mappedData.sender.address);
  setText(form, 'sender_postal_city', mappedData.sender.postalCity);
  setText(form, 'sender_vihb', mappedData.sender.vihb);

  // ── Section 2: Factuuradres (Invoice address) ────────────────────
  if (mappedData.invoiceEntity) {
    setText(form, 'invoice_address', mappedData.invoiceEntity.name);
    setText(form, 'invoice_pobox_street', mappedData.invoiceEntity.street);
    setText(form, 'invoice_postal_city', mappedData.invoiceEntity.postalCity);
  }

  // ── Section 3A: Ontdoener (Disposer) ────────────────────────────
  setText(form, 'waste_producer', mappedData.disposer.name);
  setText(form, 'waste_producer_address', mappedData.disposer.address);
  setText(form, 'waste_producer_postal_city', mappedData.disposer.postalCity);

  // ── Section 3B: Locatie van herkomst (Origin site) ──────────────
  setText(form, 'waste_origin_location', mappedData.originSite.name);
  setText(form, 'waste_origin_address', mappedData.originSite.address);
  setText(form, 'waste_origin_postal_city', mappedData.originSite.postalCity);
  setText(form, 'transport_start_date', mappedData.transportStartDate);

  // ── Section 4A: Uitbesteed vervoerder (conditional) ─────────────
  if (mappedData.outsourcedTransporter) {
    setText(form, 'contracted_transporter', mappedData.outsourcedTransporter.name);
    setText(form, 'contracted_transporter_address', mappedData.outsourcedTransporter.address);
    setText(form, 'contracted_transporter_postal_city', mappedData.outsourcedTransporter.postalCity);
    setText(form, 'contracted_transporter_vihb', mappedData.outsourcedTransporter.vihb);
  }

  // ── Section 4B: Locatie van bestemming (Destination) ────────────
  setText(form, 'destination_location', mappedData.destination.name);
  setText(form, 'destination_address', mappedData.destination.address);
  setText(form, 'destination_postal_city', mappedData.destination.postalCity);

  // ── Section 5: Vervoerder (Transporter) ─────────────────────────
  setCheckbox(form, 'transported_by-sender', false);
  setCheckbox(form, 'transported_by-waste_producer', false);
  setCheckbox(form, 'transported_by-receiver', false);
  setCheckbox(form, 'transported_by-collector', false);
  setCheckbox(form, 'transported_by-transporter', !mappedData.hasOutsourcedTransporter);
  setCheckbox(form, 'transported_by-contracted_transporter', mappedData.hasOutsourcedTransporter);

  setText(form, 'receiver_details', mappedData.transporter.name);
  setText(form, 'receiver_address', mappedData.transporter.address);
  setText(form, 'receiver_postal_city', mappedData.transporter.postalCity);
  setText(form, 'receiver_vihb', mappedData.transporter.vihb);
  setText(form, 'license_plate', mappedData.vehiclePlate);

  // Hardcoded NEE per spec
  setCheckbox(form, 'route_collection-yes', false);
  setCheckbox(form, 'route_collection-no', true);
  setCheckbox(form, 'collector_regulation-yes', false);
  setCheckbox(form, 'collector_regulation-no', true);
  setCheckbox(form, 'repetitive_shipments-yes', false);
  setCheckbox(form, 'repetitive_shipments-no', true);

  // ── Section 6: Waste lines (1 row per waste stream, max 11) ─────
  mappedData.wasteLines.forEach((line, idx) => {
    const i = idx + 1; // form fields are 1-indexed
    setText(form, `waste_stream_number-${i}`, line.asn);
    setText(form, `waste_name-${i}`, line.materialName);
    setText(form, `waste_packaging-${i}`, line.packaging);
    setText(form, `eural_code-${i}`, line.euralCode);
    setText(form, `processing_method-${i}`, line.processingMethod);
    setText(form, `estimated_weight-${i}`, line.estimatedWeight);
    setText(form, `measured_weight-${i}`, line.measuredWeight);
  });

  // Flatten so fields are read-only in the final document
  form.flatten();

  const pdfBytes = await pdfDoc.save();
  const fileName = `begeleidingsbrief_${mappedData.documentNumber}.pdf`;
  const filePath = path.join(OUTPUT_DIR, fileName);
  fs.writeFileSync(filePath, pdfBytes);

  return {
    fileName,
    filePath,
    fileSize: fs.statSync(filePath).size,
  };
}

module.exports = { generateBegeleidingsbriefPDF };
