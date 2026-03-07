import { Request, Response, NextFunction } from 'express';
import { promisify } from 'util';
import jwt from 'jsonwebtoken';
import { AppError } from '../utils/AppError.js';
import { catchAsync } from '../utils/catchAsync.js';
import { env } from '../config/env.js';
import { supabase } from '../config/supabase.js';

export const protect = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // 1) Getting token and check of it's there
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies.jwt) {
        token = req.cookies.jwt;
    }

    if (!token) {
        return next(new AppError('You are not logged in! Please log in to get access.', 401));
    }

    // 2) Verification token
    // @ts-ignore
    const decoded = await promisify(jwt.verify)(token, env.JWT_SECRET);

    // 3) Check if user still exists
    const { data: currentUser, error } = await supabase
        .from('users')
        .select('*, churches(name, code), ranks(name, level)')
        .eq('id', (decoded as any).id)
        .single();

    if (error || !currentUser) {
        return next(new AppError('The user belonging to this token no longer does exist.', 401));
    }

    if (currentUser.status === 'SUSPENDED') {
        return next(new AppError('Your account has been suspended. Please contact the administration.', 401));
    }

    // 4) Check if user changed password after the token was issued
    if (currentUser.passwordChangedAt) {
        const changedTimestamp = parseInt(
            (new Date(currentUser.passwordChangedAt).getTime() / 1000).toString(),
            10
        );

        // decoded.iat is in seconds
        if ((decoded as any).iat < changedTimestamp) {
            return next(new AppError('User recently changed password! Please log in again.', 401));
        }
    }

    // GRANT ACCESS TO PROTECTED ROUTE
    req.user = currentUser;
    next();
});

export const restrictTo = (...roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        // roles ['admin', 'lead-guide']. role='user'
        if (!roles.includes(req.user.role)) {
            return next(new AppError('You do not have permission to perform this action', 403));
        }

        next();
    };
};
