import express from 'express';
import {
  getPendingRequests,
  approveRequest,
  rejectRequest,
} from '../controllers/admin.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(protect, authorize('admin'));

router.get('/registration-requests', getPendingRequests);
router.put('/registration-requests/:id/approve', approveRequest);
router.put('/registration-requests/:id/reject', rejectRequest);

export default router;