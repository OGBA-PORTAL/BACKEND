import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase.js';
import { catchAsync } from '../utils/catchAsync.js';
import { AppError } from '../utils/AppError.js';

// --- Helper Functions ---

// Fisher-Yates Shuffle
function shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// 1. Start Attempt (Randomization Logic)
export const startAttempt = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { examId } = req.body;
    const userId = req.user.id;

    // Check if exam exists and is PUBLISHED, and join its rank level
    const { data: exam, error: examError } = await supabase
        .from('exams')
        .select('*, ranks(level)')
        .eq('id', examId)
        .single();

    if (examError || !exam) return next(new AppError('Exam not found', 404));
    if (exam.status === 'PAUSED') return next(new AppError('This exam is currently paused by an administrator. Please wait.', 403));
    if (exam.status !== 'PUBLISHED') return next(new AppError('Exam is not active', 400));

    // Check exam date — prevent starting if date is in the future
    if (exam.examDate) {
        const examDate = new Date(exam.examDate);
        examDate.setHours(0, 0, 0, 0); // Start of exam day
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (examDate > today) {
            const formatted = examDate.toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' });
            return next(new AppError(`This exam is not yet open. It will be available on ${formatted}.`, 403));
        }
    }

    // Check eligibility (Rank Progression: User must take the exam for UserRankLevel + 1)
    if (exam.rankId && exam.ranks && typeof (exam.ranks as any).level === 'number') {
        const examRankLevel = (exam.ranks as any).level;
        let userRankLevel = 0; // Default 0 for new members

        if (req.user.rankId) {
            const { data: userRank } = await supabase.from('ranks').select('level').eq('id', req.user.rankId).single();
            if (userRank) userRankLevel = userRank.level;
        }

        if (examRankLevel > userRankLevel + 1) {
            return next(new AppError(`You are not eligible. Your current rank level is ${userRankLevel}, but this exam requires you to be taking Level ${examRankLevel}.`, 403));
        }
    }

    // Check if attempt already exists
    const { data: existingAttempt } = await supabase
        .from('exam_attempts')
        .select('*')
        .eq('userId', userId)
        .eq('examId', examId)
        .single();

    if (existingAttempt) {
        if (existingAttempt.status === 'SUBMITTED') {
            return next(new AppError('You have already taken this exam', 400));
        }

        // RESUME LOGIC
        // If the attempt is active, we must return the EXACT SAME questions that were stored.
        const storedQuestionIds = existingAttempt.questions as string[];

        if (!storedQuestionIds || storedQuestionIds.length === 0) {
            return next(new AppError('Error resuming exam: No questions found in attemptRecord.', 500));
        }

        // Fetch the specific questions
        const { data: resumedQuestions, error: resumeError } = await supabase
            .from('questions')
            .select('id, text, options, type, points')
            .in('id', storedQuestionIds);

        if (resumeError || !resumedQuestions) {
            return next(new AppError('Error fetching questions for resume.', 500));
        }

        // We need to return them in the ORIGINAL ORDER if possible?
        // The `in` query does not guarantee order.
        // Let's re-sort them based on `storedQuestionIds` order to ensure index consistency if needed.
        const questionMap = new Map(resumedQuestions.map(q => [q.id, q]));
        const orderedQuestions = storedQuestionIds
            .map(id => questionMap.get(id))
            .filter(q => q !== undefined);

        // Prepare response (Shuffle Options again for security)
        const questionsForFrontend = orderedQuestions.map(q => {
            let opts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
            if (typeof opts === 'string') opts = JSON.parse(opts);
            const optionsWithId = Array.isArray(opts) ? opts.map((opt: string, index: number) => ({ id: index, text: opt })) : [];
            const shuffledOptions = shuffleArray(optionsWithId);

            return {
                id: q.id,
                text: q.text,
                type: q.type,
                points: q.points,
                options: shuffledOptions
            };
        });

        return res.status(200).json({
            status: 'success',
            data: {
                attemptId: existingAttempt.id,
                examTitle: exam.title,
                duration: exam.duration,
                questions: questionsForFrontend,
                resumed: true,
                startedAt: existingAttempt.startedAt,
                answers: existingAttempt.answers
            }
        });
    }

    // --- RANDOMIZATION MAGIC ---

    // 1. Fetch ALL Questions for this exam
    const { data: allQuestions, error: qError } = await supabase
        .from('questions')
        .select('id, text, options, type, points') // Do NOT fetch correctOption
        .eq('examId', examId);

    if (qError || !allQuestions || allQuestions.length === 0) {
        return next(new AppError('No questions found for this exam', 400));
    }

    // 2. Shuffle Questions
    const shuffledQuestions = shuffleArray([...allQuestions]);

    // 3. Pick N Questions (e.g. 35)
    const countToPick = exam.questionCount || 35;
    const selectedQuestions = shuffledQuestions.slice(0, countToPick);

    // 4. Store IDs in Attempt (Freeze the set)
    const questionIds = selectedQuestions.map(q => q.id);

    // 5. Create Attempt Record
    const { data: attempt, error: attemptError } = await supabase
        .from('exam_attempts')
        .insert({
            userId,
            examId,
            questions: questionIds, // Store the specific question IDs
            status: 'STARTED',
            startedAt: new Date().toISOString()
        })
        .select()
        .single();

    if (attemptError) return next(new AppError(attemptError.message, 500));

    // 6. Prepare Response (Shuffle Options)
    // We send data to frontend: { attemptId, questions: [...] }
    // Each question options should be shuffled? 
    // Actually, sending simple strings ["A", "B", "C"] is risky if we shuffle them because index changes.
    // Better: Send options as objects { id: 0, text: "A" }, { id: 1, text: "B" } shuffled.

    const questionsForFrontend = selectedQuestions.map(q => {
        // Parse options if string, else assume array
        let opts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
        if (typeof opts === 'string') opts = JSON.parse(opts);

        // Map to objects with original index
        const optionsWithId = Array.isArray(opts) ? opts.map((opt: string, index: number) => ({ id: index, text: opt })) : [];

        // Shuffle options
        const shuffledOptions = shuffleArray(optionsWithId);

        return {
            id: q.id,
            text: q.text,
            type: q.type,
            points: q.points,
            options: shuffledOptions // [{id: 2, text: "C"}, {id: 0, text: "A"}...]
        };
    });

    res.status(201).json({
        status: 'success',
        data: {
            attemptId: attempt.id,
            examTitle: exam.title,
            duration: exam.duration,
            questions: questionsForFrontend,
            startedAt: attempt.startedAt,
            answers: {}
        }
    });
});

// 2. Submit Attempt (Grading Logic)
export const submitAttempt = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { attemptId, answers } = req.body; // answers: { "questionId": optionId (int) }

    // Fetch attempt
    const { data: attempt, error: fetchError } = await supabase
        .from('exam_attempts')
        .select('*, exams(status)')
        .eq('id', attemptId)
        .single();

    if (fetchError || !attempt) return next(new AppError('Attempt not found', 404));
    if (attempt?.exams?.status === 'PAUSED') return next(new AppError('This exam is currently paused by an administrator. You cannot submit right now.', 403));
    if (attempt.status === 'SUBMITTED') return next(new AppError('Attempt already submitted', 400));

    // Calculate Score
    let score = 0;
    let totalPoints = 0;

    // Fetch the actual questions that were assigned to this attempt
    // (We stored IDs in attempt.questions)
    // Actually, we can just fetch all questions for the exam to be safe/faster in one query
    const { data: questions } = await supabase
        .from('questions')
        .select('id, correctOption, points')
        .in('id', attempt.questions || []); // Only fetch the ones in the attempt

    if (!questions) return next(new AppError('Questions not found', 500));

    // Grading Map
    const questionMap = new Map(questions.map(q => [q.id, q]));

    // Iterate answers
    for (const [qId, selectedOption] of Object.entries(answers)) {
        const question = questionMap.get(qId);
        if (question) {
            totalPoints += question.points;
            if (question.correctOption === selectedOption) {
                score += question.points;
            }
        }
    }

    // Calculate total possible points (sum of all assigned questions)
    const maxScore = questions.reduce((sum, q) => sum + q.points, 0);

    // Update Attempt
    const { data: updatedAttempt, error: updateError } = await supabase
        .from('exam_attempts')
        .update({
            score,
            totalPoints: maxScore,
            status: 'SUBMITTED',
            submittedAt: new Date().toISOString(),
            answers // Store user answers
        })
        .eq('id', attemptId)
        .select()
        .single();

    if (updateError) return next(new AppError(updateError.message, 500));

    res.status(200).json({
        status: 'success',
        data: {
            message: 'Exam submitted successfully for grading.'
        }
    });
});

// 3. Start Attempt by URL param (POST /exams/:examId/attempt)
// Same logic as startAttempt but examId comes from req.params
export const startAttemptByExamId = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // req.body may be undefined if the POST had no JSON body — guard against that
    if (!req.body || typeof req.body !== 'object') req.body = {};
    req.body.examId = req.params.examId;
    return startAttempt(req, res, next);
});

export const saveProgress = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { attemptId, answers } = req.body;

    const { error } = await supabase
        .from('exam_attempts')
        .update({ answers })
        .eq('id', attemptId)
        .eq('status', 'STARTED'); // Only update if started

    if (error) return next(new AppError('Failed to save progress', 500));

    res.status(200).json({ status: 'success' });
});
