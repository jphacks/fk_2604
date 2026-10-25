/* eslint-disable @typescript-eslint/no-require-imports */
const { test }=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const { PGlite }=require('@electric-sql/pglite');
const owner='00000000-0000-4000-8000-000000000001';
const guest='00000000-0000-4000-8000-000000000002';
const room='00000000-0000-4000-8000-000000000003';
const session='00000000-0000-4000-8000-000000000004';
const factor='00000000-0000-4000-8000-000000000005';

async function setup(enforce=true){
  const db=new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
    create table auth.sessions(id uuid primary key,user_id uuid);
    create table auth.mfa_factors(id uuid primary key,user_id uuid,factor_type text,status text);
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
    grant usage on schema auth,public to anon,authenticated,service_role;
    grant execute on function auth.jwt(),auth.uid() to anon,authenticated,service_role;`);
  // PGlite has core gen_random_uuid; pgcrypto's optional extension is not needed.
  for(const file of ['20261024061003_create_ephemeral_chat_schema.sql','20261024080147_update_ephemeral_chat_schema.sql','20261024161000_auth_helpers.sql','20261025090000_invite_preview_details.sql','20261025183833_admin_totp_enforcement.sql']){
    await db.exec(fs.readFileSync('supabase/migrations/'+file,'utf8').replace('create extension if not exists pgcrypto;',''));
  }
  if(enforce) await db.exec(fs.readFileSync('supabase/operations/enable-admin-totp.sql','utf8'));
  await db.exec(`insert into auth.users(id) values('${owner}'),('${guest}');
    insert into rooms(id,owner_id,name,starts_at,expires_at,max_members) values('${room}','${owner}','test',now()-interval '1 hour',now()+interval '1 hour',10);
    insert into room_members(room_id,user_id,nickname)values('${room}','${guest}','Guest');
    insert into auth.sessions values('${session}','${owner}');
    insert into auth.mfa_factors values('${factor}','${owner}','totp','verified');`);
  return db;
}
async function identity(db,user,aal='aal1',anonymous=false){
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:user,aal,is_anonymous:anonymous,session_id:session})]);
  await db.exec('set role authenticated');
}

test('PostgreSQL MFA: owner AAL1 cannot read/change/admin-RPC; AAL2 can',async()=>{
  const db=await setup();
  try{
    await identity(db,owner);
    assert.equal((await db.query('select * from rooms')).rows.length,0);
    assert.equal((await db.query("update rooms set name='blocked' returning id")).rows.length,0);
    assert.equal((await db.query('update room_members set kicked_at=now() returning user_id')).rows.length,0);
    await assert.rejects(db.query(`select issue_room_invite('${room}','${'a'.repeat(64)}',now()+interval '30 minutes')`),/MFA_REQUIRED/);
    await assert.rejects(db.query(`insert into rooms(owner_id,name,expires_at)values('${owner}','bad',now()+interval '1 hour')`),/row-level security/);
    await identity(db,owner,'aal2');
    assert.equal((await db.query('select * from rooms')).rows.length,1);
    assert.equal((await db.query("update rooms set name='allowed' returning id")).rows.length,1);
    assert.equal((await db.query('update room_members set kicked_at=now() returning user_id')).rows.length,1);
    assert.equal((await db.query(`select issue_room_invite('${room}','${'a'.repeat(64)}',now()+interval '30 minutes')`)).rows.length,1);
  }finally{await db.close();}
});

test('PostgreSQL MFA: AAL2 never authorizes management of another owners room',async()=>{
  const db=await setup();
  const foreignRoom='00000000-0000-4000-8000-000000000006';
  try{
    await db.query("insert into rooms(id,owner_id,name,starts_at,expires_at,max_members) values($1,$2,'foreign',now()-interval '1 hour',now()+interval '1 hour',10)",[foreignRoom,guest]);
    await identity(db,owner,'aal2');
    assert.equal((await db.query("update rooms set name='hacked' where id=$1 returning id",[foreignRoom])).rows.length,0);
    await assert.rejects(db.query(`select issue_room_invite('${foreignRoom}','${'d'.repeat(64)}',now()+interval '30 minutes')`),/room owner required/);
  }finally{await db.close();}
});

test('PostgreSQL MFA: guest AAL1 room read/invite lookup/join remain usable; cannot manage room',async()=>{
  const db=await setup();
  try{
    await identity(db,owner,'aal2');await db.query(`select issue_room_invite('${room}','${'b'.repeat(64)}',now()+interval '30 minutes')`);
    await identity(db,guest,'aal1',true);
    assert.equal((await db.query('select * from rooms')).rows.length,1);
    assert.equal((await db.query(`select * from get_room_by_invite('${'b'.repeat(64)}')`)).rows.length,1);
    assert.equal((await db.query(`select join_room('${room}','${'b'.repeat(64)}','Guest')`)).rows.length,1);
    assert.equal((await db.query("update rooms set name='hacked' returning id")).rows.length,0);
    assert.equal((await db.query('select * from room_invites')).rows.length,0);
    await assert.rejects(db.query(`select issue_room_invite('${room}','${'c'.repeat(64)}',now()+interval '30 minutes')`),/MFA_REQUIRED/);
  }finally{await db.close();}
});

test('PostgreSQL MFA: removed factor or revoked session immediately invalidates old AAL2 claims',async()=>{
  const db=await setup();
  try{
    await identity(db,owner,'aal2');assert.equal((await db.query('select admin_mfa_session_is_live() valid')).rows[0].valid,true);
    await db.exec(`reset role;delete from auth.mfa_factors;`);await identity(db,owner,'aal2');
    assert.equal((await db.query('select * from rooms')).rows.length,0);
    await db.exec(`reset role;insert into auth.mfa_factors values('${factor}','${owner}','totp','verified');delete from auth.sessions;`);
    await identity(db,owner,'aal2');
    assert.equal((await db.query('select admin_mfa_session_is_live() valid')).rows[0].valid,false);
    assert.equal((await db.query('select * from rooms')).rows.length,0);
    await db.exec('reset role;set role anon');
    await assert.rejects(db.query('select admin_mfa_session_is_live()'),/permission denied/);
  }finally{await db.close();}
});

test('PostgreSQL MFA: preparation migration preserves legacy access until explicit phase-two opt-in',async()=>{
  const db=await setup(false);
  try{
    await identity(db,owner,'aal1');
    assert.equal((await db.query('select * from rooms')).rows.length,1);
    assert.equal((await db.query('select admin_mfa_session_is_live() valid')).rows[0].valid,true);
    await db.exec('reset role');await db.exec(fs.readFileSync('supabase/operations/enable-admin-totp.sql','utf8'));
    await identity(db,owner,'aal1');assert.equal((await db.query('select * from rooms')).rows.length,0);
  }finally{await db.close();}
});
