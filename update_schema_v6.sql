-- Phase 4: Results, Reporting & Audit Logs

-- 1. Add 'resultsReleased' to exams
-- This flag controls whether students can see their score/grade.
-- Default is FALSE (Scores are hidden until Admin releases them).
ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "resultsReleased" BOOLEAN DEFAULT FALSE;

-- 2. Create Audit Logs Table
-- Tracks critical actions for security and accountability.
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID REFERENCES "users"("id") ON DELETE SET NULL, -- Who did it?
  "action" TEXT NOT NULL, -- e.g. "CREATE_EXAM", "RELEASE_RESULTS"
  "resource" TEXT NOT NULL, -- e.g. "exams", "users"
  "resourceId" UUID, -- ID of the item affected
  "details" JSONB DEFAULT '{}', -- Extra info (e.g. diff)
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for faster querying of logs
CREATE INDEX IF NOT EXISTS "audit_logs_user_idx" ON "audit_logs"("userId");
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs"("action");
