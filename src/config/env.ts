import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.string().transform((val) => parseInt(val, 10)).default(3000),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    JWT_SECRET: z.string().min(10, 'JWT_SECRET must be at least 10 characters'),
    COOKIE_SECRET: z.string().min(10, 'COOKIE_SECRET must be at least 10 characters'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
    console.error('❌ Invalid environment variables:', JSON.stringify(parsedEnv.error.format(), null, 2));
    process.exit(1);
}

export const env = parsedEnv.data;
