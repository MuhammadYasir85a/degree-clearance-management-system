import '../config/env.js';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import prisma, { withDbRetry } from '../config/prisma.js';
import { createUniversityPdf, resolveGeneratedPdf } from '../services/pdf.service.js';
import { removeFile } from '../services/file-storage.service.js';

export async function backfillGeneratedPdfs() {
  const [receipts, clearances] = await Promise.all([
    withDbRetry(() => prisma.receipt.findMany({
      include: { degreeApplication: { include: { student: { select: { full_name: true, registration_no: true } } } } },
    })),
    withDbRetry(() => prisma.clearanceRequest.findMany({
      where: { certificate_uri: { not: null } }, include: { student: { select: { full_name: true } } },
    })),
  ]);
  let updated = 0;
  for (const receipt of receipts) {
    if (resolveGeneratedPdf(receipt.pdf_url)) continue;
    const generated = await createUniversityPdf({
      kind: 'receipt', reference: receipt.receipt_number, title: 'Degree Collection Receipt',
      fields: [
        ['Student', receipt.degreeApplication.student.full_name],
        ['Registration No.', receipt.degreeApplication.student.registration_no],
        ['Degree Application', receipt.degree_app_id],
        ['Collection Date', receipt.collection_date.toISOString().slice(0, 10)],
      ],
    });
    try {
      await withDbRetry(() => prisma.receipt.update({ where: { receipt_id: receipt.receipt_id }, data: { pdf_url: generated.uri } }));
      updated += 1;
    } catch (error) { await removeFile(generated.path); throw error; }
  }
  for (const clearance of clearances) {
    if (resolveGeneratedPdf(clearance.certificate_uri)) continue;
    const reference = `CERT-GRADFLOW-${clearance.clearance_id}`;
    const generated = await createUniversityPdf({
      kind: 'clearance-certificate', reference, title: 'Clearance Certificate',
      fields: [['Student', clearance.student.full_name], ['Clearance Request', clearance.clearance_id], ['Status', clearance.status], ['Issued Date', clearance.certificate_generated_at?.toISOString().slice(0, 10)]],
    });
    try {
      await withDbRetry(() => prisma.clearanceRequest.update({ where: { clearance_id: clearance.clearance_id }, data: { certificate_uri: generated.uri } }));
      updated += 1;
    } catch (error) { await removeFile(generated.path); throw error; }
  }
  return updated;
}

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  try { console.log(`Backfilled ${await backfillGeneratedPdfs()} generated PDF record(s).`); }
  catch (error) { console.error(`PDF backfill failed (${error.code || error.name}).`); process.exitCode = 1; }
  finally { await withDbRetry(() => prisma.$disconnect()); }
}
