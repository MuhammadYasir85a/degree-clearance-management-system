import express from 'express';
import { protect, authorize } from '../middleware/auth.middleware.js';
import {
  applyForClearance,
  previewClearanceApplication,
  withdrawClearanceApplication,
  getMyClearanceStatus,
  getOfficerPendingQueue,
  submitReviewAction,
  getAllClearanceRequests,
  getClearanceAnalytics,
  getClearanceDetailWithAudit,
  generateClearanceCertificate,
  resubmitCorrection,
  getOfficerQueue,
  bulkApproveReviews,
  exportOfficerClearances,
} from '../controllers/clearance.controller.js';

const router = express.Router();

// ── Student Routes ──
router.post('/apply', protect, authorize('student'), applyForClearance);
router.get('/preview', protect, authorize('student'), previewClearanceApplication);
router.delete('/withdraw/:clearance_id', protect, authorize('student'), withdrawClearanceApplication);
router.get('/my-status', protect, authorize('student'), getMyClearanceStatus);
router.put('/reviews/:review_id/resubmit', protect, authorize('student'), resubmitCorrection);
router.put('/reviews/:review_id', protect, authorize('officer'), submitReviewAction);

// ── Officer Routes ──
router.get('/officer/pending', protect, authorize('officer'), getOfficerPendingQueue);
router.get('/officer/queue', protect, authorize('officer'), getOfficerQueue);
router.post('/officer/bulk-approve', protect, authorize('officer'), bulkApproveReviews);
router.get('/officer/export', protect, authorize('officer'), exportOfficerClearances);
router.put('/officer/review/:review_id', protect, authorize('officer'), submitReviewAction);

// ── Admin & Controller Routes ──
router.get('/admin/all', protect, authorize('admin', 'controller'), getAllClearanceRequests);
router.get('/analytics', protect, authorize('admin', 'controller'), getClearanceAnalytics);
router.post('/:clearance_id/generate-certificate', protect, authorize('admin', 'controller', 'student'), generateClearanceCertificate);

// ── Shared Detail Route (Admin, Controller, Student) ──
router.get('/:clearance_id', protect, authorize('admin', 'controller', 'student'), getClearanceDetailWithAudit);

export default router;
