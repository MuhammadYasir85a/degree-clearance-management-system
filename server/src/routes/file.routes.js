import express from 'express';
import { protect, authorize } from '../middleware/auth.middleware.js';
import { downloadDocument, downloadClearanceCertificate, downloadReceipt } from '../controllers/file.controller.js';

const router = express.Router();
router.use(protect, authorize('student', 'controller', 'admin'));
router.get('/documents/:document_id', downloadDocument);
router.get('/clearance-certificates/:clearance_id', downloadClearanceCertificate);
router.get('/receipts/:receipt_id', downloadReceipt);
export default router;
