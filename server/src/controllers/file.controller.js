import { access } from 'node:fs/promises';
import prisma, { withDbRetry } from '../config/prisma.js';
import { positiveInteger, publicError } from '../utils/http.utils.js';
import { resolveStoredDocument, safeDownloadName } from '../services/file-storage.service.js';
import { resolveGeneratedPdf } from '../services/pdf.service.js';

function canViewStudentRecord(user, studentId) {
  return ['admin', 'controller'].includes(user.role) || (user.role === 'student' && user.user_id === studentId);
}

export async function downloadDocument(req, res) {
  try {
    const documentId = positiveInteger(req.params.document_id, 'document_id');
    const document = await withDbRetry(() => prisma.document.findUnique({
      where: { document_id: documentId },
      include: { degreeApplication: { select: { student_id: true } } },
    }));
    if (!document) return res.status(404).json({ success: false, message: 'Document not found.' });
    if (!canViewStudentRecord(req.user, document.degreeApplication.student_id)) {
      return res.status(403).json({ success: false, message: 'You are not authorized to download this document.' });
    }
    const path = resolveStoredDocument(document.file_url);
    if (!path) return res.status(404).json({ success: false, message: 'Document file not found.' });
    await access(path);
    return res.download(path, safeDownloadName(document.document_type, path));
  } catch (error) {
    if (error.code === 'ENOENT') return res.status(404).json({ success: false, message: 'Document file not found.' });
    return publicError(res, error, 'Failed to download document.');
  }
}

export async function downloadClearanceCertificate(req, res) {
  try {
    const clearanceId = positiveInteger(req.params.clearance_id, 'clearance_id');
    const clearance = await withDbRetry(() => prisma.clearanceRequest.findUnique({ where: { clearance_id: clearanceId } }));
    if (!clearance) return res.status(404).json({ success: false, message: 'Clearance request not found.' });
    if (!canViewStudentRecord(req.user, clearance.student_id)) {
      return res.status(403).json({ success: false, message: 'You are not authorized to download this certificate.' });
    }
    const path = resolveGeneratedPdf(clearance.certificate_uri);
    if (!path) return res.status(404).json({ success: false, message: 'Certificate file not found.' });
    await access(path);
    return res.download(path, `clearance-certificate-${clearanceId}.pdf`);
  } catch (error) {
    if (error.code === 'ENOENT') return res.status(404).json({ success: false, message: 'Certificate file not found.' });
    return publicError(res, error, 'Failed to download clearance certificate.');
  }
}

export async function downloadReceipt(req, res) {
  try {
    const receiptId = positiveInteger(req.params.receipt_id, 'receipt_id');
    const receipt = await withDbRetry(() => prisma.receipt.findUnique({
      where: { receipt_id: receiptId }, include: { degreeApplication: { select: { student_id: true } } },
    }));
    if (!receipt) return res.status(404).json({ success: false, message: 'Receipt not found.' });
    if (!canViewStudentRecord(req.user, receipt.degreeApplication.student_id)) {
      return res.status(403).json({ success: false, message: 'You are not authorized to download this receipt.' });
    }
    const path = resolveGeneratedPdf(receipt.pdf_url);
    if (!path) return res.status(404).json({ success: false, message: 'Receipt file not found.' });
    await access(path);
    return res.download(path, `${receipt.receipt_number}.pdf`);
  } catch (error) {
    if (error.code === 'ENOENT') return res.status(404).json({ success: false, message: 'Receipt file not found.' });
    return publicError(res, error, 'Failed to download receipt.');
  }
}
