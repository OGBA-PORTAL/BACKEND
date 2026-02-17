-- Phase 3: Exam Engine & Ranks

-- 1. Create Enums for Exam Logic
-- Drop if they exist to avoid errors
DROP TYPE IF EXISTS "ExamStatus" CASCADE;
DROP TYPE IF EXISTS "QuestionType" CASCADE;
DROP TYPE IF EXISTS "AttemptStatus" CASCADE;

CREATE TYPE "ExamStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'COMPLETED');
CREATE TYPE "QuestionType" AS ENUM ('MCQ', 'THEORY');
CREATE TYPE "AttemptStatus" AS ENUM ('STARTED', 'SUBMITTED', 'GRADED');

-- 2. Create Exams Table
-- Drop tables to ensure clean slate (safe as no real exam data yet)
DROP TABLE IF EXISTS "exam_attempts" CASCADE;
DROP TABLE IF EXISTS "questions" CASCADE;
DROP TABLE IF EXISTS "exams" CASCADE;

CREATE TABLE "exams" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" TEXT NOT NULL,
  "description" TEXT,
  "rankId" UUID REFERENCES "ranks"("id") ON DELETE SET NULL, -- Who is this exam for?
  "duration" INTEGER NOT NULL DEFAULT 60, -- Minutes
  "passMark" INTEGER NOT NULL DEFAULT 50, -- Percentage
  "status" "ExamStatus" NOT NULL DEFAULT 'DRAFT',
  "examDate" TIMESTAMPTZ, -- When it is scheduled
  "createdBy" UUID REFERENCES "users"("id") ON DELETE SET NULL, -- Audit
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create Questions Table
CREATE TABLE "questions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "examId" UUID REFERENCES "exams"("id") ON DELETE CASCADE, -- If exam deleted, questions gone
  "text" TEXT NOT NULL,
  "type" "QuestionType" NOT NULL DEFAULT 'MCQ',
  "options" JSONB NOT NULL DEFAULT '[]', -- Array of strings ["Option A", "Option B", ...]
  "correctOption" INTEGER, -- Index of correct answer (0, 1, 2, 3)
  "points" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Create Exam Attempts Table
CREATE TABLE "exam_attempts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID REFERENCES "users"("id") ON DELETE CASCADE,
  "examId" UUID REFERENCES "exams"("id") ON DELETE CASCADE,
  "score" INTEGER DEFAULT 0,
  "totalPoints" INTEGER DEFAULT 0,
  "status" "AttemptStatus" NOT NULL DEFAULT 'STARTED',
  "startedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "submittedAt" TIMESTAMPTZ,
  "answers" JSONB DEFAULT '{}', -- Store student choices { "questionId": selectedOptionIndex }
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Add Triggers for UpdatedAt
CREATE TRIGGER update_exams_updated_at BEFORE UPDATE ON "exams" FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_exam_attempts_updated_at BEFORE UPDATE ON "exam_attempts" FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
