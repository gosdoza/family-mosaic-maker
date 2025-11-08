# Database Schema

This document describes the Supabase database schema required for the Family Mosaic Maker application.

## Tables

### `jobs`
Stores image generation jobs.

```sql
CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  style TEXT NOT NULL,
  template TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  progress INTEGER DEFAULT 0, -- 0-100
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_jobs_user_id ON jobs(user_id);
CREATE INDEX idx_jobs_status ON jobs(status);
```

### `job_images`
Stores generated images for each job.

```sql
CREATE TABLE job_images (
  id SERIAL PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_job_images_job_id ON job_images(job_id);
```

### `orders`
Stores payment orders.

```sql
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
  plan TEXT NOT NULL, -- 'premium', etc.
  amount DECIMAL(10, 2) NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'paid', 'failed'
  payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'failed'
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_job_id ON orders(job_id);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
```

## Row Level Security (RLS)

Enable RLS on all tables:

```sql
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
```

### Policies

Users can only see their own jobs, images, and orders:

```sql
-- Jobs policies
CREATE POLICY "Users can view their own jobs"
  ON jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own jobs"
  ON jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Job images policies
CREATE POLICY "Users can view images for their jobs"
  ON job_images FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = job_images.job_id
      AND jobs.user_id = auth.uid()
    )
  );

-- Orders policies
CREATE POLICY "Users can view their own orders"
  ON orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own orders"
  ON orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

