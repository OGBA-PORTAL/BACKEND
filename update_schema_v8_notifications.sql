-- Phase 5: Notification System
-- Add notifications table for tracking generic user alerts

CREATE TABLE IF NOT EXISTS "notifications" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "type" VARCHAR(50) DEFAULT 'INFO',
    "read" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexing for quick retrieval of unread alerts per user
CREATE INDEX IF NOT EXISTS "idx_notifications_user_id" ON "notifications"("userId");
CREATE INDEX IF NOT EXISTS "idx_notifications_read" ON "notifications"("read");

-- RLS Enablement
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;

-- Select policies: Users can only see their own notifications
CREATE POLICY "Users can read own notifications" ON "notifications"
    FOR SELECT USING (auth.uid() = "userId");

-- Update policies: Users can only mark their own notifications as read
CREATE POLICY "Users can update own notifications" ON "notifications"
    FOR UPDATE USING (auth.uid() = "userId");
