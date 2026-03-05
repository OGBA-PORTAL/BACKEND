-- Add a column to track who last updated a user's status to enforce hierarchy
ALTER TABLE "public"."users" ADD COLUMN IF NOT EXISTS "status_updated_by" uuid REFERENCES "public"."users"("id") ON DELETE SET NULL;
