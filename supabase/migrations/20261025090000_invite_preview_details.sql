-- 入室画面（S-08）で、ルームの残り時間と参加人数を見せられるようにする。
-- 返す列が増えるので、作り直す（create or replace では返り値の型を変えられない）
drop function if exists public.get_room_by_invite(text);

create function public.get_room_by_invite(p_token_hash text)
returns table (id uuid, name text, expires_at timestamptz, max_members integer, member_count integer)
language sql
security definer
set search_path = ''
as $$
  -- 参加人数はチャット画面と同じく、ゲスト（管理者を除く）＋管理者1人で数える
  select r.id, r.name, r.expires_at, r.max_members,
    (
      select count(*)::integer + 1
      from public.room_members m
      where m.room_id = r.id and m.kicked_at is null and m.user_id <> r.owner_id
    ) as member_count
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
