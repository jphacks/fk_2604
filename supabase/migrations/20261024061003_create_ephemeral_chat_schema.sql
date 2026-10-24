-- Ephemeral chat metadata and authorization schema.
-- Message rows are optional when Redis is used for TTL-only message storage.

create extension if not exists pgcrypto;

create type public.room_member_role as enum ('guest');
create type public.bridge_status as enum ('pending', 'approved', 'rejected', 'cancelled', 'expired');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  max_members integer not null default 50 check (max_members between 2 and 50),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.room_members (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 50),
  role public.room_member_role not null default 'guest',
  joined_at timestamptz not null default now(),
  kicked_at timestamptz,
  primary key (room_id, user_id)
);

create table public.room_invites (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  token_hash text not null unique check (char_length(token_hash) >= 32),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (revoked_at is null or revoked_at <= expires_at)
);

create unique index room_invites_one_active_per_room
  on public.room_invites (room_id)
  where revoked_at is null;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create table public.room_bridges (
  id uuid primary key default gen_random_uuid(),
  source_room_id uuid not null references public.rooms (id) on delete cascade,
  target_room_id uuid not null references public.rooms (id) on delete cascade,
  requested_by uuid not null references auth.users (id) on delete restrict,
  approved_by uuid references auth.users (id) on delete restrict,
  purpose text not null check (char_length(purpose) between 1 and 500),
  status public.bridge_status not null default 'pending',
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (source_room_id <> target_room_id),
  check (expires_at > starts_at),
  check ((status = 'approved') = (approved_by is not null))
);

create unique index room_bridges_one_open_pair
  on public.room_bridges (
    least(source_room_id, target_room_id),
    greatest(source_room_id, target_room_id)
  )
  where status in ('pending', 'approved');

create table public.bridge_messages (
  id uuid primary key default gen_random_uuid(),
  bridge_id uuid not null references public.room_bridges (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index rooms_owner_expires_idx on public.rooms (owner_id, expires_at);
create index room_members_user_active_idx on public.room_members (user_id, room_id)
  where kicked_at is null;
create index room_invites_room_expiry_idx on public.room_invites (room_id, expires_at);
create index messages_room_created_idx on public.messages (room_id, created_at desc);
create index bridges_source_status_idx on public.room_bridges (source_room_id, status);
create index bridges_target_status_idx on public.room_bridges (target_room_id, status);
create index bridge_messages_bridge_created_idx on public.bridge_messages (bridge_id, created_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();
create trigger rooms_touch_updated_at
before update on public.rooms
for each row execute function public.touch_updated_at();
create trigger bridges_touch_updated_at
before update on public.room_bridges
for each row execute function public.touch_updated_at();

create or replace function public.is_active_room_member(p_room_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.rooms r
    where r.id = p_room_id
      and r.expires_at > now()
      and (
        r.owner_id = p_user_id
        or exists (
          select 1
          from public.room_members m
          where m.room_id = r.id
            and m.user_id = p_user_id
            and m.kicked_at is null
        )
      )
  );
$$;

create or replace function public.is_room_owner(p_room_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.rooms
    where id = p_room_id and owner_id = p_user_id and expires_at > now()
  );
$$;

create or replace function public.is_active_bridge_member(p_bridge_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.room_bridges b
    where b.id = p_bridge_id
      and b.status = 'approved'
      and b.starts_at <= now()
      and b.expires_at > now()
      and public.is_active_room_member(b.source_room_id, p_user_id)
      and public.is_active_room_member(b.target_room_id, p_user_id)
  );
$$;

create or replace function public.join_room(
  p_room_id uuid,
  p_token_hash text,
  p_nickname text
)
returns public.room_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.rooms;
  v_member public.room_members;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if char_length(trim(p_nickname)) not between 1 and 50 then
    raise exception 'invalid nickname';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_room_id::text, 0));
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found or v_room.expires_at <= now() then
    raise exception 'room is unavailable';
  end if;
  if not exists (
    select 1 from public.room_invites i
    where i.room_id = p_room_id
      and i.token_hash = p_token_hash
      and i.revoked_at is null
      and i.expires_at > now()
  ) then
    raise exception 'invite is invalid or expired';
  end if;
  if exists (
    select 1 from public.room_members
    where room_id = p_room_id and user_id = auth.uid() and kicked_at is not null
  ) then
    raise exception 'member is not allowed';
  end if;
  if not exists (
    select 1 from public.room_members where room_id = p_room_id and user_id = auth.uid()
  ) and (select count(*) from public.room_members where room_id = p_room_id and kicked_at is null) + 1 >= v_room.max_members then
    raise exception 'room is full';
  end if;

  insert into public.room_members (room_id, user_id, nickname)
  values (p_room_id, auth.uid(), trim(p_nickname))
  on conflict (room_id, user_id) do update
    set nickname = excluded.nickname, kicked_at = null
  returning * into v_member;
  return v_member;
end;
$$;

create or replace function public.issue_room_invite(
  p_room_id uuid,
  p_token_hash text,
  p_expires_at timestamptz
)
returns public.room_invites
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.room_invites;
begin
  if not public.is_room_owner(p_room_id) then
    raise exception 'room owner required';
  end if;
  if p_expires_at <= now() or char_length(p_token_hash) < 32 then
    raise exception 'invalid invite';
  end if;
  update public.room_invites
  set revoked_at = now()
  where room_id = p_room_id and revoked_at is null;
  insert into public.room_invites (room_id, token_hash, expires_at)
  values (p_room_id, p_token_hash, p_expires_at)
  returning * into v_invite;
  return v_invite;
end;
$$;

create or replace function public.validate_bridge_dates()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_source_expiry timestamptz;
  v_target_expiry timestamptz;
begin
  select expires_at into v_source_expiry from public.rooms where id = new.source_room_id;
  select expires_at into v_target_expiry from public.rooms where id = new.target_room_id;
  if v_source_expiry is null or v_target_expiry is null
     or new.expires_at > least(v_source_expiry, v_target_expiry) then
    raise exception 'bridge expiry must not exceed either room expiry';
  end if;
  return new;
end;
$$;

create or replace function public.validate_bridge_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.source_room_id <> old.source_room_id
     or new.target_room_id <> old.target_room_id
     or new.requested_by <> old.requested_by then
    raise exception 'bridge endpoints and requester are immutable';
  end if;
  if new.status = 'approved' and not public.is_room_owner(new.target_room_id, new.approved_by) then
    raise exception 'bridge approval requires target owner';
  end if;
  return new;
end;
$$;

create trigger room_bridges_validate_dates
before insert or update on public.room_bridges
for each row execute function public.validate_bridge_dates();
create trigger room_bridges_validate_update
before update on public.room_bridges
for each row execute function public.validate_bridge_update();

create or replace function public.purge_expired_rooms()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from public.rooms where expires_at <= now();
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.is_active_room_member(uuid, uuid) from public, anon, authenticated;
revoke all on function public.is_room_owner(uuid, uuid) from public, anon, authenticated;
revoke all on function public.is_active_bridge_member(uuid, uuid) from public, anon, authenticated;
revoke all on function public.join_room(uuid, text, text) from public, anon, authenticated;
revoke all on function public.issue_room_invite(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.purge_expired_rooms() from public, anon, authenticated;
grant execute on function public.is_active_room_member(uuid, uuid) to authenticated;
grant execute on function public.is_room_owner(uuid, uuid) to authenticated;
grant execute on function public.is_active_bridge_member(uuid, uuid) to authenticated;
grant execute on function public.purge_expired_rooms() to service_role;
grant execute on function public.join_room(uuid, text, text) to authenticated;
grant execute on function public.issue_room_invite(uuid, text, timestamptz) to authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.rooms to authenticated;
grant select, update, delete on public.room_members to authenticated;
grant select, insert, update on public.room_invites to authenticated;
grant select, insert on public.messages to authenticated;
grant select, insert, update on public.room_bridges to authenticated;
grant select, insert on public.bridge_messages to authenticated;

alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.room_invites enable row level security;
alter table public.messages enable row level security;
alter table public.room_bridges enable row level security;
alter table public.bridge_messages enable row level security;

create policy profiles_select_self on public.profiles
for select to authenticated using (id = (select auth.uid()));
create policy profiles_insert_self on public.profiles
for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_update_self on public.profiles
for update to authenticated using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy rooms_select_authorized on public.rooms
for select to authenticated using (public.is_active_room_member(id));
create policy rooms_insert_owner on public.rooms
for insert to authenticated with check (
  owner_id = (select auth.uid()) and expires_at > now()
);
create policy rooms_update_owner on public.rooms
for update to authenticated using (public.is_room_owner(id))
with check (
  owner_id = (select auth.uid())
  and max_members >= (
    select count(*) + 1 from public.room_members
    where room_id = id and kicked_at is null
  )
);
create policy rooms_delete_owner on public.rooms
for delete to authenticated using (public.is_room_owner(id));

create policy members_select_authorized on public.room_members
for select to authenticated using (
  public.is_room_owner(room_id)
  or (user_id = (select auth.uid()) and kicked_at is null and public.is_active_room_member(room_id))
);
create policy members_update_owner on public.room_members
for update to authenticated using (public.is_room_owner(room_id))
with check (public.is_room_owner(room_id));
create policy members_delete_owner on public.room_members
for delete to authenticated using (public.is_room_owner(room_id));

create policy invites_select_owner on public.room_invites
for select to authenticated using (public.is_room_owner(room_id));
create policy invites_insert_owner on public.room_invites
for insert to authenticated with check (public.is_room_owner(room_id));
create policy invites_update_owner on public.room_invites
for update to authenticated using (public.is_room_owner(room_id))
with check (public.is_room_owner(room_id));

create policy messages_select_member on public.messages
for select to authenticated using (public.is_active_room_member(room_id));
create policy messages_insert_member on public.messages
for insert to authenticated with check (
  sender_id = (select auth.uid()) and public.is_active_room_member(room_id)
);

create policy bridges_select_member_or_owner on public.room_bridges
for select to authenticated using (
  public.is_room_owner(source_room_id)
  or public.is_room_owner(target_room_id)
  or public.is_active_bridge_member(id)
);
create policy bridges_insert_source_owner on public.room_bridges
for insert to authenticated with check (
  requested_by = (select auth.uid()) and public.is_room_owner(source_room_id)
);
create policy bridges_update_target_owner on public.room_bridges
for update to authenticated using (public.is_room_owner(target_room_id))
with check (
  public.is_room_owner(target_room_id)
  and (approved_by is null or approved_by = (select auth.uid()))
);

create policy bridge_messages_select_member on public.bridge_messages
for select to authenticated using (public.is_active_bridge_member(bridge_id));
create policy bridge_messages_insert_member on public.bridge_messages
for insert to authenticated with check (
  sender_id = (select auth.uid()) and public.is_active_bridge_member(bridge_id)
);

do $$
declare
  v_table text;
begin
  if exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime') then
    foreach v_table in array array['messages', 'bridge_messages'] loop
      if not exists (
        select 1
        from pg_catalog.pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = v_table
      ) then
        execute format('alter publication supabase_realtime add table public.%I', v_table);
      end if;
    end loop;
  end if;
end;
$$;