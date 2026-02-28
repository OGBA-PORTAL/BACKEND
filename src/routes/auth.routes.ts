import express from 'express';
import * as authController from '../controllers/auth.controller.js';
import * as authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

const adminOnly = [authMiddleware.protect, authMiddleware.restrictTo('CHURCH_ADMIN', 'ASSOCIATION_OFFICER', 'SYSTEM_ADMIN')];

router.post('/signup', ...adminOnly, authController.signup);
router.post('/register', ...adminOnly, authController.signup); // alias used by frontend
router.post('/login', authController.login);
router.get('/logout', authController.logout);

export default router;
