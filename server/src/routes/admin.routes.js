import express from 'express';
import multer from 'multer';
import {
  getPendingRequests,
  approveRequest,
  rejectRequest,
  importEligibleStudents,
} from '../controllers/admin.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

router.use(protect, authorize('admin'));

router.get('/registration-requests', getPendingRequests);
router.put('/registration-requests/:id/approve', approveRequest);
router.put('/registration-requests/:id/reject', rejectRequest);
router.post('/import-eligible-students', upload.single('file'), importEligibleStudents);

export default router;