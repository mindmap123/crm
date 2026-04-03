create extension if not exists pgcrypto;

create table if not exists public.app_state (
  id text primary key,
  students jsonb not null default '[]'::jsonb,
  prospects jsonb not null default '[]'::jsonb,
  todos jsonb not null default '[]'::jsonb,
  ideas jsonb not null default '[]'::jsonb,
  journal jsonb not null default '[]'::jsonb,
  ai_settings jsonb not null default '{}'::jsonb,
  google_settings jsonb not null default '{}'::jsonb,
  google_oauth jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_state
add column if not exists ai_settings jsonb not null default '{}'::jsonb;

alter table public.app_state
add column if not exists google_settings jsonb not null default '{}'::jsonb;

alter table public.app_state
add column if not exists google_oauth jsonb not null default '{}'::jsonb;

alter table public.app_state enable row level security;

drop policy if exists "anon can read app_state" on public.app_state;
create policy "anon can read app_state"
on public.app_state
for select
to anon
using (true);

drop policy if exists "anon can write app_state" on public.app_state;
create policy "anon can write app_state"
on public.app_state
for insert
to anon
with check (true);

drop policy if exists "anon can update app_state" on public.app_state;
create policy "anon can update app_state"
on public.app_state
for update
to anon
using (true)
with check (true);
