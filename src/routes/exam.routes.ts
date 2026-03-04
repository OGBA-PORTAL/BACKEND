import express from 'express';
import * as examController from '../controllers/exam.controller.js';
import * as questionController from '../controllers/question.controller.js';
import * as attemptController from '../controllers/attempt.controller.js';
import { protect, restrictTo } from '../middleware/authMiddleware.js';

const router = express.Router();

// Protect all routes
router.use(protect);

// --- Student: list published exams ---
router.get('/published', examController.getPublishedExams);

// --- Admin / Assoc Routes ---
router
    .route('/')
    .get(restrictTo('SYSTEM_ADMIN', 'ASSOCIATION_OFFICER'), examController.getAllExams)
    .post(restrictTo('SYSTEM_ADMIN', 'ASSOCIATION_OFFICER'), examController.createExam);

router
    .route('/:id')
    .get(restrictTo('SYSTEM_ADMIN', 'ASSOCIATION_OFFICER'), examController.getExam)
    .delete(restrictTo('SYSTEM_ADMIN', 'ASSOCIATION_OFFICER'), examController.deleteExam);

// Publish via status PATCH (frontend sends PATCH /exams/:id/status)
router
    .route('/:id/status')
    .patch(restrictTo('SYSTEM_ADMIN', 'ASSOCIATION_OFFICER'), examController.updateExamStatus);

// Legacy publish route (keep for backward compat)
router
    .route('/:id/publish')
    .patch(restrictTo('SYSTEM_ADMIN', 'ASSOCIATION_OFFICER'), examController.publishExam);

// Release results for a specific exam
router
    .route('/:id/release')
    .patch(restrictTo('SYSTEM_ADMIN', 'ASSOCIATION_OFFICER'), examController.releaseExamResults);

// --- Question Management ---
router
    .route('/:examId/questions')
    .get(restrictTo('SYSTEM_ADMIN', 'ASSOCIATION_OFFICER'), questionController.getExamQuestions)
    .post(restrictTo('SYSTEM_ADMIN', 'ASSOCIATION_OFFICER'), questionController.addQuestion);

// Batch Import Questions (CSV support)
router.post('/:examId/questions/batch', restrictTo('SYSTEM_ADMIN', 'ASSOCIATION_OFFICER'), questionController.batchAddQuestions);

// Delete a specific question
router
    .route('/:examId/questions/:id')
    .delete(restrictTo('SYSTEM_ADMIN', 'ASSOCIATION_OFFICER'), questionController.deleteQuestion);

// --- Student Attempt Routes ---
// POST /exams/:examId/attempt — start or resume
// Student Attempt Routes
router.post('/:examId/attempt', restrictTo('RA'), attemptController.startAttemptByExamId);
router.patch('/save', restrictTo('RA'), attemptController.saveProgress);
router.post('/submit', restrictTo('RA'), attemptController.submitAttempt);

// Legacy routes
router.post('/start', attemptController.startAttempt);

export default router;
