-- Create Enums
CREATE TYPE "Role" AS ENUM ('RA', 'CHURCH_ADMIN', 'ASSOCIATION_OFFICER', 'SYSTEM_ADMIN');
CREATE TYPE "AccountStatus" AS ENUM ('PENDING_ACTIVATION', 'ACTIVE', 'SUSPENDED');

-- Create Tables

-- Churches Table
CREATE TABLE "churches" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" TEXT UNIQUE NOT NULL, -- The "CCC" in RA number
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ranks Table
CREATE TABLE "ranks" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT UNIQUE NOT NULL, -- e.g., "Assistant Intern"
  "level" INTEGER UNIQUE NOT NULL, -- For ordering: 1, 2, 3...
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Users Table
CREATE TABLE "users" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "raNumber" TEXT UNIQUE NOT NULL,
  "password" TEXT NOT NULL, -- Hashed
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  
  "role" "Role" NOT NULL DEFAULT 'RA',
  "status" "AccountStatus" NOT NULL DEFAULT 'PENDING_ACTIVATION',
  
  -- Relations
  "churchId" UUID REFERENCES "churches"("id") ON DELETE SET NULL,
  "rankId" UUID REFERENCES "ranks"("id") ON DELETE SET NULL,
  
  "passwordChangedAt" TIMESTAMPTZ, -- Timestamp for when password was last changed
  
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Exams Table
CREATE TABLE "exams" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" TEXT NOT NULL,
  
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create UpdatedAt Trigger Function to automatically update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply Triggers
CREATE TRIGGER update_churches_updated_at BEFORE UPDATE ON "churches" FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_ranks_updated_at BEFORE UPDATE ON "ranks" FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON "users" FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_exams_updated_at BEFORE UPDATE ON "exams" FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
