-- Compatible with the manually applied 20261025150000_create_room_files.sql.
-- No existing metadata or Storage object is deleted by this migration.
begin;

insert into storage.buckets(id, name, public, file_size_limit)
values ('room-files', 'room-files', false, 10485760)
on conflict(id) do update set public = false, file_size_limit = 10485760;

create table if not exists public.room_files (
  id uuid primary key,
  room_id uuid not null,
  storage_path text not null unique,
  name text not null check (char_length(name) between 1 and 120),
  size bigint not null check (size > 0),
  mime_type text not null check (char_length(mime_type) between 1 and 255),
  uploaded_by uuid not null,
  nickname text not null check (char_length(nickname) between 1 and 50),
  uploaded_at timestamptz not null default now(),
  check (storage_path = room_id::text || '/' || id::text)
);

-- Intentionally retain room_id/uploaded_by as identifiers, without FK cascades:
-- even room/user deletion must not destroy the only Storage cleanup record.
do $$ declare c record; begin
  for c in select conname from pg_constraint
    where conrelid = 'public.room_files'::regclass and contype = 'f'
      and confrelid in ('public.rooms'::regclass, 'auth.users'::regclass)
  loop execute format('alter table public.room_files drop constraint %I', c.conname); end loop;
end $$;

alter table public.room_files
  add column if not exists status text not null default 'ready',
  add column if not exists upload_deadline timestamptz not null default (now() + interval '15 minutes'),
  add column if not exists cleanup_token uuid,
  add column if not exists cleanup_after timestamptz not null default now(),
  add column if not exists cleanup_started_at timestamptz,
  add column if not exists storage_deleted_at timestamptz,
  add column if not exists cleanup_attempts integer not null default 0;

-- Existing files predate the durable outbox and may already have a Redis notice.
-- Backfill only once; rerunning this migration must not acknowledge new pending jobs.
do $$ begin
  if not exists(select 1 from information_schema.columns
    where table_schema='public' and table_name='room_files' and column_name='notified_at') then
    alter table public.room_files add column notified_at timestamptz;
    update public.room_files set notified_at = now() where status = 'ready';
  end if;
end $$;

create index if not exists room_files_room_uploaded_idx on public.room_files(room_id, uploaded_at desc);
create index if not exists room_files_jobs_idx on public.room_files(status, cleanup_after);
alter table public.room_files enable row level security;
revoke all on public.room_files from public, anon, authenticated;
grant select, insert, update, delete on public.room_files to service_role;

-- RESTRICTIVE is ANDed with any existing permissive policy. Other buckets pass
-- unchanged. Private alone would not prevent an existing broad authenticated policy.
drop policy if exists room_files_server_only on storage.objects;
create policy room_files_server_only on storage.objects as restrictive
  for all to anon, authenticated
  using (bucket_id <> 'room-files') with check (bucket_id <> 'room-files');

create or replace function public.reserve_room_file(
  p_room_id uuid, p_id uuid, p_user_id uuid, p_name text, p_mime_type text, p_size bigint
) returns public.room_files language plpgsql security invoker set search_path = '' as $$
declare r public.rooms; f public.room_files; v_nickname text;
begin
  select * into r from public.rooms where id = p_room_id for update;
  if not found or r.starts_at > clock_timestamp() or r.expires_at <= clock_timestamp() then
    raise exception 'ROOM_GONE';
  end if;
  if r.owner_id = p_user_id then v_nickname := '管理者';
  else
    select nickname into v_nickname from public.room_members
      where room_id = p_room_id and user_id = p_user_id and kicked_at is null for share;
    if not found then raise exception 'NOT_MEMBER'; end if;
  end if;
  if p_size is null or p_size < 1 or p_size > 10485760
    or p_name is null or char_length(p_name) not between 1 and 120
    or p_mime_type is null or char_length(p_mime_type) not between 1 and 255 then
    raise exception 'BAD_REQUEST';
  end if;
  -- Count ready, uploading AND deleting bytes until physical deletion succeeds.
  -- Successfully removed tombstones retain retry identity but release capacity.
  if (select coalesce(sum(size), 0) from public.room_files where room_id = p_room_id
    and (status <> 'deleting' or storage_deleted_at is null)) + p_size > 52428800 then
    raise exception 'ROOM_STORAGE_FULL';
  end if;
  insert into public.room_files(id,room_id,storage_path,name,size,mime_type,uploaded_by,nickname,status)
  values(p_id,p_room_id,p_room_id::text || '/' || p_id::text,p_name,p_size,p_mime_type,p_user_id,v_nickname,'uploading')
  returning * into f;
  return f;
end $$;

create or replace function public.complete_room_file(p_id uuid, p_user_id uuid)
returns public.room_files language plpgsql security invoker set search_path = '' as $$
declare r public.rooms; f public.room_files; v_room_id uuid;
begin
  select room_id into v_room_id from public.room_files where id = p_id;
  select * into r from public.rooms where id = v_room_id for update;
  if not found or r.starts_at > clock_timestamp() or r.expires_at <= clock_timestamp() then raise exception 'ROOM_GONE'; end if;
  if r.owner_id <> p_user_id and not exists(select 1 from public.room_members
    where room_id = r.id and user_id = p_user_id and kicked_at is null) then raise exception 'NOT_MEMBER'; end if;
  update public.room_files set status = 'ready'
  where id = p_id and uploaded_by = p_user_id and status = 'uploading' and upload_deadline > clock_timestamp()
  returning * into f;
  if not found then raise exception 'Upload reservation unavailable'; end if;
  return f;
end $$;

create or replace function public.pending_room_file_notifications(p_room_id uuid default null)
returns table(id uuid,room_id uuid,storage_path text,name text,size bigint,mime_type text,
  uploaded_by uuid,nickname text,uploaded_at timestamptz,expires_at timestamptz)
language sql security invoker set search_path = '' as $$
  select f.id,f.room_id,f.storage_path,f.name,f.size,f.mime_type,f.uploaded_by,f.nickname,f.uploaded_at,r.expires_at
  from public.room_files f join public.rooms r on r.id = f.room_id
  where f.status = 'ready' and f.notified_at is null and r.expires_at > clock_timestamp()
    and (p_room_id is null or f.room_id = p_room_id)
  order by f.uploaded_at limit 20;
$$;

create or replace function public.claim_room_file_cleanup()
returns setof public.room_files language plpgsql security invoker set search_path = '' as $$
declare candidate record; r public.rooms; f public.room_files; missing boolean;
begin
  for candidate in
    select rf.id,rf.room_id from public.room_files rf left join public.rooms rm on rm.id = rf.room_id
    where rf.cleanup_after <= clock_timestamp() and
      (rf.status = 'deleting' or rm.id is null or rm.expires_at <= clock_timestamp()
       or (rf.status = 'uploading' and rf.upload_deadline <= clock_timestamp()))
    order by rf.cleanup_after,rf.uploaded_at limit 20
  loop
    -- Same lock order as reserve/complete and the expiry UPDATE trigger.
    select * into r from public.rooms where id = candidate.room_id for update;
    missing := not found;
    select * into f from public.room_files where id = candidate.id for update;
    if not found or f.cleanup_after > clock_timestamp() then continue; end if;
    -- Recheck under lock: a concurrent extension that won the room lock is safe.
    if f.status = 'deleting' or missing or r.expires_at <= clock_timestamp()
       or (f.status = 'uploading' and f.upload_deadline <= clock_timestamp()) then
      update public.room_files set status = 'deleting', cleanup_token = gen_random_uuid(),
        cleanup_started_at = coalesce(cleanup_started_at, clock_timestamp()),
        cleanup_attempts = cleanup_attempts + 1, cleanup_after = clock_timestamp() + interval '5 minutes'
      where id = f.id returning * into f;
      return next f;
    end if;
  end loop;
end $$;

create or replace function public.finish_room_file_cleanup(p_id uuid,p_token uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  update public.room_files set storage_deleted_at = clock_timestamp()
    where id = p_id and status = 'deleting' and cleanup_token = p_token;
  -- Retain a tombstone for 24h, repeatedly deleting the immutable path. This also
  -- catches late/ambiguous Storage uploads that finish after request cancellation.
  delete from public.room_files where id = p_id and status = 'deleting' and cleanup_token = p_token
    and cleanup_started_at < clock_timestamp() - interval '24 hours';
end $$;

create schema if not exists file_storage_private;
revoke all on schema file_storage_private from public, anon, authenticated;
create or replace function file_storage_private.guard_room_file_expiry()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Once physical cleanup is claimed, extension cannot resurrect deleted files.
  -- Reserve/uploading cleanup does not block an active room's normal extension.
  if new.expires_at > old.expires_at and old.expires_at <= clock_timestamp()
    and exists(select 1 from public.room_files where room_id = old.id and status = 'deleting') then
    raise exception 'File cleanup has started; create a new room instead';
  end if;
  return new;
end $$;
revoke all on function file_storage_private.guard_room_file_expiry() from public, anon, authenticated;
drop trigger if exists guard_room_file_expiry on public.rooms;
create trigger guard_room_file_expiry before update of expires_at on public.rooms
  for each row execute function file_storage_private.guard_room_file_expiry();

revoke all on function public.reserve_room_file(uuid,uuid,uuid,text,text,bigint) from public,anon,authenticated;
revoke all on function public.complete_room_file(uuid,uuid) from public,anon,authenticated;
revoke all on function public.pending_room_file_notifications(uuid) from public,anon,authenticated;
revoke all on function public.claim_room_file_cleanup() from public,anon,authenticated;
revoke all on function public.finish_room_file_cleanup(uuid,uuid) from public,anon,authenticated;
grant execute on function public.reserve_room_file(uuid,uuid,uuid,text,text,bigint) to service_role;
grant execute on function public.complete_room_file(uuid,uuid) to service_role;
grant execute on function public.pending_room_file_notifications(uuid) to service_role;
grant execute on function public.claim_room_file_cleanup() to service_role;
grant execute on function public.finish_room_file_cleanup(uuid,uuid) to service_role;
commit;
