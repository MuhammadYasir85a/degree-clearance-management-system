import express from 'express';
import { protect, authorize } from '../middleware/auth.middleware.js';
import { chatRateLimit } from '../middleware/chat-rate-limit.middleware.js';
import {
  sendMessage,
  getSessions,
  getSessionMessages,
  deleteSession,
  adminCreateKB,
  adminListKB,
  adminUpdateKB,
  adminDeleteKB,
} from '../controllers/chat.controller.js';

const router = express.Router();

router.use(protect, authorize('student', 'officer', 'controller', 'admin'));

router.post('/message', chatRateLimit, sendMessage);
router.get('/sessions', getSessions);
router.get('/sessions/:session_id', getSessionMessages);
router.delete('/sessions/:session_id', deleteSession);

router.post('/admin/kb', authorize('admin'), adminCreateKB);
router.get('/admin/kb', authorize('admin', 'controller'), adminListKB);
router.put('/admin/kb/:kb_id', authorize('admin'), adminUpdateKB);
router.delete('/admin/kb/:kb_id', authorize('admin'), adminDeleteKB);

export default router;
