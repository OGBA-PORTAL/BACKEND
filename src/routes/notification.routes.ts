import { Router } from 'express';
import {
    getUserNotifications,
    markAsRead,
    markAllAsRead,
    createNotification
} from '../controllers/notification.controller.js';
import { protect, restrictTo } from '../middleware/authMiddleware.js';

const router = Router();

// Only authenticated users can access their notifications
router.use(protect);

router.get('/', getUserNotifications);
router.patch('/read-all', markAllAsRead);
router.patch('/:id/read', markAsRead);

// Sys admins can manually dispatch a notification if needed
router.post('/', restrictTo('SYSTEM_ADMIN'), createNotification);

export default router;
