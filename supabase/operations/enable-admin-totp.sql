-- MANUAL PHASE TWO: apply only after MFA enrollment/login works on every deployment.
-- Shared DB changes affect main, develop and previews using the same project.
begin;
-- Restrictive policies add MFA to existing ownership/member policies. Guest
-- room reads and anonymous invite/join RPCs retain their existing authorization.
drop policy if exists rooms_admin_totp on public.rooms;
create policy rooms_admin_totp on public.rooms as restrictive for all to authenticated
  using (owner_id is distinct from (select auth.uid()) or (select admin_mfa_private.has_admin_aal2()))
  with check (owner_id is distinct from (select auth.uid()) or (select admin_mfa_private.has_admin_aal2()));

drop policy if exists members_admin_totp on public.room_members;
create policy members_admin_totp on public.room_members as restrictive for all to authenticated
  using (not public.is_room_owner(room_id) or (select admin_mfa_private.has_admin_aal2()))
  with check (not public.is_room_owner(room_id) or (select admin_mfa_private.has_admin_aal2()));

drop policy if exists invites_admin_totp on public.room_invites;
create policy invites_admin_totp on public.room_invites as restrictive for all to authenticated
  using ((select admin_mfa_private.has_admin_aal2()))
  with check ((select admin_mfa_private.has_admin_aal2()));

drop policy if exists bridges_admin_totp on public.room_bridges;
create policy bridges_admin_totp on public.room_bridges as restrictive for all to authenticated
  using ((not public.is_room_owner(source_room_id) and not public.is_room_owner(target_room_id))
    or (select admin_mfa_private.has_admin_aal2()))
  with check ((not public.is_room_owner(source_room_id) and not public.is_room_owner(target_room_id))
    or (select admin_mfa_private.has_admin_aal2()));

-- Existing SECURITY DEFINER RPC bypasses RLS, so protect it explicitly as well.
create or replace function public.issue_room_invite(
  p_room_id uuid, p_token_hash text, p_expires_at timestamptz
) returns public.room_invites language plpgsql security definer set search_path = '' as $$
declare v_invite public.room_invites;
begin
  if not admin_mfa_private.has_admin_aal2() then raise exception 'MFA_REQUIRED' using errcode = '42501'; end if;
  if not public.is_room_owner(p_room_id) then raise exception 'room owner required'; end if;
  if p_expires_at <= now() or char_length(p_token_hash) < 32 then raise exception 'invalid invite'; end if;
  update public.room_invites set revoked_at = now() where room_id = p_room_id and revoked_at is null;
  insert into public.room_invites(room_id,token_hash,expires_at)
    values(p_room_id,p_token_hash,p_expires_at) returning * into v_invite;
  return v_invite;
end $$;
revoke all on function public.issue_room_invite(uuid,text,timestamptz) from public,anon,authenticated;
grant execute on function public.issue_room_invite(uuid,text,timestamptz) to authenticated;
commit;
