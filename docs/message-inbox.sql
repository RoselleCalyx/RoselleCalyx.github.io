-- Message in a Bottle: private, host-only inbox.
-- Run in the Supabase SQL Editor as the project owner.
-- Compatible with the bottles table in the original README.
-- This migration deliberately removes the old public bottle-reading policies.
-- Existing letters remain stored; neither visitors nor other logged-in users
-- can read them. The owner UI cannot approve, publish, delete or edit letters.

begin;

create table if not exists public.bottles (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  name text check (char_length(name) <= 60),
  contact text check (char_length(contact) <= 120),
  text text not null check (char_length(text) between 2 and 500),
  approved boolean not null default false,
  reply text,
  read_at timestamptz
);

alter table public.bottles add column if not exists read_at timestamptz;
alter table public.bottles alter column approved set default false;
alter table public.bottles alter column read_at set default null;
alter table public.bottles alter column reply set default null;
alter table public.bottles enable row level security;

create table if not exists public.message_hosts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.message_hosts enable row level security;

-- Old grants include SELECT(column, ...) from the README. Explicitly clear
-- both table and column grants before granting the minimum client privileges.
revoke all privileges on table public.bottles from public, anon, authenticated;
revoke all privileges on table public.message_hosts from public, anon, authenticated;
do $$
declare
  relation_name text;
  column_names text;
  policy_row record;
  sequence_name text;
begin
  foreach relation_name in array array['bottles', 'message_hosts'] loop
    select string_agg(quote_ident(attname), ', ' order by attnum)
    into column_names
    from pg_attribute
    where attrelid = ('public.' || relation_name)::regclass
      and attnum > 0 and not attisdropped;
    execute format('revoke all privileges (%s) on table public.%I from public, anon, authenticated', column_names, relation_name);
    -- RLS policies are permissive by default (OR-combined), so old policies
    -- must not survive this migration and reopen the inbox.
    for policy_row in select policyname from pg_policies
      where schemaname = 'public' and tablename = relation_name loop
      execute format('drop policy %I on public.%I', policy_row.policyname, relation_name);
    end loop;
  end loop;
  sequence_name := pg_get_serial_sequence('public.bottles', 'id');
  if sequence_name is not null then
    execute format('revoke all privileges on sequence %s from public, anon, authenticated', sequence_name);
    execute format('grant usage on sequence %s to anon', sequence_name);
  end if;
end $$;

grant usage on schema public to anon, authenticated;

-- Visitors can send only these three columns; privacy flags, identity,
-- timestamps and replies are controlled by the database defaults.
grant insert (name, contact, text) on table public.bottles to anon;
create policy "anonymous private bottle submission"
  on public.bottles for insert to anon
  with check (
    approved = false
    and reply is null
    and read_at is null
    and char_length(btrim(text)) between 2 and 500
  );

-- No browser account can add itself or others as a host. Bootstrap with the
-- SQL Editor below, never with a service_role key in a public JavaScript file.
grant select (user_id) on table public.message_hosts to authenticated;
create policy "host can check own membership"
  on public.message_hosts for select to authenticated
  using (user_id = (select auth.uid()));

grant select on table public.bottles to authenticated;
grant update (read_at) on table public.bottles to authenticated;
create policy "explicit hosts read private bottles"
  on public.bottles for select to authenticated
  using (exists (
    select 1 from public.message_hosts
    where user_id = (select auth.uid())
  ));
create policy "explicit hosts mark bottles read"
  on public.bottles for update to authenticated
  using (exists (
    select 1 from public.message_hosts
    where user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.message_hosts
    where user_id = (select auth.uid())
  ));

create index if not exists bottles_inbox_created_idx
  on public.bottles (created_at desc, id desc);
create index if not exists bottles_inbox_unread_idx
  on public.bottles (created_at desc) where read_at is null;

commit;

-- OWNER BOOTSTRAP (run separately after creating the owner in Auth > Users):
-- Replace with the UUID copied from your own Auth user. Do not use an email.
-- insert into public.message_hosts (user_id)
-- values ('YOUR-OWNER-USER-UUID'::uuid)
-- on conflict (user_id) do nothing;

-- To revoke that account's inbox access:
-- delete from public.message_hosts where user_id = 'YOUR-OWNER-USER-UUID'::uuid;
