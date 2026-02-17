import express from 'express';
import * as authController from '../controllers/auth.controller.js';

import * as authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/signup', authMiddleware.protect, authMiddleware.restrictTo('CHURCH_ADMIN', 'ASSOCIATION_OFFICER', 'SYSTEM_ADMIN'), authController.signup);
router.post('/login', authController.login);
router.get('/logout', authController.logout);

export default router;
