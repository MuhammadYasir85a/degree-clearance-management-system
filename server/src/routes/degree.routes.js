import express from 'express';
import { protect, authorize } from '../middleware/auth.middleware.js';
import { upload } from '../middleware/upload.middleware.js';
import {
  applyForDegree,
  uploadDocument,
  deleteDocument,
  submitDegreeApplication,
  updateDegreeParticulars,
  getMyDegreeApplication,
  getControllerDegreeQueue,
  verifyDocument,
  updateDegreeStatus,
  generateCollectionReceipt,
  getControllerDegreeApplication,
  verifyAllDocuments,
  lookupDegreeHandover,
  confirmDegreeHandover,
  verifyPublicReceipt,
} from '../controllers/degree.controller.js';

const router = express.Router();

router.get('/verify-receipt/:receipt_number', verifyPublicReceipt);

// ── Student Routes ──
router.post('/apply', protect, authorize('student'), applyForDegree);
router.post('/documents/upload', protect, authorize('student'), upload.single('file'), uploadDocument);
router.delete('/documents/:document_id', protect, authorize('student'), deleteDocument);
router.post('/submit/:degree_app_id', protect, authorize('student'), submitDegreeApplication);
router.put('/:degree_app_id/particulars', protect, authorize('student'), updateDegreeParticulars);
router.get('/my-application', protect, authorize('student'), getMyDegreeApplication);

// ── Controller & Admin Routes ──
router.get('/controller/queue', protect, authorize('controller', 'admin'), getControllerDegreeQueue);
router.get('/controller/applications/:degree_app_id', protect, authorize('controller', 'admin'), getControllerDegreeApplication);
router.put('/controller/verify-all/:degree_app_id', protect, authorize('controller', 'admin'), verifyAllDocuments);
router.get('/controller/handover/lookup', protect, authorize('controller', 'admin'), lookupDegreeHandover);
router.post('/controller/handover/:degree_app_id', protect, authorize('controller', 'admin'), confirmDegreeHandover);
router.put('/controller/verify-document/:document_id', protect, authorize('controller', 'admin'), verifyDocument);
router.put('/controller/update-status/:degree_app_id', protect, authorize('controller', 'admin'), updateDegreeStatus);
router.post('/controller/generate-receipt/:degree_app_id', protect, authorize('controller', 'admin'), generateCollectionReceipt);

export default router;
