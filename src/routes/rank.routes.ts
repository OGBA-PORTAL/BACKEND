import express from 'express';
import * as rankController from '../controllers/rank.controller.js';

const router = express.Router();

// Public route to list ranks (for signup dropdown)
router.get('/', rankController.listRanks);

export default router;
