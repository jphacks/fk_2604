-- READ ONLY. Run in the intended project's SQL Editor before applying anything.
select version, name from supabase_migrations.schema_migrations order by version;
select table_schema,table_name,column_name,data_type,is_nullable,column_default
from information_schema.columns
where (table_schema='public' and table_name in ('rooms','room_members','room_files'))
order by table_name,ordinal_position;
select conname,pg_get_constraintdef(oid) as definition from pg_constraint
where conrelid=to_regclass('public.room_files');
select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
from pg_policies where (schemaname='storage' and tablename='objects')
  or (schemaname='public' and tablename='room_files');
select id,name,public,file_size_limit from storage.buckets where id='room-files';
select routine_schema,routine_name from information_schema.routines
where routine_name in ('purge_expired_rooms','reserve_room_file','complete_room_file',
  'claim_room_file_cleanup','finish_room_file_cleanup','pending_room_file_notifications');
select extname from pg_extension where extname in ('pg_cron','pg_net','supabase_vault');
-- If pg_cron is enabled, separately inspect:
-- select jobid,jobname,schedule,active from cron.job;
-- If room_files exists, separately inspect (names/content are deliberately omitted):
-- select count(*),coalesce(sum(size),0) from public.room_files;
-- select f.id from public.room_files f left join storage.objects o
--   on o.bucket_id='room-files' and o.name=f.storage_path where o.id is null;
-- select o.name from storage.objects o left join public.room_files f
--   on f.storage_path=o.name where o.bucket_id='room-files' and f.id is null;
-- select f.id from public.room_files f left join public.rooms r on r.id=f.room_id
--   where r.id is null;
-- Orphan objects created before this implementation need individual investigation;
-- this migration/worker will never delete untracked objects speculatively.
