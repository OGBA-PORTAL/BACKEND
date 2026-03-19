import express from 'express';
import * as resultController from '../controllers/result.controller.js';
import * as dashboardController from '../controllers/dashboard.controller.js';
import { protect, restrictTo } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

// --- Student Routes ---
router.get('/my', resultController.getMyResults);   // frontend calls /results/my
router.get('/me', resultController.getMyResults);   // alias

// --- Admin Routes ---
router.get('/', restrictTo('SYSTEM_ADMIN', 'ASSOCIATION_OFFICER'), resultController.getAllResults);
router.get('/church', restrictTo('CHURCH_ADMIN'), resultController.getChurchResults);
router.get('/admin', restrictTo('SYSTEM_ADMIN', 'ASSOCIATION_OFFICER'), resultController.getAllResults); // alias
router.get('/:id', restrictTo('SYSTEM_ADMIN', 'ASSOCIATION_OFFICER', 'CHURCH_ADMIN', 'RA'), resultController.getDetailedResult);
router.delete('/:id', restrictTo('SYSTEM_ADMIN', 'ASSOCIATION_OFFICER'), resultController.deleteResult);

// --- Dashboard Stats ---
router.get('/dashboard/stats', restrictTo('SYSTEM_ADMIN', 'ASSOCIATION_OFFICER'), dashboardController.getDashboardStats);

export default router;
