import express from 'express';
import * as churchController from '../controllers/church.controller.js';
import * as authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

// Public route to list churches (needed for signup dropdown)
router.get('/', churchController.listChurches);

// Protected route to create churches
router.post('/', authMiddleware.protect, authMiddleware.restrictTo('ASSOCIATION_OFFICER', 'SYSTEM_ADMIN'), churchController.createChurch);

export default router;
