import express from 'express';
import { protect, authorize } from '../middleware/auth.middleware.js';
import {
  applyForClearance,
  getMyClearanceStatus,
  getOfficerPendingQueue,
  submitReviewAction,
  getAllClearanceRequests,
  getClearanceAnalytics,
  getClearanceDetailWithAudit,
  generateClearanceCertificate,
} from '../controllers/clearance.controller.js';

const router = express.Router();

// ── Student Routes ──
router.post('/apply', protect, authorize('student'), applyForClearance);
router.get('/my-status', protect, authorize('student'), getMyClearanceStatus);

// ── Officer Routes ──
router.get('/officer/pending', protect, authorize('officer'), getOfficerPendingQueue);
router.put('/officer/review/:review_id', protect, authorize('officer'), submitReviewAction);

// ── Admin & Controller Routes ──
router.get('/admin/all', protect, authorize('admin', 'controller'), getAllClearanceRequests);
router.get('/analytics', protect, authorize('admin', 'controller'), getClearanceAnalytics);
router.post('/:clearance_id/generate-certificate', protect, authorize('admin', 'controller'), generateClearanceCertificate);

// ── Shared Detail Route (Admin, Controller, Student) ──
router.get('/:clearance_id', protect, authorize('admin', 'controller', 'student'), getClearanceDetailWithAudit);

export default router;