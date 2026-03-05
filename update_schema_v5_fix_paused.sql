-- Run this in your Supabase SQL Editor to add the PAUSED status
ALTER TYPE "ExamStatus" ADD VALUE IF NOT EXISTS 'PAUSED';
