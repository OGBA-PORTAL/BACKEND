import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase.js';
import { catchAsync } from '../utils/catchAsync.js';
import { AppError } from '../utils/AppError.js';

export const listRanks = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { data: ranks, error } = await supabase
        .from('ranks')
        .select('*')
        .order('level', { ascending: true }); // Order by level (1, 2, 3...)

    if (error) {
        throw new AppError(error.message, 500);
    }

    res.status(200).json({
        status: 'success',
        results: ranks.length,
        data: {
            ranks,
        },
    });
});
