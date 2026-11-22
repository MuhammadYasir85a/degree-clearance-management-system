import PDFDocument from 'pdfkit';
import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';

const outputRoot = resolve(fileURLToPath(new URL('../../private-uploads/generated', import.meta.url)));

export function departmentApprovalLayout(count) {
  if (!Number.isInteger(count) || count < 0 || count > 100) throw new Error('Department approval count must be an integer between 0 and 100.');
  const columns = count > 8 ? 3 : 2;
  return { columns, rows: count ? Math.ceil(count / columns) : 0 };
}

export async function createUniversityPdf({ kind, reference, title, fields, qrText = null, departmentApprovals = [] }) {
  await mkdir(outputRoot, { recursive: true });
  const filename = `${kind}-${randomUUID()}.pdf`;
  const path = resolve(outputRoot, filename);
  const qrBuffer = qrText ? await QRCode.toBuffer(qrText, { type: 'png', width: 180, margin: 1, errorCorrectionLevel: 'M' }) : null;
  await new Promise((resolvePromise, reject) => {
    const document = new PDFDocument({ size: 'A4', margin: 48, info: { Title: title, Author: 'GradFlow' } });
    const output = createWriteStream(path, { mode: 0o600 });
    output.on('finish', resolvePromise);
    output.on('error', reject);
    document.on('error', reject);
    document.pipe(output);
    document.fontSize(18).text('GradFlow Academic Operations Platform', { align: 'center' });
    document.moveDown().fontSize(16).text(title, { align: 'center' });
    document.moveDown(2).fontSize(11).text(`Reference: ${reference}`);
    for (const [label, value] of fields) document.moveDown(0.7).text(`${label}: ${value ?? 'N/A'}`);
    if (departmentApprovals.length) {
      document.moveDown(1.2).fontSize(11).fillColor('#0b4d2c').text(`Departmental Approvals (${departmentApprovals.length}/${departmentApprovals.length})`);
      const { columns, rows } = departmentApprovalLayout(departmentApprovals.length);
      const gap = 7;
      const startX = 48;
      const startY = document.y + 8;
      const width = (document.page.width - 96 - gap * (columns - 1)) / columns;
      const availableHeight = 690 - startY;
      const cellHeight = Math.max(55, Math.min(82, (availableHeight - gap * (rows - 1)) / rows));
      departmentApprovals.forEach((approval, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        const x = startX + column * (width + gap);
        const y = startY + row * (cellHeight + gap);
        document.roundedRect(x, y, width, cellHeight, 5).lineWidth(0.7).strokeColor('#b7c9bd').stroke();
        document.fillColor('#0b4d2c').fontSize(columns === 3 ? 7.3 : 8.2).text(approval.department, x + 7, y + 7, { width: width - 14, height: 20, ellipsis: true });
        document.fillColor('#25352c').fontSize(columns === 3 ? 6.4 : 7).text(`Officer: ${approval.officer || 'Authorized Officer'}`, x + 7, y + 27, { width: width - 14, height: 11, ellipsis: true });
        document.fillColor('#52645a').fontSize(6.2).text(`Approved: ${approval.approvedAt || 'Recorded'}`, x + 7, y + 40, { width: width - 14, height: 10, ellipsis: true });
        document.font('Courier').fillColor('#66756d').fontSize(5.8).text(`Verify: ${approval.verification}`, x + 7, y + cellHeight - 12, { width: width - 14, height: 8, ellipsis: true }).font('Helvetica');
      });
      document.y = startY + rows * cellHeight + (rows - 1) * gap;
    }
    if (qrBuffer) {
      const qrSize = departmentApprovals.length ? 62 : 100;
      const qrY = departmentApprovals.length ? Math.min(710, document.y + 10) : document.y + 18;
      document.image(qrBuffer, document.page.width / 2 - qrSize / 2, qrY, { fit: [qrSize, qrSize] });
      document.fillColor('#444').fontSize(7).text('Scan to verify this official record', 48, qrY + qrSize + 4, { width: document.page.width - 96, align: 'center' });
      document.y = qrY + qrSize + 16;
    }
    document.fontSize(8).fillColor('#555').text('Generated securely by GradFlow.', 48, Math.min(document.y + 12, 805), { width: document.page.width - 96, align: 'center' });
    document.end();
  }).catch(async (error) => { await unlink(path).catch(() => {}); throw error; });
  return { path, uri: `/api/files/generated/${filename}` };
}

export function resolveGeneratedPdf(uri) {
  const filename = String(uri || '').split('/').at(-1);
  return filename && /^[a-z-]+[0-9a-f-]{36}\.pdf$/i.test(filename) ? resolve(outputRoot, filename) : null;
}
