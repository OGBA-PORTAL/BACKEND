import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase.js';
import { catchAsync } from '../utils/catchAsync.js';
import { AppError } from '../utils/AppError.js';
import { logAudit } from '../utils/auditLogger.js';

// 1. Get All Results (Admin View - Filterable)
export const getAllResults = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { examId, churchId, rankId } = req.query;

    let query = supabase
        .from('exam_attempts')
        .select(`
            *,
            users:userId (firstName, lastName, raNumber, churchId, rankId, churches:churchId(name)),
            exams:examId (title, passMark)
        `)
        .eq('status', 'SUBMITTED')
        .order('submittedAt', { ascending: false });

    // Apply Filters
    if (examId) query = query.eq('examId', examId);

    // For User-related filters (church/rank), Supabase syntax is tricky on joins.
    // Easier approach: Filter in memory OR use advanced query syntax.
    // Supabase supports filtering on joined tables: e.g. !inner join.
    // Let's use !inner to enforce the filter.
    if (churchId) {
        query = supabase
            .from('exam_attempts')
            .select(`
                *,
                users:userId!inner (firstName, lastName, raNumber, churchId, rankId, churches:churchId(name)),
                exams:examId (title, passMark)
            `)
            .eq('users.churchId', churchId)
            .eq('status', 'SUBMITTED');
    }
    // (Similar logic for rankId if needed)

    // Run Query
    const { data: results, error } = await query;

    if (error) return next(new AppError(error.message, 500));

    res.status(200).json({
        status: 'success',
        results: results.length,
        data: { results }
    });
});

// 1.5 Get Church Results (Church Admin View)
export const getChurchResults = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { examId } = req.query;
    const churchId = req.user.churchId;

    if (!churchId) {
        return next(new AppError('You do not belong to a church.', 403));
    }

    let query = supabase
        .from('exam_attempts')
        .select(`
            *,
            users:userId!inner (firstName, lastName, raNumber, churchId, rankId, churches:churchId(name)),
            exams:examId!inner (title, passMark, resultsReleased)
        `)
        .eq('users.churchId', churchId)
        .eq('exams.resultsReleased', true)
        .eq('status', 'SUBMITTED')
        .order('submittedAt', { ascending: false });

    if (examId) query = query.eq('examId', examId);

    const { data: results, error } = await query;

    if (error) return next(new AppError(error.message, 500));

    res.status(200).json({
        status: 'success',
        results: results.length,
        data: { results }
    });
});

// 2. Get My Results (Student View)
export const getMyResults = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user.id;

    // Fetch attempts (both active and submitted)
    const { data: attempts, error } = await supabase
        .from('exam_attempts')
        .select(`
            *,
            exams:examId (title, passMark, resultsReleased)
        `)
        .eq('userId', userId)
        .order('submittedAt', { ascending: false });

    if (error) return next(new AppError(error.message, 500));

    // Obscure scores and pass/fail logic if results are NOT released
    const sanitizedResults = attempts.map(attempt => {
        if (attempt.exams && attempt.exams.resultsReleased) {
            return {
                ...attempt,
                statusDisplay: attempt.passed ? 'Passed' : 'Failed'
            };
        }

        return {
            ...attempt,
            score: null,          // Hidden
            totalPoints: null,    // Hidden
            passed: null,         // Hidden
            statusDisplay: 'Submitted'
        };
    });

    res.status(200).json({
        status: 'success',
        results: sanitizedResults.length,
        data: { results: sanitizedResults }
    });
});

// 3. Release Results (Admin Action)
export const releaseResults = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { examId } = req.body;
    const { release } = req.body; // true = release, false = hide

    const { data: exam, error } = await supabase
        .from('exams')
        .update({ resultsReleased: release })
        .eq('id', examId)
        .select()
        .single();

    if (error) return next(new AppError(error.message, 500));

    // Audit Log
    await logAudit({
        userId: req.user.id,
        action: release ? 'RELEASE_RESULTS' : 'HIDE_RESULTS',
        resource: 'exams',
        resourceId: examId,
        req
    });

    res.status(200).json({
        status: 'success',
        data: { exam }
    });
});

// 4. Delete Result / Exam Attempt (Admin Action)
export const deleteResult = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    // Verify it exists first
    const { data: existingAttempt, error: findError } = await supabase
        .from('exam_attempts')
        .select('id, userId, examId')
        .eq('id', id)
        .single();

    if (findError || !existingAttempt) {
        return next(new AppError('Attempt not found', 404));
    }

    // Delete the attempt
    const { error: deleteError } = await supabase
        .from('exam_attempts')
        .delete()
        .eq('id', id);

    if (deleteError) return next(new AppError(deleteError.message, 500));

    // Audit Log
    await logAudit({
        userId: req.user.id,
        action: 'DELETE_RESULT',
        resource: 'exam_attempts',
        resourceId: id as string,
        req
    });

    res.status(204).json({
        status: 'success',
        data: null
    });
});

// 5. Get Detailed Result Breakdown (Admin Action)
export const getDetailedResult = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    // Fetch the attempt with related user and exam info
    const { data: attempt, error: attemptError } = await supabase
        .from('exam_attempts')
        .select(`
            *,
            users:userId (firstName, lastName, raNumber, churchId, ranks:rankId(name, level)),
            exams:examId (title, passMark, questionCount, duration, resultsReleased, ranks:rankId(name, level))
        `)
        .eq('id', id)
        .single();

    if (attemptError || !attempt) {
        return next(new AppError('Attempt not found', 404));
    }

    // Role-based Access Control
    if (req.user.role === 'CHURCH_ADMIN') {
        if (attempt.users?.churchId !== req.user.churchId) {
            return next(new AppError('You are not authorized to view this result.', 403));
        }
        if (!attempt.exams?.resultsReleased) {
            return next(new AppError('This result has not been released yet.', 403));
        }
    } else if (req.user.role === 'RA') {
        if (attempt.userId !== req.user.id) {
            return next(new AppError('You are not authorized to view this result.', 403));
        }
        if (!attempt.exams?.resultsReleased) {
            return next(new AppError('This result has not been released yet.', 403));
        }
    }

    const questionIds = attempt.questions || [];
    const studentAnswers = attempt.answers || {};

    if (questionIds.length === 0) {
        return res.status(200).json({
            status: 'success',
            data: { attempt, questions: [] }
        });
    }

    // Fetch the actual questions to get text, options, and correctOption
    const { data: questions, error: qError } = await supabase
        .from('questions')
        .select('id, text, options, correctOption, points')
        .in('id', questionIds);

    if (qError || !questions) {
        return next(new AppError('Failed to fetch exam questions', 500));
    }

    // Format the questions to include what the student picked
    const detailedQuestions = questions.map(q => {
        let parsedOptions = [];
        try {
            parsedOptions = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
            if (typeof parsedOptions === 'string') parsedOptions = JSON.parse(parsedOptions);
        } catch (e) {
            console.error('Error parsing options:', e);
        }

        const optionsWithIndex = Array.isArray(parsedOptions)
            ? parsedOptions.map((optText, index) => ({ id: index, text: optText }))
            : [];

        const studentAnswerId = studentAnswers[q.id] !== undefined ? studentAnswers[q.id] : null;
        const isCorrect = studentAnswerId === q.correctOption;

        return {
            id: q.id,
            text: q.text,
            options: optionsWithIndex,
            correctOptionId: q.correctOption,
            studentAnswerId: studentAnswerId,
            isCorrect,
            pointsText: `${isCorrect ? q.points : 0}/${q.points}`,
            pointsAchieved: isCorrect ? q.points : 0,
            pointsMax: q.points
        };
    });

    res.status(200).json({
        status: 'success',
        data: {
            attempt,
            questions: detailedQuestions
        }
    });
});
