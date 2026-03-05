import express from 'express';
import * as reportController from '../controllers/report.controller.js';
import { protect, restrictTo } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(protect);

// Global Admins
router.get('/global', restrictTo('SYSTEM_ADMIN', 'ASSOCIATION_OFFICER'), reportController.getGlobalReport);

// Church Admins
router.get('/church', restrictTo('CHURCH_ADMIN'), reportController.getChurchReport);

export default router;
