-- Roles + trash — tightens what editors can do and makes delete reversible.
--
-- Run this once in the Supabase SQL editor AFTER 0001_announcements.sql
-- (Dashboard -> SQL Editor -> New query -> paste -> Run). Safe to re-run.
--
-- Then make yourself the admin (once, with your own sign-in email):
--   update public.profiles set role = 'admin' where email = 'you@example.com';
--
-- Roles after this migration:
--   viewer  signed in, no access
--   editor  create posts; edit / pin / end posts written by editors (their own
--           or another editor's); upload and remove photos. Cannot touch posts
--           written by the admin, cannot delete or restore, cannot see Trash,
--           cannot change roles.
--   admin   everything: edit any post, move to Trash, restore, delete forever,
--           and set other users to viewer/editor from /admin -> Users.
--
-- There is exactly one admin. The admin role is never granted or removed from
-- the app — only here in the SQL editor.

-- ── helpers ─────────────────────────────────────────────────────────────────

create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- True when the given user (a post's author) is the admin.
create or replace function public.authored_by_admin(author uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = author and role = 'admin'
  );
$$;

-- ── profiles ────────────────────────────────────────────────────────────────

-- At most one admin, ever. (Fails if two admins already exist — demote one
-- first: update public.profiles set role = 'editor' where email = '...';)
create unique index if not exists profiles_single_admin
  on public.profiles ((true)) where role = 'admin';

-- The admin sees everyone (for the Users screen). Editors see the staff list
-- (editors + admin) so the post list can show who wrote what. Everyone sees
-- their own row.
drop policy if exists "profiles: read own" on public.profiles;
drop policy if exists "profiles: read" on public.profiles;
create policy "profiles: read"
  on public.profiles for select
  to authenticated
  using (
    id = auth.uid()
    or public.is_admin()
    or (public.is_editor() and role in ('editor', 'admin'))
  );

-- Still no insert/update/delete policies on profiles. Role changes go through
-- this function, which only the admin can use and which can only move people
-- between viewer and editor.
create or replace function public.set_user_role(target uuid, new_role text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only the admin can change roles.' using errcode = '42501';
  end if;
  if new_role not in ('viewer', 'editor') then
    raise exception 'Role must be viewer or editor.' using errcode = '22023';
  end if;
  if exists (select 1 from public.profiles where id = target and role = 'admin') then
    raise exception 'The admin role can only be changed in the Supabase dashboard.' using errcode = '42501';
  end if;

  update public.profiles set role = new_role where id = target;
  if not found then
    raise exception 'No such user.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.set_user_role(uuid, text) from public, anon;
grant execute on function public.set_user_role(uuid, text) to authenticated;

-- ── posts: trash ────────────────────────────────────────────────────────────

alter table public.posts
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users (id) on delete set null;

-- Editors may change a post's content but never its author or trash state.
-- (auth.uid() is null in the SQL editor / service role — leave those alone.)
create or replace function public.posts_guard_columns()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  new.created_by = old.created_by;
  new.created_at = old.created_at;
  new.deleted_at = old.deleted_at;
  new.deleted_by = old.deleted_by;
  return new;
end;
$$;

drop trigger if exists posts_guard_columns on public.posts;
create trigger posts_guard_columns
  before update on public.posts
  for each row execute function public.posts_guard_columns();

-- Read: riders see live posts that aren't in Trash; editors also see
-- scheduled/ended ones; only the admin sees Trash.
drop policy if exists "posts: public read active" on public.posts;
create policy "posts: public read active"
  on public.posts for select
  to anon, authenticated
  using (
    public.is_admin()
    or (
      deleted_at is null
      and (
        public.is_editor()
        or (starts_at <= now() and (ends_at is null or ends_at > now()))
      )
    )
  );

drop policy if exists "posts: editors insert" on public.posts;
create policy "posts: editors insert"
  on public.posts for insert
  to authenticated
  with check (public.is_editor() and created_by = auth.uid() and deleted_at is null);

-- Update: the admin can change anything. Editors can change posts that aren't
-- in Trash and weren't written by the admin.
drop policy if exists "posts: editors update" on public.posts;
create policy "posts: editors update"
  on public.posts for update
  to authenticated
  using (
    public.is_admin()
    or (public.is_editor() and deleted_at is null and not public.authored_by_admin(created_by))
  )
  with check (
    public.is_admin()
    or (public.is_editor() and deleted_at is null and not public.authored_by_admin(created_by))
  );

-- Permanent delete: admin only.
drop policy if exists "posts: editors delete" on public.posts;
drop policy if exists "posts: admin delete" on public.posts;
create policy "posts: admin delete"
  on public.posts for delete
  to authenticated
  using (public.is_admin());
