-- Announcements / community service alerts — Supabase schema.
--
-- Run this once in the Supabase SQL editor (Dashboard -> SQL Editor -> New
-- query -> paste -> Run). It is idempotent-ish: re-running after a partial
-- failure is safe because every statement uses IF NOT EXISTS / OR REPLACE /
-- DROP ... IF EXISTS.
--
-- Model:
--   profiles  one row per auth user; `role` gates write access.
--   posts     announcements. A post with route_ids/stop_ids doubles as a
--             service alert on those routes/stops in the app.
--   storage   bucket "post-images" for carousel photos (public read).
--
-- Roles:
--   viewer  default for anyone who signs up — can't write anything
--   editor  can create/edit/delete posts and upload images
--   admin   same as editor today; reserved for managing other users
--
-- Promote someone after they've signed in once:
--   update public.profiles set role = 'editor' where email = 'them@example.com';

-- ── profiles ────────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  role       text not null default 'viewer' check (role in ('viewer', 'editor', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Auto-create a profile row whenever a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for users that existed before this migration.
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

-- True when the calling user is an editor or admin. SECURITY DEFINER so RLS
-- policies can call it without granting users read access to other profiles.
create or replace function public.is_editor()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('editor', 'admin')
  );
$$;

drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

-- No insert/update/delete policies: profiles are written only by the trigger
-- and by you in the dashboard/SQL editor.

-- ── posts ───────────────────────────────────────────────────────────────────

create table if not exists public.posts (
  id          uuid primary key default gen_random_uuid(),
  category    text not null check (category in ('service_change', 'event', 'volunteer', 'otr_update')),
  title       text not null check (char_length(title) between 1 and 140),
  body        text not null default '' check (char_length(body) <= 4000),
  -- route_short_name values ("2", "40", "C") this post applies to. When
  -- non-empty the app also surfaces the post as an alert on those routes.
  route_ids   text[] not null default '{}',
  -- Stop codes ("4511") this post applies to. Same idea for stop views.
  stop_ids    text[] not null default '{}',
  -- Carousel images: [{ "url": "...", "path": "bucket/object/path" }]
  images      jsonb not null default '[]'::jsonb,
  link_url    text check (link_url is null or link_url ~ '^https?://'),
  pinned      boolean not null default false,
  -- Visibility window. ends_at NULL = no expiry.
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint posts_window_valid check (ends_at is null or ends_at > starts_at)
);

create index if not exists posts_active_idx on public.posts (starts_at desc) where ends_at is null;
create index if not exists posts_ends_at_idx on public.posts (ends_at);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists posts_touch_updated_at on public.posts;
create trigger posts_touch_updated_at
  before update on public.posts
  for each row execute function public.touch_updated_at();

alter table public.posts enable row level security;

-- Anyone (including anonymous readers via the anon key) can read posts that
-- are currently live. Editors see everything, including scheduled/expired,
-- so the admin page can manage them.
drop policy if exists "posts: public read active" on public.posts;
create policy "posts: public read active"
  on public.posts for select
  to anon, authenticated
  using (
    public.is_editor()
    or (starts_at <= now() and (ends_at is null or ends_at > now()))
  );

drop policy if exists "posts: editors insert" on public.posts;
create policy "posts: editors insert"
  on public.posts for insert
  to authenticated
  with check (public.is_editor() and created_by = auth.uid());

drop policy if exists "posts: editors update" on public.posts;
create policy "posts: editors update"
  on public.posts for update
  to authenticated
  using (public.is_editor())
  with check (public.is_editor());

drop policy if exists "posts: editors delete" on public.posts;
create policy "posts: editors delete"
  on public.posts for delete
  to authenticated
  using (public.is_editor());

-- ── storage: post-images bucket ─────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-images', 'post-images', true,
  5242880,                                   -- 5 MB per object (client resizes well below this)
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "post-images: public read" on storage.objects;
create policy "post-images: public read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'post-images');

drop policy if exists "post-images: editors upload" on storage.objects;
create policy "post-images: editors upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'post-images' and public.is_editor());

drop policy if exists "post-images: editors update" on storage.objects;
create policy "post-images: editors update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'post-images' and public.is_editor());

drop policy if exists "post-images: editors delete" on storage.objects;
create policy "post-images: editors delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'post-images' and public.is_editor());
