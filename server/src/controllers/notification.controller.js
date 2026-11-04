import prisma, { withDbRetry } from '../config/prisma.js';

// GET /api/notifications (All Authenticated Users)
export const getMyNotifications = async (req, res) => {
  try {
    const userId = req.user.user_id;

    const notifications = await withDbRetry(() =>
      prisma.notification.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
      })
    );

    const unreadCount = notifications.filter((n) => !n.is_read).length;

    return res.status(200).json({
      success: true,
      unread_count: unreadCount,
      data: notifications,
    });
  } catch (error) {
    console.error('Get Notifications Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications.',
      error: error.message,
    });
  }
};

// PUT /api/notifications/:notification_id/read (All Authenticated Users)
export const markNotificationAsRead = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const notificationId = parseInt(req.params.notification_id, 10);

    if (isNaN(notificationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification ID.',
      });
    }

    const notification = await withDbRetry(() =>
      prisma.notification.findUnique({
        where: { notification_id: notificationId },
      })
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found.',
      });
    }

    if (notification.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update this notification.',
      });
    }

    const updated = await withDbRetry(() =>
      prisma.notification.update({
        where: { notification_id: notificationId },
        data: { is_read: true },
      })
    );

    return res.status(200).json({
      success: true,
      message: 'Notification marked as read.',
      data: updated,
    });
  } catch (error) {
    console.error('Mark Notification Read Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update notification.',
      error: error.message,
    });
  }
};

// PUT /api/notifications/read-all (All Authenticated Users)
export const markAllNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.user.user_id;

    await withDbRetry(() =>
      prisma.notification.updateMany({
        where: { user_id: userId, is_read: false },
        data: { is_read: true },
      })
    );

    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read.',
    });
  } catch (error) {
    console.error('Mark All Read Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark notifications as read.',
      error: error.message,
    });
  }
};