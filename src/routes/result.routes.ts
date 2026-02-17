import express from 'express';
import * as resultController from '../controllers/result.controller.js';
import * as dashboardController from '../controllers/dashboard.controller.js';
import { protect, restrictTo } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

// --- Student Routes ---
router.get('/me', resultController.getMyResults);

// --- Admin Routes ---
router.get('/admin', restrictTo('SYSTEM_ADMIN', 'ASSOCIATION_OFFICER'), resultController.getAllResults);
router.post('/admin/release', restrictTo('SYSTEM_ADMIN', 'ASSOCIATION_OFFICER'), resultController.releaseResults);

// --- Dashboard ---
router.get('/dashboard/stats', restrictTo('SYSTEM_ADMIN', 'ASSOCIATION_OFFICER'), dashboardController.getDashboardStats);

export default router;
