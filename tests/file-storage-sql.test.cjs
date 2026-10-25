/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

const migration = readFileSync('supabase/migrations/20261025163556_room_file_storage_lifecycle.sql', 'utf8');
const room = '00000000-0000-4000-8000-000000000001';
const owner = '00000000-0000-4000-8000-000000000002';
const guest = '00000000-0000-4000-8000-000000000003';
const stranger = '00000000-0000-4000-8000-000000000004';
const id = (n) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

async function setup(legacy = false) {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key);
    create table public.rooms(id uuid primary key,owner_id uuid, starts_at timestamptz, expires_at timestamptz);
    create table public.room_members(room_id uuid,user_id uuid,nickname text,kicked_at timestamptz);
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    grant usage on schema public,storage to anon,authenticated,service_role;
    grant all on all tables in schema public,storage to service_role;
    grant select,insert,update,delete on storage.objects to authenticated;
    create policy existing_other_policy on storage.objects for all to authenticated using(true) with check(true);
    insert into auth.users values('${owner}'),('${guest}');
    insert into public.rooms values('${room}','${owner}',now()-interval '1 hour',now()+interval '1 hour');
    insert into public.room_members values('${room}','${guest}','ゲスト',null);
  `);
  if (legacy) {
    await db.exec(`create table public.room_files (
      id uuid primary key,room_id uuid not null references public.rooms(id) on delete cascade,
      storage_path text not null unique,name text not null,size bigint not null,mime_type text not null,
      uploaded_by uuid not null references auth.users(id) on delete restrict,nickname text not null,
      uploaded_at timestamptz not null default now()
    ); insert into public.room_files values('${id(99)}','${room}','${room}/${id(99)}','old',1,'text/plain','${owner}','管理者',now());`);
  }
  await db.exec(migration);
  return db;
}

async function reserve(db, n, user = owner, size = 10 * 1024 * 1024) {
  return db.query('select * from public.reserve_room_file($1,$2,$3,$4,$5,$6)', [room,id(n),user,'file.txt','text/plain',size]);
}

test('PostgreSQL: fresh/legacy migrations preserve metadata, remove cascades, remain repeatable', async () => {
  for (const legacy of [false,true]) {
    const db = await setup(legacy);
    try {
      await db.exec(migration);
      assert.equal((await db.query('select count(*)::int n from room_files')).rows[0].n, legacy ? 1 : 0);
      assert.equal((await db.query("select count(*)::int n from pg_constraint where conrelid='room_files'::regclass and contype='f'")).rows[0].n,0);
      assert.equal((await db.query("select public from storage.buckets where id='room-files'")).rows[0].public,false);
    } finally { await db.close(); }
  }
});

test('PostgreSQL: owner/guest identity, 10MB limit, 50MB including reservations, permissions', async () => {
  const db = await setup();
  try {
    assert.equal((await reserve(db,1)).rows[0].nickname,'管理者');
    assert.equal((await reserve(db,2,guest)).rows[0].nickname,'ゲスト');
    await assert.rejects(reserve(db,3,stranger),/NOT_MEMBER/);
    await assert.rejects(reserve(db,3,owner,10485761),/BAD_REQUEST/);
    await db.exec(`update room_members set kicked_at=now() where user_id='${guest}'`);
    await assert.rejects(reserve(db,3,guest),/NOT_MEMBER/);
    const results = await Promise.allSettled([3,4,5,6].map(n=>reserve(db,n)));
    assert.equal(results.filter(r=>r.status==='fulfilled').length,3);
    assert.match(results.find(r=>r.status==='rejected').reason.message,/ROOM_STORAGE_FULL/);
    await db.exec('set role authenticated');
    await assert.rejects(db.query(`select reserve_room_file('${room}','${id(8)}','${owner}','x','text/plain',1)`),/permission denied/);
    await assert.rejects(db.query('select * from room_files'),/permission denied/);
    await db.exec('reset role');
  } finally { await db.close(); }
});

test('PostgreSQL: scoped restrictive Storage policy leaves other buckets usable', async () => {
  const db = await setup();
  try {
    await db.exec('set role authenticated');
    await db.exec("insert into storage.objects(bucket_id,name) values('other-bucket','ok')");
    await assert.rejects(db.exec("insert into storage.objects(bucket_id,name) values('room-files','blocked')"),/row-level security/);
    assert.equal((await db.query('select count(*)::int n from storage.objects')).rows[0].n,1);
    await db.exec('reset role');
  } finally { await db.close(); }
});

test('PostgreSQL: expiry denial, extension recheck, cleanup leases/retry/token and room deletion', async () => {
  const db = await setup();
  try {
    await reserve(db,1);
    await db.query('select complete_room_file($1,$2)',[id(1),owner]);
    assert.equal((await db.query('select * from pending_room_file_notifications(null)')).rows.length,1);
    // An extension committed before cleanup must preserve the file.
    await db.exec(`update rooms set expires_at=now()+interval '2 hours'`);
    assert.equal((await db.query('select * from claim_room_file_cleanup()')).rows.length,0);
    await db.exec(`update rooms set expires_at=now()-interval '1 second'`);
    await assert.rejects(reserve(db,2),/ROOM_GONE/);
    assert.equal((await db.query('select * from pending_room_file_notifications(null)')).rows.length,0);
    const first = (await db.query('select * from claim_room_file_cleanup()')).rows[0];
    assert.equal(first.status,'deleting');
    assert.equal((await db.query('select * from claim_room_file_cleanup()')).rows.length,0);
    await assert.rejects(db.exec(`update rooms set expires_at=now()+interval '1 hour'`),/cleanup has started/);
    // Failed Storage deletion never calls finish: record survives and is retried.
    await db.exec("update room_files set cleanup_after=now()-interval '1 minute'");
    const second = (await db.query('select * from claim_room_file_cleanup()')).rows[0];
    assert.notEqual(first.cleanup_token,second.cleanup_token);
    assert.equal(second.cleanup_attempts,2);
    await db.exec("update room_files set cleanup_started_at=now()-interval '25 hours'");
    await db.query('select finish_room_file_cleanup($1,$2)',[id(1),first.cleanup_token]);
    assert.equal((await db.query('select * from room_files')).rows.length,1);
    await db.exec('delete from rooms');
    assert.equal((await db.query('select * from room_files')).rows.length,1);
    await db.query('select finish_room_file_cleanup($1,$2)',[id(1),second.cleanup_token]);
    assert.equal((await db.query('select * from room_files')).rows.length,0);
  } finally { await db.close(); }
});

test('PostgreSQL: abandoned uploads reclaimed without deleting live pending uploads', async () => {
  const db = await setup();
  try {
    await reserve(db,1); await reserve(db,2);
    await db.query("update room_files set upload_deadline=now()-interval '1 minute' where id=$1",[id(1)]);
    const files = (await db.query('select * from claim_room_file_cleanup()')).rows;
    assert.equal(files.length,1); assert.equal(files[0].id,id(1));
    await assert.rejects(db.query('select complete_room_file($1,$2)',[id(1),owner]),/unavailable/);
    await db.query('select complete_room_file($1,$2)',[id(2),owner]);
  } finally { await db.close(); }
});

test('PostgreSQL: tombstones release capacity only after successful Storage acknowledgement', async () => {
  const db = await setup();
  try {
    for(let n=1;n<=5;n++) await reserve(db,n);
    await db.query("update room_files set upload_deadline=now()-interval '1 minute' where id=$1",[id(1)]);
    const claimed=(await db.query('select * from claim_room_file_cleanup()')).rows[0];
    await assert.rejects(reserve(db,6),/ROOM_STORAGE_FULL/);
    await db.query('select finish_room_file_cleanup($1,$2)',[claimed.id,claimed.cleanup_token]);
    assert.equal((await db.query('select * from room_files')).rows.length,5);
    assert.equal((await reserve(db,6)).rows[0].status,'uploading');
    await assert.rejects(reserve(db,7),/ROOM_STORAGE_FULL/);
  } finally { await db.close(); }
});
