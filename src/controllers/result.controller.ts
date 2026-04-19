import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase.js';
import { catchAsync } from '../utils/catchAsync.js';
import { AppError } from '../utils/AppError.js';
import { logAudit } from '../utils/auditLogger.js';
import { NotificationService } from '../services/notification.service.js';

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
        .eq('isWithheld', false) // Hide withheld results from church admins
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

    // Obscure scores and pass/fail logic if results are NOT released or result is WITHHELD
    const sanitizedResults = attempts.map(attempt => {
        const released = attempt.exams && attempt.exams.resultsReleased;
        const withheld = attempt.isWithheld;

        if (released && !withheld) {
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
            statusDisplay: withheld ? 'Withheld' : 'Submitted'
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
        if (!attempt.exams?.resultsReleased || attempt.isWithheld) {
            return next(new AppError('This result is not available for viewing.', 403));
        }
    } else if (req.user.role === 'RA') {
        if (attempt.userId !== req.user.id) {
            return next(new AppError('You are not authorized to view this result.', 403));
        }
        if (!attempt.exams?.resultsReleased || attempt.isWithheld) {
            return next(new AppError('This result is currently withheld or unreleased.', 403));
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

// 6. Toggle Withhold Status (Admin Action)
export const toggleWithhold = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { isWithheld } = req.body;

    const { data: updated, error } = await supabase
        .from('exam_attempts')
        .update({ isWithheld })
        .eq('id', id)
        .select(`*, exams:examId(title), users:userId(id, firstName, lastName)`)
        .single();

    if (error) return next(new AppError(error.message, 500));

    // Audit Log
    await logAudit({
        userId: req.user.id,
        action: isWithheld ? 'WITHHOLD_RESULT' : 'UNWITHHOLD_RESULT',
        resource: 'exam_attempts',
        resourceId: id as string,
        req
    });

    // Notify the student
    if (isWithheld) {
        NotificationService.notifyUsers(
            [updated.userId],
            'Result Withheld',
            `Your result for ${Array.isArray(updated.exams) ? updated.exams[0]?.title : updated.exams?.title} has been withheld for review by the administrators.`,
            'ALERT'
        );
    } else if (updated.exams?.resultsReleased) {
        // Only notify about availability if the results are generally released
        NotificationService.notifyUsers(
            [updated.userId],
            'Result Released',
            `Your result for ${Array.isArray(updated.exams) ? updated.exams[0]?.title : updated.exams?.title} is now available.`,
            'INFO'
        );
    }

    res.status(200).json({
        status: 'success',
        data: { attempt: updated }
    });
});

// 7. Update Assessment Scores (LTC/Hiking)
export const updateAssessment = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { ltcScore, hikingScore } = req.body;

    // Fetch attempt first to get examScore
    const { data: attempt, error: fetchError } = await supabase
        .from('exam_attempts')
        .select(`*, exams:examId(title, passMark)`)
        .eq('id', id)
        .single();

    if (fetchError || !attempt) return next(new AppError('Attempt not found', 404));

    // Ensure scores are numbers to prevent NaN issues in DB
    const cleanLtc = Number(ltcScore) || 0;
    const cleanHiking = Number(hikingScore) || 0;

    const examCore = (attempt.examScore || 0) * 0.8;
    const finalScore = Math.round(examCore + cleanLtc + cleanHiking);
    const examsObj = Array.isArray(attempt.exams) ? attempt.exams[0] : attempt.exams;
    const passed = finalScore >= (examsObj?.passMark || 50);

    const { data: updated, error } = await supabase
        .from('exam_attempts')
        .update({ 
            ltcScore: cleanLtc, 
            hikingScore: cleanHiking, 
            score: finalScore,
            passed 
        })
        .eq('id', id)
        .select(`*, exams:examId(title)`)
        .single();

    if (error) {
        console.error('Assessment update failed:', error);
        return next(new AppError(error.message, 500));
    }

    if (!updated) return next(new AppError('Failed to retrieve updated record', 500));

    // Audit Log
    await logAudit({
        userId: req.user.id,
        action: 'UPDATE_ASSESSMENT',
        resource: 'exam_attempts',
        resourceId: id as string,
        req
    });

    // Notify the student
    NotificationService.notifyUsers(
        [updated.userId],
        'Result Updated',
        `Your final grade for ${Array.isArray(updated.exams) ? updated.exams[0]?.title : updated.exams?.title} has been updated following assessment review.`,
        'INFO'
    );

    res.status(200).json({
        status: 'success',
        data: { attempt: updated }
    });
});

// 8. Bulk Update Assessments
export const bulkUpdateAssessments = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { updates } = req.body; // Array of { id, ltcScore, hikingScore }

    if (!Array.isArray(updates)) {
        return next(new AppError('Invalid updates format', 400));
    }

    const results = await Promise.all(updates.map(async (u) => {
        const { id, ltcScore, hikingScore } = u;

        // Fetch examScore and passMark
        const { data: attempt } = await supabase
            .from('exam_attempts')
            .select(`examScore, exams:examId(passMark)`)
            .eq('id', id)
            .single();

        if (!attempt) return null;

        const examCore = (attempt.examScore || 0) * 0.8;
        const finalScore = Math.round(examCore + (ltcScore || 0) + (hikingScore || 0));
        const examsObj = Array.isArray(attempt.exams) ? attempt.exams[0] : attempt.exams;
        const passed = finalScore >= (examsObj?.passMark || 50);

        const { data: updated } = await supabase
            .from('exam_attempts')
            .update({ 
                ltcScore, 
                hikingScore, 
                score: finalScore,
                passed 
            })
            .eq('id', id)
            .select()
            .single();

        return updated;
    }));

    // Filter out nulls and Audit Log
    const successful = results.filter(r => r !== null);
    
    await logAudit({
        userId: req.user.id,
        action: 'BULK_UPDATE_ASSESSMENT',
        resource: 'exam_attempts',
        details: { count: successful.length },
        req
    });

    res.status(200).json({
        status: 'success',
        data: { count: successful.length }
    });
});
