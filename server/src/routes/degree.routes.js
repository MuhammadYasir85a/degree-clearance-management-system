import express from 'express';
import { protect, authorize } from '../middleware/auth.middleware.js';
import { upload } from '../middleware/upload.middleware.js';
import {
  applyForDegree,
  uploadDocument,
  getMyDegreeApplication,
  getControllerDegreeQueue,
  verifyDocument,
  updateDegreeStatus,
  generateCollectionReceipt,
} from '../controllers/degree.controller.js';

const router = express.Router();

// ── Student Routes ──
router.post('/apply', protect, authorize('student'), applyForDegree);
router.post('/documents/upload', protect, authorize('student'), upload.single('file'), uploadDocument);
router.get('/my-application', protect, authorize('student'), getMyDegreeApplication);

// ── Controller & Admin Routes ──
router.get('/controller/queue', protect, authorize('controller', 'admin'), getControllerDegreeQueue);
router.put('/controller/verify-document/:document_id', protect, authorize('controller', 'admin'), verifyDocument);
router.put('/controller/update-status/:degree_app_id', protect, authorize('controller', 'admin'), updateDegreeStatus);
router.post('/controller/generate-receipt/:degree_app_id', protect, authorize('controller', 'admin'), generateCollectionReceipt);

export default router;