import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase.js';
import { AppError } from '../utils/AppError.js';
import { catchAsync } from '../utils/catchAsync.js';

// GET /notifications
// Retrieve a user's chronological alerts
export const getUserNotifications = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id: userId } = req.user;

    const { data: notifications, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('userId', userId)
        .order('createdAt', { ascending: false })
        .limit(20);

    if (error) return next(new AppError(error.message, 500));

    res.status(200).json({
        status: 'success',
        results: notifications?.length || 0,
        data: { notifications }
    });
});

// PATCH /notifications/:id/read
// Mark a singular notification as read
export const markAsRead = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { id: userId } = req.user;

    // Safety: Ensure users only mark their own items read
    const { data, error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id)
        .eq('userId', userId)
        .select('*')
        .single();

    if (error) return next(new AppError(error.message, 500));
    if (!data) return next(new AppError('Notification not found or unauthorized', 404));

    res.status(200).json({
        status: 'success',
        data: { notification: data }
    });
});

// PATCH /notifications/read-all
// Mark all unread notifications for a user as read
export const markAllAsRead = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id: userId } = req.user;

    const { data, error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('userId', userId)
        .eq('read', false)
        .select('*');

    if (error) return next(new AppError(error.message, 500));

    res.status(200).json({
        status: 'success',
        message: 'All notifications marked as read',
        data: { updatedCount: data?.length || 0 }
    });
});

// POST /notifications
// Internal/Admin use to dispatch alerts
export const createNotification = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { userId, title, message, type } = req.body;

    if (!userId || !title || !message) {
        return next(new AppError('userId, title, and message are required', 400));
    }

    const { data, error } = await supabase
        .from('notifications')
        .insert([{ userId, title, message, type: type || 'INFO' }])
        .select('*')
        .single();

    if (error) return next(new AppError(error.message, 500));

    res.status(201).json({
        status: 'success',
        data: { notification: data }
    });
});
