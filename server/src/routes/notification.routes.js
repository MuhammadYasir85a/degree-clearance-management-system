import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import {
  getMyNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../controllers/notification.controller.js';

const router = express.Router();

router.get('/', protect, getMyNotifications);
router.put('/read-all', protect, markAllNotificationsAsRead);
router.put('/:notification_id/read', protect, markNotificationAsRead);

export default router;