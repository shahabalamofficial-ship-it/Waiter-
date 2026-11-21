-- Yasmine Palace Trainer: Supabase schema
-- Run this in Supabase SQL Editor. Enable Email OTP in Authentication settings.
-- All user-owned tables enforce Row Level Security. Never use service_role in the browser.

create extension if not exists pgcrypto;

create table if not exists public.user_app_backups (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.personal_lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(title) between 1 and 160),
  body text not null check (length(body) <= 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.personal_dishes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(name) between 1 and 160),
  category text not null default '' check (length(category) <= 100),
  ingredients text not null default '' check (length(ingredients) <= 10000),
  description text not null default '' check (length(description) <= 3000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.personal_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (length(body) between 1 and 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dish_media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dish_id uuid not null references public.personal_dishes(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null default 'photo',
  content_type text not null default 'image/jpeg',
  created_at timestamptz not null default now()
);

alter table public.user_app_backups enable row level security;
alter table public.personal_lessons enable row level security;
alter table public.personal_dishes enable row level security;
alter table public.personal_notes enable row level security;
alter table public.dish_media enable row level security;

drop policy if exists "users manage own backup" on public.user_app_backups;
create policy "users manage own backup" on public.user_app_backups
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users manage own lessons" on public.personal_lessons;
create policy "users manage own lessons" on public.personal_lessons
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users manage own dishes" on public.personal_dishes;
create policy "users manage own dishes" on public.personal_dishes
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users manage own notes" on public.personal_notes;
create policy "users manage own notes" on public.personal_notes
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users manage own dish media" on public.dish_media;
create policy "users manage own dish media" on public.dish_media
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Private bucket for personal dish photos. 8 MB max per file.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dish-photos', 'dish-photos', false, 8388608, array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do update set public = false, file_size_limit = 8388608,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic'];

drop policy if exists "users read own dish photos" on storage.objects;
create policy "users read own dish photos" on storage.objects
  for select to authenticated using (bucket_id = 'dish-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users upload own dish photos" on storage.objects;
create policy "users upload own dish photos" on storage.objects
  for insert to authenticated with check (bucket_id = 'dish-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users update own dish photos" on storage.objects;
create policy "users update own dish photos" on storage.objects
  for update to authenticated using (bucket_id = 'dish-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'dish-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users delete own dish photos" on storage.objects;
create policy "users delete own dish photos" on storage.objects
  for delete to authenticated using (bucket_id = 'dish-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Keep updated_at current on edits.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists personal_lessons_updated_at on public.personal_lessons;
create trigger personal_lessons_updated_at before update on public.personal_lessons
for each row execute function public.set_updated_at();
drop trigger if exists personal_dishes_updated_at on public.personal_dishes;
create trigger personal_dishes_updated_at before update on public.personal_dishes
for each row execute function public.set_updated_at();
drop trigger if exists personal_notes_updated_at on public.personal_notes;
create trigger personal_notes_updated_at before update on public.personal_notes
for each row execute function public.set_updated_at();
