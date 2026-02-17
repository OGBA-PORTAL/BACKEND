# Supabase Setup Guide

## Step 1: Create Supabase Account
1. Go to https://supabase.com
2. Click "Start your project"
3. Sign up with GitHub (recommended) or email

## Step 2: Create New Project
1. Click "New Project"
2. Fill in:
   - **Name**: `ogba-portal` (or your choice)
   - **Database Password**: Generate a strong password (SAVE THIS!)
   - **Region**: Choose closest to your users
3. Click "Create new project" (takes ~2 minutes)

## Step 3: Get Connection String
1. In your project dashboard, click "Project Settings" (gear icon)
2. Go to "Database" tab
3. Scroll to "Connection string" section
4. Select "URI" tab
5. Copy the connection string (looks like: `postgresql://postgres:[YOUR-PASSWORD]@...`)
6. Replace `[YOUR-PASSWORD]` with the password you created in Step 2

## Step 4: Update .env File
Paste your connection string into `.env`:

```
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres"
```

## Step 5: Run Database Schema
1. Go to your Supabase project dashboard.
2. Click on the **SQL Editor** icon in the left sidebar.
3. Click "New query".
4. Copy the contents of `supabase_schema.sql` and paste them into the SQL editor.
5. Click **Run** to create your tables and enums.

---

**Ready to proceed?** Let me know when you've completed Steps 1-4, and I'll help you run the migration.
