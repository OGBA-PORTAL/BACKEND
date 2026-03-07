import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase.js';
import { catchAsync } from '../utils/catchAsync.js';
import { AppError } from '../utils/AppError.js';
import bcrypt from 'bcrypt';
import { NotificationService } from '../services/notification.service.js';

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

const roleHierarchy: Record<string, number> = {
    'SYSTEM_ADMIN': 4,
    'ASSOCIATION_OFFICER': 3,
    'CHURCH_ADMIN': 2,
    'RA': 1
};

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

// PATCH /users/bulk-status — Admin: bulk update users status
export const bulkUpdateStatus = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { userIds, status } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
        return next(new AppError('No user IDs provided', 400));
    }

    if (!['ACTIVE', 'SUSPENDED'].includes(status)) {
        return next(new AppError('Invalid status value', 400));
    }

    const { data: targetUsers, error: fetchErr } = await supabase
        .from('users')
        .select('id, role, churchId, status_updated_by, status')
        .in('id', userIds);

    if (fetchErr) return next(new AppError(fetchErr.message, 500));

    const myRoleLevel = roleHierarchy[req.user.role];

    // Fetch updaters to enforce hierarchy locks (removed per user request to enable assoc admin updates)
    // ...

    // Filter down to the safe IDs
    const safeUserIds = targetUsers
        .filter(u => u.id !== req.user.id) // Prevent self
        .filter(u => u.status !== status) // ** Skip users already in the desired state **
        .filter(u => {
            // Cannot target higher or equal roles
            if (roleHierarchy[u.role] >= myRoleLevel) return false;
            return true;
        })
        .map(u => u.id);

    if (safeUserIds.length === 0) {
        return res.status(200).json({
            status: 'success',
            message: 'No safe targets found for status update (users are either already updated, system admins, or locked by higher admins).',
            data: { updatedCount: 0 }
        });
    }

    // Execute the bulk update for only safe IDs
    const { data: updated, error } = await supabase
        .from('users')
        .update({ status, status_updated_by: req.user.id })
        .in('id', safeUserIds)
        .select('id, status');

    if (error) return next(new AppError(error.message, 500));

    res.status(200).json({
        status: 'success',
        message: `Successfully ${status === 'ACTIVE' ? 'activated' : 'suspended'} ${safeUserIds.length} users.`,
        data: { updatedCount: safeUserIds.length, ignoredCount: userIds.length - safeUserIds.length }
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

    const { data: targetUser, error: fetchErr } = await supabase
        .from('users')
        .select('id, role, churchId, status_updated_by')
        .eq('id', id)
        .single();

    if (fetchErr || !targetUser) return next(new AppError('User not found', 404));

    const myRoleLevel = roleHierarchy[req.user.role];

    // Church admin scope check
    if (req.user.role === 'CHURCH_ADMIN' && targetUser.churchId !== req.user.churchId) {
        return next(new AppError('You can only update members of your own church', 403));
    }

    // Role hierarchy check
    if (roleHierarchy[targetUser.role] >= myRoleLevel) {
        return next(new AppError('You cannot update the status of this user role', 403));
    }

    const { data: updated, error } = await supabase
        .from('users')
        .update({ status, status_updated_by: req.user.id })
        .eq('id', id)
        .select('id, raNumber, firstName, lastName, status')
        .single();

    if (error) return next(new AppError(error.message, 500));

    const isSuspended = status === 'SUSPENDED';
    NotificationService.notifyUser({
        userId: id as string,
        title: isSuspended ? 'Account Suspended' : 'Account Activated',
        message: isSuspended ? 'Your account has been suspended by an administrator.' : 'Your account is now active.',
        type: isSuspended ? 'ALERT' : 'SUCCESS'
    });

    res.status(200).json({
        status: 'success',
        data: { user: updated },
    });
});

// DELETE /users/:id — Admin: permanently delete a user (with strict hierarchy)
export const deleteUser = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    if (id === req.user.id) {
        return next(new AppError('You cannot delete your own account', 403));
    }

    // Fetch the target user's role
    const { data: targetUser, error: fetchError } = await supabase
        .from('users')
        .select('id, raNumber, firstName, lastName, role')
        .eq('id', id)
        .single();

    if (fetchError || !targetUser) return next(new AppError('User not found', 404));

    const callerRole = req.user.role;
    const targetRole = targetUser.role;

    // Hierarchy enforcement
    const allowedDeletions: Record<string, string[]> = {
        SYSTEM_ADMIN: ['ASSOCIATION_OFFICER', 'CHURCH_ADMIN', 'RA'],
        ASSOCIATION_OFFICER: ['CHURCH_ADMIN', 'RA'],
        CHURCH_ADMIN: [],
    };

    const permitted = allowedDeletions[callerRole] ?? [];
    if (!permitted.includes(targetRole)) {
        return next(new AppError(`You do not have permission to delete a ${targetRole.replace(/_/g, ' ')}`, 403));
    }

    const { error: deleteError } = await supabase.from('users').delete().eq('id', id);
    if (deleteError) return next(new AppError(deleteError.message, 500));

    res.status(200).json({
        status: 'success',
        message: `Account for ${targetUser.firstName} ${targetUser.lastName} has been permanently deleted.`,
    });
});

// PATCH /users/:id/role — Admin: upgrade or downgrade a user's role
export const updateUserRole = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { role: newRole } = req.body;

    const validRoles = ['RA', 'CHURCH_ADMIN', 'ASSOCIATION_OFFICER'];
    if (!validRoles.includes(newRole)) {
        return next(new AppError('Invalid role. Cannot assign SYSTEM_ADMIN via this endpoint.', 400));
    }

    if (id === req.user.id) {
        return next(new AppError('You cannot change your own role', 403));
    }

    const { data: targetUser, error: fetchErr } = await supabase
        .from('users')
        .select('id, firstName, lastName, role')
        .eq('id', id)
        .single();

    if (fetchErr || !targetUser) return next(new AppError('User not found', 404));

    const callerRole = req.user.role;
    const currentRole = targetUser.role;

    // Roles each caller can manage
    const manageable: Record<string, string[]> = {
        SYSTEM_ADMIN: ['RA', 'CHURCH_ADMIN', 'ASSOCIATION_OFFICER'],
        ASSOCIATION_OFFICER: ['RA', 'CHURCH_ADMIN'],
        CHURCH_ADMIN: [],
    };

    const allowed = manageable[callerRole] ?? [];

    if (!allowed.includes(currentRole)) {
        return next(new AppError(`You cannot change the role of a ${currentRole.replace(/_/g, ' ')}`, 403));
    }
    if (!allowed.includes(newRole)) {
        return next(new AppError(`You cannot assign the role ${newRole.replace(/_/g, ' ')}`, 403));
    }

    const { data: updated, error } = await supabase
        .from('users')
        .update({ role: newRole })
        .eq('id', id)
        .select('id, raNumber, firstName, lastName, role')
        .single();

    if (error) return next(new AppError(error.message, 500));

    NotificationService.notifyUser({
        userId: id as string,
        title: 'Role Updated',
        message: `Your account role has been updated to ${newRole.replace(/_/g, ' ')}.`,
        type: 'INFO'
    });

    res.status(200).json({
        status: 'success',
        data: { user: updated },
    });
});

// PATCH /users/:id/admin — Admin: Update a member's Name and Rank
export const updateUserAdmin = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { firstName, lastName, rankId } = req.body;

    if (id === req.user.id) {
        return next(new AppError('Please use your own profile settings to update your information.', 400));
    }

    // Fetch the target user's role
    const { data: targetUser, error: fetchError } = await supabase
        .from('users')
        .select('id, role')
        .eq('id', id)
        .single();

    if (fetchError || !targetUser) return next(new AppError('User not found', 404));

    const callerRole = req.user.role;
    const targetRole = targetUser.role;

    // Hierarchy enforcement
    const manageable: Record<string, string[]> = {
        SYSTEM_ADMIN: ['RA', 'CHURCH_ADMIN', 'ASSOCIATION_OFFICER'],
        ASSOCIATION_OFFICER: ['RA', 'CHURCH_ADMIN'],
        CHURCH_ADMIN: [],
    };

    const permitted = manageable[callerRole] ?? [];
    if (!permitted.includes(targetRole)) {
        return next(new AppError(`You do not have permission to edit a ${targetRole.replace(/_/g, ' ')}'s profile`, 403));
    }

    // Build update payload
    const updateData: any = {};
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (rankId !== undefined) updateData.rankId = rankId;

    if (Object.keys(updateData).length === 0) {
        return res.status(200).json({ status: 'success', message: 'No changes provided.' });
    }

    const { data: updated, error: updateError } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', id)
        .select(`
            id, raNumber, firstName, lastName, role, status, churchId, rankId, createdAt,
            churches (id, name, code),
            ranks (id, name, level)
        `)
        .single();

    if (updateError) return next(new AppError(updateError.message, 500));

    NotificationService.notifyUser({
        userId: id as string,
        title: 'Profile Record Updated',
        message: 'Your registration details or rank were modified by an administrator.',
        type: 'INFO'
    });

    res.status(200).json({
        status: 'success',
        message: 'Profile updated successfully.',
        data: { user: updated }
    });
});
