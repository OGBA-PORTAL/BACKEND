import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase.js';
import { catchAsync } from '../utils/catchAsync.js';
import { AppError } from '../utils/AppError.js';

export const getGlobalReport = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // Fetch all completed exams
    const { data: attempts, error } = await supabase
        .from('exam_attempts')
        .select(`
            *,
            users:userId!inner (firstName, lastName, raNumber, churchId, rankId, churches:churchId(name), ranks:rankId(name, level)),
            exams:examId!inner (title, passMark)
        `)
        .eq('status', 'SUBMITTED');

    if (error) return next(new AppError(error.message, 500));

    // Grouping Logic: Church -> Exam -> Rank -> Users
    const report: any = {};

    attempts.forEach(a => {
        const churchName = a.users?.churches?.name || 'Unknown Church';
        const examTitle = a.exams?.title || 'Unknown Exam';
        const rankName = a.users?.ranks?.name || 'Unknown Rank';

        if (!report[churchName]) report[churchName] = {};
        if (!report[churchName][examTitle]) report[churchName][examTitle] = {};
        if (!report[churchName][examTitle][rankName]) {
            report[churchName][examTitle][rankName] = {
                members: [],
                stats: { total: 0, passed: 0, failed: 0, avgScore: 0, totalScore: 0 }
            };
        }

        const group = report[churchName][examTitle][rankName];
        // Compute pass/fail live from score vs passMark (avoids relying on stale `passed` column)
        const didPass = a.score !== null && a.exams?.passMark !== undefined
            ? a.score >= a.exams.passMark
            : (a.passed ?? false);

        group.members.push({
            attemptId: a.id,
            name: `${a.users.firstName} ${a.users.lastName}`,
            raNumber: a.users.raNumber,
            score: a.score,
            passed: didPass,
            date: a.submittedAt
        });

        group.stats.total++;
        if (didPass) group.stats.passed++;
        else group.stats.failed++;
        group.stats.totalScore += (a.score || 0);
        group.stats.avgScore = Math.round(group.stats.totalScore / group.stats.total);
    });

    res.status(200).json({ status: 'success', data: { report } });
});

export const getChurchReport = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const churchId = req.user.churchId;
    if (!churchId) return next(new AppError('No church associated with this admin.', 403));

    const { data: attempts, error } = await supabase
        .from('exam_attempts')
        .select(`
            *,
            users:userId!inner (firstName, lastName, raNumber, churchId, rankId, ranks:rankId(name, level)),
            exams:examId!inner (title, passMark, resultsReleased)
        `)
        .eq('users.churchId', churchId)
        .eq('exams.resultsReleased', true) // Church admins only see released reports
        .eq('status', 'SUBMITTED');

    if (error) return next(new AppError(error.message, 500));

    // Grouping Logic for Church: Exam -> Rank -> Users
    const report: any = {};

    attempts.forEach(a => {
        const examTitle = a.exams?.title || 'Unknown Exam';
        const rankName = a.users?.ranks?.name || 'Unknown Rank';

        if (!report[examTitle]) report[examTitle] = {};
        if (!report[examTitle][rankName]) {
            report[examTitle][rankName] = {
                members: [],
                stats: { total: 0, passed: 0, failed: 0, avgScore: 0, totalScore: 0 }
            };
        }

        const group = report[examTitle][rankName];
        // Compute pass/fail live from score vs passMark (avoids relying on stale `passed` column)
        const didPass = a.score !== null && a.exams?.passMark !== undefined
            ? a.score >= a.exams.passMark
            : (a.passed ?? false);

        group.members.push({
            attemptId: a.id,
            name: `${a.users.firstName} ${a.users.lastName}`,
            raNumber: a.users.raNumber,
            score: a.score,
            passed: didPass,
            date: a.submittedAt
        });

        group.stats.total++;
        if (didPass) group.stats.passed++;
        else group.stats.failed++;
        group.stats.totalScore += (a.score || 0);
        group.stats.avgScore = Math.round(group.stats.totalScore / group.stats.total);
    });

    res.status(200).json({ status: 'success', data: { report } });
});
