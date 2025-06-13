import express from "express";
import { protect } from "../middleware/auth.js";
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  deleteAllNotifications,
  getNotificationSettings,
  updateNotificationSettings,
  getUnreadCount,
  savePushToken
} from "../controllers/notificationController.js";

const router = express.Router();

router.get('/', protect, getUserNotifications);
router.get('/unread-count', protect, getUnreadCount);
router.put('/:notificationId/read', protect, markNotificationAsRead);
router.put('/mark-all-read', protect, markAllNotificationsAsRead);
router.delete('/:notificationId', protect, deleteNotification);
router.delete('/', protect, deleteAllNotifications);
router.get('/settings', protect, getNotificationSettings);
router.put('/settings', protect, updateNotificationSettings);
router.post('/save-token', protect, savePushToken);


export default router;
