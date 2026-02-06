import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env } from './config/env';

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
    origin: env.NODE_ENV === 'production' ? false : '*', // Strict CORS in production
    credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(cookieParser(env.COOKIE_SECRET));

// Health Check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', env: env.NODE_ENV });
});

// Routes (Placeholder)
// app.use('/api/auth', authRoutes);
// app.use('/api/users', userRoutes);

export default app;
