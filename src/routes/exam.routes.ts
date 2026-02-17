import express from 'express';
import * as examController from '../controllers/exam.controller.js';
import * as questionController from '../controllers/question.controller.js';
import * as attemptController from '../controllers/attempt.controller.js';
import { protect, restrictTo } from '../middleware/authMiddleware.js';

const router = express.Router();

// Protect all routes
router.use(protect);

// --- Admin / Assoc Routes ---
// Only they can manage exams
router
    .route('/')
    .get(restrictTo('SYSTEM_ADMIN', 'ASSOCIATION_OFFICER'), examController.getAllExams)
    .post(restrictTo('SYSTEM_ADMIN', 'ASSOCIATION_OFFICER'), examController.createExam);

router
    .route('/:id')
    .get(restrictTo('SYSTEM_ADMIN', 'ASSOCIATION_OFFICER'), examController.getExam);

router
    .route('/:id/publish')
    .patch(restrictTo('SYSTEM_ADMIN', 'ASSOCIATION_OFFICER'), examController.publishExam);

// --- Question Management ---
router
    .route('/:examId/questions')
    .get(restrictTo('SYSTEM_ADMIN', 'ASSOCIATION_OFFICER'), questionController.getExamQuestions)
    .post(restrictTo('SYSTEM_ADMIN', 'ASSOCIATION_OFFICER'), questionController.addQuestion);

// Explicit question delete
router
    .route('/questions/:id')
    .delete(restrictTo('SYSTEM_ADMIN', 'ASSOCIATION_OFFICER'), questionController.deleteQuestion);

// --- Student Attempt Routes ---
router.post('/start', attemptController.startAttempt); // RAs start exam
router.post('/submit', attemptController.submitAttempt); // RAs submit exam

export default router;
