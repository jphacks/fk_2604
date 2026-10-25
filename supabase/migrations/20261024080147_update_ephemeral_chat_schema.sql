-- Update the already-applied ephemeral chat schema.
-- This migration intentionally preserves messages and bridge_messages.

-- NULL means unlimited. Existing concrete limits are preserved.
alter table public.rooms
  alter column max_members drop not null,
  alter column max_members drop default;

alter table public.rooms
  drop constraint if exists rooms_max_members_check;

alter table public.rooms
  add constraint rooms_max_members_check
  check (max_members is null or max_members >= 2);

-- Existing rooms were already available from creation. Keep that behavior
-- while ensuring all rows satisfy the new temporal invariant.
alter table public.rooms
  add column if not exists starts_at timestamptz;

update public.rooms
set starts_at = case
  when expires_at > created_at then created_at
  else expires_at - interval '1 microsecond'
end
where starts_at is null;

alter table public.rooms
  alter column starts_at set default now(),
  alter column starts_at set not null;

alter table public.rooms
  add constraint rooms_expires_after_starts_check
  check (expires_at > starts_at);

create or replace function public.is_active_room_member(
  p_room_id uuid,
  p_user_id uuid default auth.uid()
)
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
      and r.starts_at <= now()
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

create or replace function public.is_room_owner(
  p_room_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.rooms
    where id = p_room_id
      and owner_id = p_user_id
      and expires_at > now()
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

  -- Serialize joins for this room so the capacity check is race-safe.
  perform pg_advisory_xact_lock(hashtextextended(p_room_id::text, 0));
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found or v_room.starts_at > now() or v_room.expires_at <= now() then
    raise exception 'room is unavailable';
  end if;
  if not exists (
    select 1
    from public.room_invites i
    where i.room_id = p_room_id
      and i.token_hash = p_token_hash
      and i.revoked_at is null
      and i.expires_at > now()
  ) then
    raise exception 'invite is invalid or expired';
  end if;
  if exists (
    select 1
    from public.room_members
    where room_id = p_room_id
      and user_id = auth.uid()
      and kicked_at is not null
  ) then
    raise exception 'member is not allowed';
  end if;
  if v_room.max_members is not null
     and not exists (
       select 1
       from public.room_members
       where room_id = p_room_id
         and user_id = auth.uid()
     )
     and (
       select count(*)
       from public.room_members
       where room_id = p_room_id
         and kicked_at is null
     ) + 1 > v_room.max_members then
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

drop policy if exists rooms_insert_owner on public.rooms;
create policy rooms_insert_owner on public.rooms
for insert to authenticated
with check (
  owner_id = (select auth.uid())
  and expires_at > now()
  and expires_at > starts_at
);

drop policy if exists rooms_select_authorized on public.rooms;
create policy rooms_select_authorized on public.rooms
for select to authenticated
using (
  public.is_room_owner(id)
  or public.is_active_room_member(id)
);

drop policy if exists rooms_update_owner on public.rooms;
create policy rooms_update_owner on public.rooms
for update to authenticated
using (public.is_room_owner(id))
with check (
  owner_id = (select auth.uid())
  and expires_at > starts_at
  and (
    max_members is null
    or max_members >= (
      select count(*) + 1
      from public.room_members
      where room_id = id
        and kicked_at is null
    )
  )
);