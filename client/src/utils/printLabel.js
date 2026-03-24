import { renderToString } from 'react-dom/server';
import { createElement } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import i18n from '../i18n';

const t = i18n.t.bind(i18n);

/**
 * Open a print window with a 100mm×50mm asset label containing a QR code.
 *
 * @param {object} asset - Asset record with asset_label, skip_type, material_category
 * @param {object} order - Order record with order_number
 */
export function printAssetLabel(asset, order) {
  const qrValue = JSON.stringify({
    label: asset.asset_label,
    order: order?.order_number || '',
    type: asset.skip_type,
  });

  const qrSvg = renderToString(
    createElement(QRCodeSVG, { value: qrValue, size: 100, level: 'M' })
  );

  const dateStr = new Date(asset.created_at).toLocaleDateString(
    i18n.language?.startsWith('nl') ? 'nl-NL' : 'en-GB'
  );
  const category = asset.material_category?.code_cbs || '';

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Asset Label - ${asset.asset_label}</title>
  <style>
    @page { size: 100mm 50mm; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: 100mm; height: 50mm; font-family: monospace; padding: 4mm; display: flex; align-items: center; gap: 4mm; }
    .qr { flex-shrink: 0; }
    .info { flex: 1; overflow: hidden; }
    .label { font-size: 16px; font-weight: bold; letter-spacing: 1px; margin-bottom: 3mm; }
    .detail { font-size: 9px; color: #333; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="qr">${qrSvg}</div>
  <div class="info">
    <div class="label">${asset.asset_label}</div>
    <div class="detail">
      ${t('weighing:printLabel.order')}: ${order?.order_number || '—'}<br/>
      ${t('weighing:printLabel.type')}: ${asset.skip_type.replace(/_/g, ' ')}<br/>
      ${t('weighing:printLabel.category')}: ${category}<br/>
      ${t('weighing:printLabel.date')}: ${dateStr}
    </div>
  </div>
</body>
</html>`;

  const printWindow = window.open('', '_blank', 'width=400,height=250');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }
}
