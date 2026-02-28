import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase.js';
import { catchAsync } from '../utils/catchAsync.js';
import { AppError } from '../utils/AppError.js';

// 1. Add Question to Exam
// Frontend sends: { text, options: {A,B,C,D}, correctAnswer: 'A'|'B'|'C'|'D', marks }
export const addQuestion = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { examId } = req.params;
    const { text, options, correctAnswer, points } = req.body;

    if (!text || !options || !correctAnswer) {
        return next(new AppError('text, options, and correctAnswer are required', 400));
    }

    // Map 'A', 'B', 'C', 'D' to 0, 1, 2, 3
    const optionMap: { [key: string]: number } = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
    const correctOptionIndex = optionMap[correctAnswer];

    if (correctOptionIndex === undefined) {
        return next(new AppError('Invalid correctAnswer. Must be A, B, C, or D', 400));
    }

    // Convert options object {A: "...", B: "..."} to array ["...", "..."]
    // Ensure order A, B, C, D
    const optionsArray = [options.A, options.B, options.C, options.D];

    const { data: question, error } = await supabase
        .from('questions')
        .insert({
            examId,
            text,
            options: JSON.stringify(optionsArray), // stored as JSONB array
            correctOption: correctOptionIndex,
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

export const batchAddQuestions = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { examId } = req.params;
    const { questions } = req.body;

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
        return next(new AppError('questions array is required', 400));
    }

    const optionMap: { [key: string]: number } = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

    const toInsert = questions.map((q: any) => {
        const optionsArray = [q.options.A, q.options.B, q.options.C, q.options.D];
        const correctIndex = optionMap[q.correctAnswer];
        return {
            examId,
            text: q.text,
            options: JSON.stringify(optionsArray),
            correctOption: correctIndex !== undefined ? correctIndex : 0,
            points: q.points || 1
        };
    });

    const { data, error } = await supabase.from('questions').insert(toInsert).select();

    if (error) return next(new AppError(error.message, 500));

    res.status(201).json({ status: 'success', count: data.length });
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

    res.status(204).json({ status: 'success', data: null });
});
