import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase.js';
import { catchAsync } from '../utils/catchAsync.js';
import { AppError } from '../utils/AppError.js';
import bcrypt from 'bcrypt';

// GET /users/me
export const getMe = (req: Request, res: Response) => {
    req.user.password = undefined;
    res.status(200).json({
        status: 'success',
        data: { user: req.user },
    });
};

// PATCH /users/me
export const updateMe = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { firstName, lastName } = req.body;

    const { data: updated, error } = await supabase
        .from('users')
        .update({ firstName, lastName })
        .eq('id', req.user.id)
        .select('id, raNumber, firstName, lastName, role, status, churchId, rankId')
        .single();

    if (error) return next(new AppError(error.message, 500));

    res.status(200).json({
        status: 'success',
        data: { user: updated },
    });
});

// PATCH /users/me/password
export const changeMyPassword = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { currentPassword, newPassword } = req.body;

    // Fetch user with password
    const { data: user, error } = await supabase
        .from('users')
        .select('id, password')
        .eq('id', req.user.id)
        .single();

    if (error || !user) return next(new AppError('User not found', 404));

    // Verify current password
    const isCorrect = await bcrypt.compare(currentPassword, user.password);
    if (!isCorrect) return next(new AppError('Current password is incorrect', 401));

    // Hash new password
    const hashed = await bcrypt.hash(newPassword, 12);

    const { error: updateError } = await supabase
        .from('users')
        .update({ password: hashed })
        .eq('id', req.user.id);

    if (updateError) return next(new AppError(updateError.message, 500));

    res.status(200).json({ status: 'success', message: 'Password updated successfully' });
});

// GET /users — Admin: list all users (Scoped by Role)
export const getAllUsers = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    let query = supabase
        .from('users')
        .select(`
            id, raNumber, firstName, lastName, role, status, churchId, rankId, createdAt,
            churches (id, name, code),
            ranks (id, name, level)
        `)
        .order('createdAt', { ascending: false });

    // 1. Church Admin: Strict Local Scope
    if (req.user.role === 'CHURCH_ADMIN') {
        query = query.eq('churchId', req.user.churchId);
        // Optional: Hide anyone who isn't RA or CHURCH_ADMIN if they ever get added to this church
        query = query.in('role', ['RA', 'CHURCH_ADMIN']);
    }

    // 2. Association Officer: Zone Scope (exclude System Admins)
    if (req.user.role === 'ASSOCIATION_OFFICER') {
        // Can see Peers (Assoc), Church Admins, and RAs. Hides System Admin.
        query = query.neq('role', 'SYSTEM_ADMIN');
    }

    // 3. System Admin: Global Scope (Sees everyone)

    const { data: users, error } = await query;

    if (error) {
        console.error('Error fetching users:', error);
        return next(new AppError(error.message, 500));
    }

    res.status(200).json({
        status: 'success',
        results: users.length,
        data: { users },
    });
});

// PATCH /users/:id/status — Admin: activate or suspend
export const updateUserStatus = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!['ACTIVE', 'SUSPENDED', 'PENDING_ACTIVATION'].includes(status)) {
        return next(new AppError('Invalid status value', 400));
    }

    if (id === req.user.id) {
        return next(new AppError('You cannot change your own status', 403));
    }

    // Prevent non-System Admins from modifying System Admins
    if (req.user.role !== 'SYSTEM_ADMIN') {
        const { data: targetUser } = await supabase.from('users').select('role').eq('id', id).single();
        if (targetUser && targetUser.role === 'SYSTEM_ADMIN') {
            return next(new AppError('You do not have permission to modify a System Admin', 403));
        }
    }

    const { data: updated, error } = await supabase
        .from('users')
        .update({ status })
        .eq('id', id)
        .select('id, raNumber, firstName, lastName, status')
        .single();

    if (error) return next(new AppError(error.message, 500));

    res.status(200).json({
        status: 'success',
        data: { user: updated },
    });
});
