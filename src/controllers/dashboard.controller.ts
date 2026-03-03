import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase.js';
import { catchAsync } from '../utils/catchAsync.js';
import { AppError } from '../utils/AppError.js';

export const getDashboardStats = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // Parallel fetching for performance
    const [
        { count: userCount },
        { count: churchCount },
        { count: examCount },
        { count: attemptCount }
    ] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'RA'),
        supabase.from('churches').select('*', { count: 'exact', head: true }),
        supabase.from('exams').select('*', { count: 'exact', head: true }).eq('status', 'PUBLISHED'),
        supabase.from('exam_attempts').select('*', { count: 'exact', head: true }).eq('status', 'SUBMITTED')
    ]);

    // Calculate Pass Rate? (Requires full scan, maybe skip for now or do simplified query)
    // For MVp, let's just show counts.

    res.status(200).json({
        status: 'success',
        data: {
            totalRAs: userCount || 0,
            totalChurches: churchCount || 0,
            activeExams: examCount || 0,
            examsTaken: attemptCount || 0
        }
    });
});
