import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase.js';
import { catchAsync } from '../utils/catchAsync.js';
import { AppError } from '../utils/AppError.js';

// 1. Create Exam
export const createExam = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { title, rankId, duration, passMark, questionCount, description, examDate } = req.body;

    const { data: newExam, error } = await supabase
        .from('exams')
        .insert({
            title,
            rankId,
            duration,
            passMark,
            questionCount: questionCount || 50,
            description,
            examDate,
            createdBy: req.user.id,
            status: 'DRAFT'
        })
        .select('*, ranks(id, name, level)')
        .single();

    if (error) return next(new AppError(error.message, 500));

    res.status(201).json({
        status: 'success',
        data: { exam: newExam }
    });
});

// 2. Publish Exam (validate question count)
export const publishExam = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const { count, error: countError } = await supabase
        .from('questions')
        .select('*', { count: 'exact', head: true })
        .eq('examId', id);

    if (countError) return next(new AppError(countError.message, 500));

    const { data: exam } = await supabase.from('exams').select('questionCount').eq('id', id).single();
    if (!exam) return next(new AppError('Exam not found', 404));

    if ((count || 0) < (exam.questionCount || 50)) {
        return next(new AppError(`Cannot publish! Exam has ${count} questions but requires ${exam.questionCount}.`, 400));
    }

    const { data: updated, error: updateError } = await supabase
        .from('exams')
        .update({ status: 'PUBLISHED' })
        .eq('id', id)
        .select('*, ranks(id, name, level)')
        .single();

    if (updateError) return next(new AppError(updateError.message, 500));

    res.status(200).json({ status: 'success', data: { exam: updated } });
});

// 3. Update Exam Status (PATCH /exams/:id/status)
export const updateExamStatus = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!['DRAFT', 'PUBLISHED', 'COMPLETED'].includes(status)) {
        return next(new AppError('Invalid status', 400));
    }

    // If publishing, validate question count
    if (status === 'PUBLISHED') {
        const { count } = await supabase
            .from('questions')
            .select('*', { count: 'exact', head: true })
            .eq('examId', id);

        const { data: exam } = await supabase.from('exams').select('questionCount').eq('id', id).single();
        if (exam && (count || 0) < (exam.questionCount || 1)) {
            return next(new AppError(`Cannot publish! Exam has ${count} questions but requires ${exam.questionCount}.`, 400));
        }
    }

    const { data: updated, error } = await supabase
        .from('exams')
        .update({ status })
        .eq('id', id)
        .select('*, ranks(id, name, level)')
        .single();

    if (error) return next(new AppError(error.message, 500));

    res.status(200).json({ status: 'success', data: { exam: updated } });
});

// 4. Release Results for a specific exam (PATCH /exams/:id/release)
export const releaseExamResults = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const { data: updated, error } = await supabase
        .from('exams')
        .update({ resultsReleased: true })
        .eq('id', id)
        .select('*, ranks(id, name, level)')
        .single();

    if (error) return next(new AppError(error.message, 500));

    res.status(200).json({ status: 'success', data: { exam: updated } });
});

// 5. Get All Exams (Admin View)
export const getAllExams = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { data: exams, error } = await supabase
        .from('exams')
        .select('*, ranks(id, name, level)')
        .order('createdAt', { ascending: false });

    if (error) return next(new AppError(error.message, 500));

    res.status(200).json({
        status: 'success',
        results: exams.length,
        data: { exams }
    });
});

// 6. Get Published Exams (Student View)
export const getPublishedExams = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { data: exams, error } = await supabase
        .from('exams')
        .select('*, ranks(id, name, level)')
        .eq('status', 'PUBLISHED')
        .order('createdAt', { ascending: false });

    if (error) return next(new AppError(error.message, 500));

    res.status(200).json({
        status: 'success',
        results: exams.length,
        data: { exams }
    });
});

// 7. Get Single Exam
export const getExam = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { data: exam, error } = await supabase
        .from('exams')
        .select('*, ranks(id, name, level)')
        .eq('id', id)
        .single();

    if (error) return next(new AppError('Exam not found', 404));

    res.status(200).json({ status: 'success', data: { exam } });
});
