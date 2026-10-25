/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loader } = require('./file-storage-loader.cjs');
const { randomUUID } = require('node:crypto');

const roomId = '00000000-0000-4000-8000-000000000001';
const owner = '00000000-0000-4000-8000-000000000002';
const guest = '00000000-0000-4000-8000-000000000003';
const other = '00000000-0000-4000-8000-000000000004';
const jobs = loader()('supabase/functions/_shared/file-jobs.ts');
const png = new Uint8Array([137,80,78,71,13,10,26,10]);

function fixture(userId = owner) {
  const state = {
    userId, room: { id: roomId, owner_id: owner, name: 'room', max_members: 5,
      starts_at: new Date(Date.now()-60_000).toISOString(), expires_at: new Date(Date.now()+3600_000).toISOString() },
    members: [{ user_id: guest, nickname: 'Guest', kicked_at: null }], files: [], storage: new Map(),
    messages: [], storageError: false, finalizeError: false, flushError: false, downloadHook: null, aal: 'aal2',
  };
  function from(table) {
    const filters = [];
    let update;
    const query = {
      select() { return query; }, eq(k,v) { filters.push([k,v]); return query; },
      is(k,v) { filters.push([k,v]); return query; }, order() { return query; },
      update(value) { update=value; return query; },
      then(resolve,reject) {
        let rows = table==='rooms' ? (state.room ? [state.room] : []) : table==='room_members' ? state.members : state.files;
        rows=rows.filter(r=>filters.every(([k,v])=> (k==='room_id' && table==='room_members' ? roomId : r[k])===v));
        if(update) rows.forEach(r=>Object.assign(r,update));
        return Promise.resolve({data:rows,error:null}).then(resolve,reject);
      },
      async maybeSingle() { const result=await query; return {...result,data:result.data[0]??null}; },
    };
    return query;
  }
  const admin = {
    from,
    async rpc(name,args) {
      if(name==='reserve_room_file') {
        const row={id:args.p_id,room_id:args.p_room_id,storage_path:`${args.p_room_id}/${args.p_id}`,
          name:args.p_name,size:args.p_size,mime_type:args.p_mime_type,uploaded_by:args.p_user_id,
          nickname:args.p_user_id===owner?'Admin':'Guest',uploaded_at:new Date().toISOString(),status:'uploading'};
        state.files.push(row); return {data:row,error:null};
      }
      if(name==='complete_room_file') {
        if(state.finalizeError) return {error:{message:'DB unavailable'}};
        const row=state.files.find(r=>r.id===args.p_id); row.status='ready'; return {data:row,error:null};
      }
      throw Error('Unexpected RPC '+name);
    },
    storage:{from(bucket) {
      assert.equal(bucket,'room-files');
      return {
        async upload(path,bytes,options) {
          assert.equal(options.upsert,false);
          if(state.storageError) return {error:Error('Storage unavailable')};
          state.storage.set(path,new Uint8Array(bytes)); return {error:null};
        },
        async download(path) {
          if(state.downloadHook) state.downloadHook();
          const bytes=state.storage.get(path);
          return bytes ? {data:new Blob([bytes]),error:null} : {error:{statusCode:404}};
        },
      };
    }},
  };
  function restart() {
    const load=loader({
      '@/lib/supabase/server':{createClient:async()=>({auth:{
        getUser:async()=>({data:{user:state.userId?{id:state.userId,is_anonymous:state.userId!==owner,
          factors:state.userId===owner?[{id:'totp',factor_type:'totp',status:'verified'}]:[]}:null}}),
        getClaims:async()=>({data:{claims:{sub:state.userId,aal:state.aal}},error:null}),
      },rpc:async()=>({data:true,error:null})})},
      '@/lib/supabase/admin':{createAdminClient:()=>admin},
      '@/lib/room-files':{
        ...jobs, flushRoomFiles:async()=>{if(state.flushError) throw Error('Redis unavailable');},
        listRoomFiles:async(id)=>state.files.filter(r=>r.room_id===id&&r.status==='ready').map(jobs.toSharedFile),
      },
      '@/lib/redis-messages':{
        getMessageRoom:(id,expires_at)=>({id,expiresAt:Date.parse(expires_at)}),
        syncMessageTtl:async()=>{}, listMessages:async(_,cursor)=>({messages:state.messages.slice(cursor),nextCursor:state.messages.length}),
        pushMessage:async(_,senderId,nickname,body)=>{const m={id:randomUUID(),senderId,nickname,body,sentAt:Date.now()};state.messages.push(m);return m;},
      },
    });
    return {
      upload:load('src/app/api/rooms/[roomId]/files/route.ts').POST,
      download:load('src/app/api/rooms/[roomId]/files/[fileId]/route.ts').GET,
      messages:load('src/app/api/rooms/[roomId]/messages/route.ts'),
    };
  }
  return {state,admin,restart,...restart()};
}

function ctx(fileId) { return {params:Promise.resolve({roomId,fileId})}; }
function uploadRequest(bytes=png,mime='image/png') {
  const form=new FormData(); form.append('file',new File([bytes],'test.png',{type:mime}));
  form.append('guestId',other); form.append('nickname','Spoofed');
  return new Request('http://localhost/api/files',{method:'POST',body:form});
}

test('API: owner and guest upload trust authenticated identity, preserve response shape', async()=>{
  for(const userId of [owner,guest]) {
    const f=fixture(userId), res=await f.upload(uploadRequest(),ctx());
    assert.equal(res.status,201);
    const body=await res.json();
    assert.deepEqual(Object.keys(body).sort(),['file','message']);
    assert.equal(body.file.uploadedBy,userId); assert.notEqual(body.file.nickname,'Spoofed');
    assert.deepEqual(body.message.file,body.file);
    assert.equal(f.state.storage.size,1);
    assert.equal(f.state.files[0].storage_path,`${roomId}/${body.file.id}`);
  }
});

test('API: unauthenticated, non-member and kicked users denied on upload/download/messages',async()=>{
  for(const identity of [null,other,guest]) {
    const f=fixture(identity);
    if(identity===guest) f.state.members[0].kicked_at=new Date().toISOString();
    const expected=identity===null?401:403;
    assert.equal((await f.upload(uploadRequest(),ctx())).status,expected);
    assert.equal((await f.download(new Request('http://localhost/f?guestId='+owner),ctx(randomUUID()))).status,expected);
    assert.equal((await f.messages.GET(new Request('http://localhost/messages'),ctx())).status,expected);
    assert.equal(f.state.storage.size,0);
  }
});

test('API: DB listing, download/preview after fresh module load, cross-room IDs rejected',async()=>{
  const f=fixture();
  const created=await(await f.upload(uploadRequest(),ctx())).json();
  const fresh=f.restart(); // metadata/blob services survive the entire module cache.
  const listed=await(await fresh.messages.GET(new Request('http://localhost/messages?cursor=0'),ctx())).json();
  assert.deepEqual(listed.files,[created.file]); assert.equal(listed.nextCursor,0);
  let response=await fresh.download(new Request('http://localhost/f'),ctx(created.file.id));
  assert.equal(response.status,200); assert.equal(response.headers.get('content-type'),'image/png');
  assert.match(response.headers.get('content-disposition'),/^inline/);
  assert.equal(response.headers.get('cache-control'),'private, no-store');
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()),png);
  response=await fresh.download(new Request('http://localhost/f?download=1'),ctx(created.file.id));
  assert.match(response.headers.get('content-disposition'),/^attachment/);
  assert.equal(response.headers.get('content-type'),'application/octet-stream');
  f.state.files[0].room_id=other;
  assert.equal((await fresh.download(new Request('http://localhost/f'),ctx(created.file.id))).status,404);
});

test('API: expiry denied immediately, including expiry/kick during Storage fetch',async()=>{
  const f=fixture(); const body=await(await f.upload(uploadRequest(),ctx())).json();
  f.state.downloadHook=()=>{f.state.room.expires_at=new Date(Date.now()-1).toISOString();};
  assert.equal((await f.download(new Request('http://localhost/f'),ctx(body.file.id))).status,404);
  assert.equal((await f.upload(uploadRequest(),ctx())).status,404);
  assert.equal((await f.messages.GET(new Request('http://localhost/messages'),ctx())).status,404);
  f.state.room.expires_at=new Date(Date.now()+60_000).toISOString(); f.state.userId=guest;
  f.state.downloadHook=()=>{f.state.members[0].kicked_at=new Date().toISOString();};
  assert.equal((await f.download(new Request('http://localhost/f'),ctx(body.file.id))).status,403);
});

test('API: Storage/DB failures retain cleanup reservation; Redis outage keeps successful upload',async()=>{
  for(const mode of ['storageError','finalizeError']) {
    const f=fixture();f.state[mode]=true;
    assert.equal((await f.upload(uploadRequest(),ctx())).status,503);
    assert.equal(f.state.files[0].status,'uploading');
    assert.equal(f.state.storage.size,mode==='storageError'?0:1);
  }
  const f=fixture(); f.state.flushError=true;
  assert.equal((await f.upload(uploadRequest(),ctx())).status,201);
  assert.equal(f.state.files[0].status,'ready');
});

test('API: empty/oversized and malformed multipart rejected; image MIME spoof downloads safely',async()=>{
  const f=fixture();
  assert.equal((await f.upload(uploadRequest(new Uint8Array()),ctx())).status,400);
  assert.equal((await f.upload(new Request('http://localhost/f',{method:'POST',headers:{'content-length':String(11*1024*1024)},body:'x'}),ctx())).status,413);
  assert.equal((await f.upload(uploadRequest(new Uint8Array(10*1024*1024+1)),ctx())).status,413);
  assert.equal((await f.upload(new Request('http://localhost/f',{method:'POST',body:'invalid'}),ctx())).status,400);
  const body=await(await f.upload(uploadRequest(new TextEncoder().encode('<script>alert(1)</script>')),ctx())).json();
  assert.equal(body.file.mimeType,'application/octet-stream');
  const response=await f.download(new Request('http://localhost/f'),ctx(body.file.id));
  assert.match(response.headers.get('content-disposition'),/^attachment/);
  assert.equal(response.headers.get('x-content-type-options'),'nosniff');
});

test('API: existing text messages and cursor shape retained',async()=>{
  const f=fixture(guest);
  const response=await f.messages.POST(new Request('http://localhost/messages',{method:'POST',body:JSON.stringify({body:'hello',guestId:other,nickname:'Spoofed'})}),ctx());
  assert.equal(response.status,201); const sent=await response.json();assert.equal(sent.senderId,guest);
  const body=await(await f.messages.GET(new Request('http://localhost/messages?cursor=0'),ctx())).json();
  assert.equal(body.nextCursor,1);assert.equal(body.messages[0].body,'hello');assert.equal(body.memberCount,2);
});

test('Worker: failed physical deletion never acknowledges metadata; retries use same path',async()=>{
  let fail=true,acknowledged=0;
  const paths=[];
  const admin={rpc:async(name)=>{
    if(name==='claim_room_file_cleanup')return{data:[{id:'file',storage_path:'room/file',cleanup_token:'lease'}],error:null};
    acknowledged++; return {error:null};
  },storage:{from:()=>({remove:async(p)=>{paths.push(p);return{error:fail?Error('unavailable'):null};}})}};
  assert.deepEqual(await jobs.cleanupRoomFiles(admin),{deleted:0,failed:1});assert.equal(acknowledged,0);
  fail=false;
  assert.deepEqual(await jobs.cleanupRoomFiles(admin),{deleted:1,failed:0});assert.equal(acknowledged,1);
  assert.deepEqual(paths,[['room/file'],['room/file']]);
});

test('Worker: Redis failure and lost acknowledgement keep outbox pending for retry',async()=>{
  const original=global.fetch;let redisFail=true,ackFail=false,acks=0,calls=0;
  const row={id:'f',room_id:roomId,name:'file',size:1,mime_type:'text/plain',uploaded_by:owner,nickname:'Admin',uploaded_at:new Date().toISOString(),expires_at:new Date(Date.now()+60_000).toISOString()};
  global.fetch=async(_url,init)=>{calls++;const command=JSON.parse(init.body);assert.equal(command[0],'EVAL');assert.equal(command[2],'3');return Response.json(redisFail?{error:'failed'}:{result:calls===2?1:0});};
  const admin={rpc:async()=>({data:[row],error:null}),from:()=>({update:()=>({eq:()=>({eq:async()=>{acks++;return{error:ackFail?Error('ack lost'):null};}})})})};
  try {
    assert.equal((await jobs.flushFileNotifications(admin,{url:'http://redis',token:'test'})).failed,1); assert.equal(acks,0);
    redisFail=false;ackFail=true;
    assert.equal((await jobs.flushFileNotifications(admin,{url:'http://redis',token:'test'})).failed,1);
    ackFail=false;
    assert.equal((await jobs.flushFileNotifications(admin,{url:'http://redis',token:'test'})).notified,1);
  } finally {global.fetch=original;}
});

test('DB listing: paginates beyond the Data API response cap',async()=>{
  const rows=Array.from({length:1001},(_,n)=>({id:String(n),room_id:roomId,size:1,uploaded_at:new Date().toISOString()}));
  let pages=0;
  const query={select(){return query;},eq(){return query;},order(){return query;},range:async(a,b)=>{pages++;return{data:rows.slice(a,b+1),error:null};}};
  const load=loader({'@/lib/supabase/admin':{createAdminClient:()=>({from:()=>query})}});
  const files=await load('src/lib/room-files.ts').listRoomFiles(roomId);
  assert.equal(files.length,1001);assert.equal(pages,3);assert.equal(files[1000].id,'1000');
});

test('Shared APIs: owner AAL1 denied while guest AAL1 chat/files stay usable',async()=>{
  const admin=fixture(owner); admin.state.aal='aal1';
  assert.equal((await admin.upload(uploadRequest(),ctx())).status,403);
  assert.equal((await admin.messages.GET(new Request('http://localhost/messages'),ctx())).status,403);
  assert.equal((await admin.download(new Request('http://localhost/file'),ctx(randomUUID()))).status,403);
  const member=fixture(guest);member.state.aal='aal1';
  const upload=await member.upload(uploadRequest(),ctx());assert.equal(upload.status,201);
  const body=await upload.json();
  assert.equal((await member.download(new Request('http://localhost/file'),ctx(body.file.id))).status,200);
  assert.equal((await member.messages.POST(new Request('http://localhost/messages',{method:'POST',body:JSON.stringify({body:'hello'})}),ctx())).status,201);
});
