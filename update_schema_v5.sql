-- Phase 3.1: Randomized Exams

-- 1. Add 'questionCount' to exams (default 50)
-- This tells the system how many questions to pick from the pool for each student
ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "questionCount" INTEGER DEFAULT 50;

-- 2. Add 'questions' array to attempts
-- To store the exact IDs of the random questions served to this student (in order)
ALTER TABLE "exam_attempts" ADD COLUMN IF NOT EXISTS "questions" JSONB DEFAULT '[]';
