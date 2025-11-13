-- orders
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  provider text not null default 'paypal',
  status text not null default 'created',
  amount_cents int default 299,
  currency text default 'USD',
  idempotency_key text unique,
  created_at timestamptz default now()
);

-- analytics_logs
create table if not exists public.analytics_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  route text not null,
  provider text,
  request_id text,
  meta jsonb,
  created_at timestamptz default now()
);

-- feature_flags
create table if not exists public.feature_flags (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

create index if not exists idx_orders_user on public.orders(user_id);
create index if not exists idx_logs_route on public.analytics_logs(route);

alter table public.orders enable row level security;
alter table public.analytics_logs enable row level security;
alter table public.feature_flags enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename='orders') then
    create policy "orders_read_own" on public.orders for select using (auth.uid() = user_id);
    create policy "orders_insert_auth" on public.orders for insert with check (auth.uid() = user_id or auth.uid() is null);
  end if;
  if not exists (select 1 from pg_policies where tablename='analytics_logs') then
    create policy "logs_read_own" on public.analytics_logs for select using (auth.uid() = user_id);
    create policy "logs_insert" on public.analytics_logs for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='feature_flags') then
    create policy "flags_read" on public.feature_flags for select using (true);
    create policy "flags_upsert" on public.feature_flags for all using (true) with check (true);
  end if;
end $$;

-- seed: provider 權重
insert into public.feature_flags(key, value, updated_at)
values ('gen_provider_weights', '{"fal":0,"runware":1}'::jsonb, now())
on conflict (key) do update set value='{"fal":0,"runware":1}'::jsonb, updated_at=now();
