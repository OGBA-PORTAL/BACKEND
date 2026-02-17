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
            users:userId (firstName, lastName, raNumber, churchId, rankId),
            exams:examId (title, passMark)
        `)
        .eq('status', 'SUBMITTED')
        .order('score', { ascending: false });

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
                users:userId!inner (firstName, lastName, raNumber, churchId, rankId),
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

// 2. Get My Results (Student View)
export const getMyResults = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user.id;

    // Fetch attempts
    const { data: attempts, error } = await supabase
        .from('exam_attempts')
        .select(`
            *,
            exams:examId (title, passMark, resultsReleased)
        `)
        .eq('userId', userId)
        .eq('status', 'SUBMITTED');

    if (error) return next(new AppError(error.message, 500));

    // Filter out scores if results NOT released
    const sanitizedResults = attempts.map(attempt => {
        const isReleased = (attempt.exams as any)?.resultsReleased;
        return {
            ...attempt,
            score: isReleased ? attempt.score : null,
            totalPoints: isReleased ? attempt.totalPoints : null,
            passed: isReleased ? (attempt.score >= (attempt.exams as any).passMark) : null,
            statusDisplay: isReleased ? (attempt.score >= (attempt.exams as any).passMark ? 'PASSED' : 'FAILED') : 'SUBMITTED (Pending Release)'
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
