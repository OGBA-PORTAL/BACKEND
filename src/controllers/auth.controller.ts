import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { catchAsync } from '../utils/catchAsync.js';
import { AppError } from '../utils/AppError.js';
import { authService } from '../services/auth.service.js';
import { env } from '../config/env.js';

const signToken = (id: string) => {
    return jwt.sign({ id }, env.JWT_SECRET, {
        expiresIn: '90d', // 90 days for now
    });
};

const createSendToken = (user: any, statusCode: number, res: Response) => {
    const token = signToken(user.id);

    const cookieOptions = {
        expires: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
    };

    res.cookie('jwt', token, cookieOptions);

    // Remove password from output
    user.password = undefined;

    res.status(statusCode).json({
        status: 'success',
        token,
        data: {
            user,
        },
    });
};

export const signup = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // Enforce Church Scope for Church Admins
    if (req.user && req.user.role === 'CHURCH_ADMIN') {
        if (req.body.churchId && req.body.churchId !== req.user.churchId) {
            return next(new AppError('Church Admins can only register users for their own church', 403));
        }
        // Force their church ID and lock role to RA — Church Admins cannot create elevated accounts
        req.body.churchId = req.user.churchId;
        req.body.role = 'RA';
    }

    // Enforce Rank for RAs (if not creating an Admin)
    // Assuming this endpoint is mostly for creating RAs.
    // If the role being created is RA (default), rankId should be present.
    // For now, we don't strictly enforce it here to allow flexibility, but it SHOULD be sent.

    const newUser = await authService.signup(req.body);
    createSendToken(newUser, 201, res);
});

export const login = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { raNumber, password } = req.body;
    const user = await authService.login(raNumber, password);
    createSendToken(user, 200, res);
});

export const logout = (req: Request, res: Response) => {
    res.cookie('jwt', 'loggedout', {
        expires: new Date(Date.now() + 10 * 1000),
        httpOnly: true,
    });
    res.status(200).json({ status: 'success' });
};
