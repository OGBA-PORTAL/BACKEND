import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase.js';
import { catchAsync } from '../utils/catchAsync.js';
import { AppError } from '../utils/AppError.js';

export const listChurches = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { data: churches, error } = await supabase
        .from('churches')
        .select('*')
        .order('name', { ascending: true });

    if (error) {
        throw new AppError(error.message, 500);
    }

    res.status(200).json({
        status: 'success',
        results: churches.length,
        data: {
            churches,
        },
    });
});

export const createChurch = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { name, code, phone } = req.body;

    // Ideally, restrict this to ASSOCIATION_OFFICER or ADMIN

    const { data: newChurch, error } = await supabase
        .from('churches')
        .insert({ name, code, phone })
        .select()
        .single();

    if (error) {
        throw new AppError(error.message, 400); // 400 for duplicate code likely
    }

    res.status(201).json({
        status: 'success',
        data: {
            church: newChurch,
        },
    });
});
