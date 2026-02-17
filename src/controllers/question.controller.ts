import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase.js';
import { catchAsync } from '../utils/catchAsync.js';
import { AppError } from '../utils/AppError.js';

// 1. Add Question
export const addQuestion = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { examId, text, type, options, correctOption, points } = req.body;

    // Validate correctOption index
    if (type === 'MCQ' && (correctOption < 0 || correctOption >= options.length)) {
        return next(new AppError('Invalid correctOption index', 400));
    }

    const { data: question, error } = await supabase
        .from('questions')
        .insert({
            examId,
            text,
            type: type || 'MCQ',
            options, // ["A", "B", "C"]
            correctOption,
            points: points || 1
        })
        .select()
        .single();

    if (error) return next(new AppError(error.message, 500));

    res.status(201).json({
        status: 'success',
        data: { question }
    });
});

// 2. Get Questions for Exam (Admin View)
export const getExamQuestions = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { examId } = req.params;

    const { data: questions, error } = await supabase
        .from('questions')
        .select('*')
        .eq('examId', examId)
        .order('createdAt', { ascending: true });

    if (error) return next(new AppError(error.message, 500));

    res.status(200).json({
        status: 'success',
        results: questions.length,
        data: { questions }
    });
});

// 3. Delete Question
export const deleteQuestion = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const { error } = await supabase
        .from('questions')
        .delete()
        .eq('id', id);

    if (error) return next(new AppError(error.message, 500));

    res.status(204).json({
        status: 'success',
        data: null
    });
});
