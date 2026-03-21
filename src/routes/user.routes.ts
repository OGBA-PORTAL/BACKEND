import express from 'express';
import * as userController from '../controllers/user.controller.js';
import * as authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

// Protect all routes
router.use(authMiddleware.protect);

// --- Current user ---
router.get('/me', userController.getMe);
router.patch('/me', userController.updateMe);
router.patch('/me/password', userController.changeMyPassword);

// --- Admin: list & manage users ---
// --- Admin: list & manage users ---
router.get('/', authMiddleware.restrictTo('SYSTEM_ADMIN', 'ASSOCIATION_OFFICER', 'CHURCH_ADMIN'), userController.getAllUsers);
router.patch('/bulk-status', authMiddleware.restrictTo('SYSTEM_ADMIN', 'ASSOCIATION_OFFICER'), userController.bulkUpdateStatus);
router.patch('/:id/status', authMiddleware.restrictTo('SYSTEM_ADMIN', 'ASSOCIATION_OFFICER'), userController.updateUserStatus);
router.delete('/:id', authMiddleware.restrictTo('SYSTEM_ADMIN', 'ASSOCIATION_OFFICER'), userController.deleteUser);
router.patch('/:id/role', authMiddleware.restrictTo('SYSTEM_ADMIN', 'ASSOCIATION_OFFICER'), userController.updateUserRole);
router.patch('/:id/admin', authMiddleware.restrictTo('SYSTEM_ADMIN', 'ASSOCIATION_OFFICER'), userController.updateUserAdmin);
router.patch('/:id/force-password-reset', authMiddleware.restrictTo('SYSTEM_ADMIN', 'ASSOCIATION_OFFICER', 'GLOBAL_ADMIN', 'CHURCH_ADMIN'), userController.forceResetPassword);

export default router;
