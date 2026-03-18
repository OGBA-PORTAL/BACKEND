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

// --- Student Attempt Routes ---
// POST /exams/:examId/attempt is dynamic, but these exact paths must be first
router.patch('/save', restrictTo('RA'), attemptController.saveProgress);
router.post('/submit', restrictTo('RA'), attemptController.submitAttempt);
router.post('/start', attemptController.startAttempt); // Legacy

router
    .route('/:id')
    .get(restrictTo('SYSTEM_ADMIN', 'ASSOCIATION_OFFICER'), examController.getExam)
    .patch(restrictTo('SYSTEM_ADMIN', 'ASSOCIATION_OFFICER'), examController.updateExam)
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

// Retract results for a specific exam
router
    .route('/:id/retract')
    .patch(restrictTo('SYSTEM_ADMIN', 'ASSOCIATION_OFFICER'), examController.retractExamResults);

// Get specific exam status (allow RA so students can poll it)
router
    .route('/:id/status')
    .get(examController.getExamStatus);

// Post security violation breach from frontend
router
    .route('/:id/breach')
    .post(examController.handleSecurityBreach);

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

// --- Student Attempt Routes (Dynamic) ---
// POST /exams/:examId/attempt — start or resume
router.post('/:examId/attempt', restrictTo('RA'), attemptController.startAttemptByExamId);

export default router;
