import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase.js';
import { catchAsync } from '../utils/catchAsync.js';
import { AppError } from '../utils/AppError.js';

// 1. Create Exam (Bank)
export const createExam = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // Only Admin/Assoc can create
    const { title, rankId, duration, passMark, questionCount, description, examDate } = req.body;

    const { data: newExam, error } = await supabase
        .from('exams')
        .insert({
            title,
            rankId,
            duration,
            passMark,
            questionCount: questionCount || 50, // Default 50
            description,
            examDate,
            createdBy: req.user.id,
            status: 'DRAFT'
        })
        .select()
        .single();

    if (error) return next(new AppError(error.message, 500));

    res.status(201).json({
        status: 'success',
        data: { exam: newExam }
    });
});

// 2. Publish Exam (Validate Question Count)
export const publishExam = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    // Check current exam details
    const { data: exam, error: fetchError } = await supabase
        .from('exams')
        .select('*, questions(count)')
        .eq('id', id)
        .single();

    if (fetchError || !exam) return next(new AppError('Exam not found', 404));

    // Count questions
    const { count, error: countError } = await supabase
        .from('questions')
        .select('*', { count: 'exact', head: true })
        .eq('examId', id);

    if (countError) return next(new AppError(countError.message, 500));

    // Validate
    if ((count || 0) < (exam.questionCount || 50)) {
        return next(new AppError(`Cannot publish! Exam has ${count} questions, but requires ${exam.questionCount || 50}.`, 400));
    }

    // Update Access Code ?? Maybe optional.
    // Update status
    const { data: updated, error: updateError } = await supabase
        .from('exams')
        .update({ status: 'PUBLISHED' })
        .eq('id', id)
        .select()
        .single();

    if (updateError) return next(new AppError(updateError.message, 500));

    res.status(200).json({
        status: 'success',
        data: { exam: updated }
    });
});

// 3. Get All Exams (Admin View)
export const getAllExams = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { data: exams, error } = await supabase
        .from('exams')
        .select('*, ranks(name), questions(count)')
        .order('createdAt', { ascending: false });

    if (error) return next(new AppError(error.message, 500));

    res.status(200).json({
        status: 'success',
        results: exams.length,
        data: { exams }
    });
});

// 4. Get Single Exam (Admin View)
export const getExam = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { data: exam, error } = await supabase
        .from('exams')
        .select('*, ranks(name)')
        .eq('id', id)
        .single();

    if (error) return next(new AppError('Exam not found', 404));

    res.status(200).json({
        status: 'success',
        data: { exam }
    });
});
