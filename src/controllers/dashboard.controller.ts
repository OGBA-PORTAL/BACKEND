import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase.js';
import { catchAsync } from '../utils/catchAsync.js';
import { AppError } from '../utils/AppError.js';

export const getDashboardStats = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // Parallel fetching for performance
    const [
        { count: raCount },
        { count: churchAdminCount },
        { count: churchCount },
        { count: examCount },
        { count: attemptCount },
        { data: rankBreakdownData }
    ] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'RA'),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'CHURCH_ADMIN'),
        supabase.from('churches').select('*', { count: 'exact', head: true }),
        supabase.from('exams').select('*', { count: 'exact', head: true }).eq('status', 'PUBLISHED'),
        supabase.from('exam_attempts').select('*', { count: 'exact', head: true }).eq('status', 'SUBMITTED'),
        supabase.from('users').select('rankId, ranks:rankId(id, name, level)').eq('role', 'RA').not('rankId', 'is', null)
    ]);

    // Build rank breakdown: group RA users by rank
    const rankMap: Record<string, { id: string; name: string; level: number; count: number }> = {};
    (rankBreakdownData || []).forEach((u: any) => {
        if (u.ranks) {
            const r = u.ranks;
            if (!rankMap[r.id]) rankMap[r.id] = { id: r.id, name: r.name, level: r.level, count: 0 };
            rankMap[r.id].count++;
        }
    });
    const rankBreakdown = Object.values(rankMap).sort((a, b) => a.level - b.level);

    res.status(200).json({
        status: 'success',
        data: {
            totalRAs: raCount || 0,
            totalChurchAdmins: churchAdminCount || 0,
            totalMembers: (raCount || 0) + (churchAdminCount || 0),
            totalChurches: churchCount || 0,
            activeExams: examCount || 0,
            examsTaken: attemptCount || 0,
            rankBreakdown
        }
    });
});
