import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import churchRoutes from './routes/church.routes.js';
import rankRoutes from './routes/rank.routes.js';
import examRoutes from './routes/exam.routes.js';
import resultRoutes from './routes/result.routes.js';
import reportRoutes from './routes/report.routes.js'; // NEW
import notificationRoutes from './routes/notification.routes.js'; // Notifications
import { AppError } from './utils/AppError.js';

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
    origin: env.NODE_ENV === 'production'
        ? [process.env.FRONTEND_URL || 'https://ogbafrontend.vercel.app']
        : '*', // Allow Vercel frontend in production
    credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(cookieParser(env.COOKIE_SECRET));

// Health Check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', env: env.NODE_ENV });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/churches', churchRoutes);
app.use('/api/ranks', rankRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/results', resultRoutes);
app.use('/api/reports', reportRoutes); // NEW

// 404 Handler
app.all(/(.*)/, (req, res, next) => {
    next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    res.status(err.statusCode).json({
        status: err.status,
        message: err.message,
        ...(env.NODE_ENV === 'development' && { stack: err.stack }),
    });
});

export default app;
