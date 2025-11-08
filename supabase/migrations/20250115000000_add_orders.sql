-- Migration: Add orders and webhook_events tables
-- Run with: supabase db push

-- Create orders table
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  job_id text not null,
  status text not null check (status in ('pending','approved','paid','failed','refunded')),
  amount_cents int not null default 299,
  currency text not null default 'USD',
  paypal_order_id text,
  paypal_capture_id text,
  payer_email text,
  approval_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_orders_job on public.orders(job_id);
create index if not exists idx_orders_status on public.orders(status);

-- Create webhook_events table for idempotency
create table if not exists public.webhook_events (
  id text primary key, -- PayPal event.id
  resource_id text,
  event_type text,
  received_at timestamptz not null default now()
);

create index if not exists idx_webhook_events_resource on public.webhook_events(resource_id);
create index if not exists idx_webhook_events_type on public.webhook_events(event_type);

-- Enable Row Level Security
alter table public.orders enable row level security;
alter table public.webhook_events enable row level security;

-- RLS Policies for orders (users can only see their own orders via jobs)
create policy "Users can view orders for their jobs"
  on public.orders for select
  using (
    exists (
      select 1 from public.jobs
      where jobs.id = orders.job_id
      and jobs.user_id = auth.uid()
    )
  );

create policy "Users can insert orders for their jobs"
  on public.orders for insert
  with check (
    exists (
      select 1 from public.jobs
      where jobs.id = orders.job_id
      and jobs.user_id = auth.uid()
    )
  );

-- RLS Policies for webhook_events (only service role can access)
create policy "Service role can manage webhook events"
  on public.webhook_events for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

