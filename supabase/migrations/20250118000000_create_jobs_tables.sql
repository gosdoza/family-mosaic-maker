-- Migration: Create jobs and job_images tables for Runware integration
-- Version: R2
-- Created: 2025-01-18
-- Description: 建立 jobs 和 job_images 表，用於存儲 Runware 生成任務和結果圖片

-- ============================================================================
-- 1. jobs - 任務表
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id text NOT NULL UNIQUE, -- 對外顯示用的 jobId（例如 rw_xxx 或 taskUUID）
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  provider text NOT NULL DEFAULT 'runware' CHECK (provider IN ('runware', 'mock')),
  progress integer NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jobs_job_id ON public.jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON public.jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_provider ON public.jobs(provider);

-- ============================================================================
-- 2. job_images - 任務圖片表
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.job_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id text NOT NULL, -- 對應 jobs.job_id（不使用外鍵，因為 job_id 是 text）
  image_url text NOT NULL,
  thumbnail_url text, -- 可先同 image_url
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_images_job_id ON public.job_images(job_id);

-- ============================================================================
-- 3. Row Level Security (RLS)
-- ============================================================================

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_images ENABLE ROW LEVEL SECURITY;

-- Jobs policies: Users can view their own jobs, service role can insert/update
DO $$
BEGIN
  -- Jobs: Users can view their own jobs
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'jobs' AND policyname = 'jobs_select_own'
  ) THEN
    CREATE POLICY "jobs_select_own" ON public.jobs
      FOR SELECT
      USING (auth.uid() = user_id OR user_id IS NULL);
  END IF;

  -- Jobs: Service role can insert/update (for API routes)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'jobs' AND policyname = 'jobs_service_all'
  ) THEN
    CREATE POLICY "jobs_service_all" ON public.jobs
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;

  -- Job images: Users can view images for their jobs
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'job_images' AND policyname = 'job_images_select_own'
  ) THEN
    CREATE POLICY "job_images_select_own" ON public.job_images
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.jobs
          WHERE jobs.job_id = job_images.job_id
          AND (jobs.user_id = auth.uid() OR jobs.user_id IS NULL)
        )
      );
  END IF;

  -- Job images: Service role can insert (for API routes)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'job_images' AND policyname = 'job_images_service_insert'
  ) THEN
    CREATE POLICY "job_images_service_insert" ON public.job_images
      FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

