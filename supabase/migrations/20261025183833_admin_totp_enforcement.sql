-- Review/apply manually. This migration does not enable hosted Auth MFA settings.
begin;

create schema if not exists admin_mfa_private;
revoke all on schema admin_mfa_private from public, anon, authenticated;
grant usage on schema admin_mfa_private to authenticated;

-- Private SECURITY DEFINER is needed only for Auth's protected sessions/factors.
-- No caller-supplied user id; all predicates bind to the current verified JWT.
create or replace function admin_mfa_private.has_current_session()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
    and coalesce(auth.jwt()->>'is_anonymous', 'false') = 'false'
    and exists(select 1 from auth.sessions s
      where s.id::text = auth.jwt()->>'session_id' and s.user_id = auth.uid());
$$;
revoke all on function admin_mfa_private.has_current_session() from public, anon, authenticated;
grant execute on function admin_mfa_private.has_current_session() to authenticated;

create or replace function public.admin_mfa_session_is_live()
returns boolean language sql stable security invoker set search_path = '' as $$
  select admin_mfa_private.has_current_session();
$$;
revoke all on function public.admin_mfa_session_is_live() from public, anon, authenticated;
grant execute on function public.admin_mfa_session_is_live() to authenticated;

create or replace function admin_mfa_private.has_admin_aal2()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
    and (auth.jwt()->>'aal') = 'aal2'
    and coalesce(auth.jwt()->>'is_anonymous', 'false') = 'false'
    and admin_mfa_private.has_current_session()
    and exists(select 1 from auth.mfa_factors f
      where f.user_id = auth.uid() and f.factor_type = 'totp' and f.status = 'verified');
$$;
revoke all on function admin_mfa_private.has_admin_aal2() from public, anon, authenticated;
grant execute on function admin_mfa_private.has_admin_aal2() to authenticated;

-- Safe preparation only. Enable the restrictive policies after all UIs work,
-- using supabase/operations/enable-admin-totp.sql (manual opt-in).
commit;
