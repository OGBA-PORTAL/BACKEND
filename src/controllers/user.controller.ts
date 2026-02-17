import { Request, Response, NextFunction } from 'express';
import { catchAsync } from '../utils/catchAsync.js';

export const getMe = (req: Request, res: Response, next: NextFunction) => {
    req.user.password = undefined; // Ensure password is not sent
    res.status(200).json({
        status: 'success',
        data: {
            user: req.user,
        },
    });
};
