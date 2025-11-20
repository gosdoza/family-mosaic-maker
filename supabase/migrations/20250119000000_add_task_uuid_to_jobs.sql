-- Migration: Add task_uuid column to jobs table
-- Version: Identity Flow Fix
-- Created: 2025-01-19
-- Description: 添加 task_uuid 欄位到 jobs 表，用於直接查詢 Runware API

-- ============================================================================
-- Add task_uuid column to jobs table
-- ============================================================================

ALTER TABLE IF EXISTS public.jobs
ADD COLUMN IF NOT EXISTS task_uuid text;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_jobs_task_uuid ON public.jobs(task_uuid);

-- Add comment
COMMENT ON COLUMN public.jobs.task_uuid IS 'Runware taskUUID (without rw_ prefix), used for querying Runware API directly';

