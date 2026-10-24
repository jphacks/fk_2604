create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.get_room_by_invite(p_token_hash text)
returns table (id uuid, name text)
language sql
security definer
set search_path = ''
as $$
  select r.id, r.name
  from public.rooms r
  join public.room_invites i on i.room_id = r.id
  where i.token_hash = p_token_hash
    and i.revoked_at is null
    and i.expires_at > now()
    and r.expires_at > now()
  limit 1;
$$;

revoke all on function public.get_room_by_invite(text) from public;
grant execute on function public.get_room_by_invite(text) to anon, authenticated;

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
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if char_length(trim(p_nickname)) not between 1 and 50 then raise exception 'invalid nickname'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_room_id::text, 0));
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found or v_room.expires_at <= now() then raise exception 'room is unavailable'; end if;
  if not exists (select 1 from public.room_invites where room_id = p_room_id and token_hash = p_token_hash and revoked_at is null and expires_at > now()) then raise exception 'invite is invalid or expired'; end if;
  if exists (select 1 from public.room_members where room_id = p_room_id and user_id = auth.uid() and kicked_at is not null) then raise exception 'member is not allowed'; end if;
  if not exists (select 1 from public.room_members where room_id = p_room_id and user_id = auth.uid())
    and (select count(*) from public.room_members where room_id = p_room_id and kicked_at is null) + 1 > v_room.max_members then raise exception 'room is full'; end if;
  insert into public.room_members (room_id, user_id, nickname)
  values (p_room_id, auth.uid(), trim(p_nickname))
  on conflict (room_id, user_id) do update set nickname = excluded.nickname, kicked_at = null
  returning * into v_member;
  return v_member;
end;
$$;
