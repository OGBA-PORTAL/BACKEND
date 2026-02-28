-- Phase 4: Schema Alignment
-- Add missing columns identified during audit

-- 1. Add questionCount to exams table (Required for randomization logic)
ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "questionCount" INTEGER DEFAULT 20;
