/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { loader } = require('./file-storage-loader.cjs');

test('Security: Unicode filenames, controls, MIME validation and forced safe headers',()=>{
  const {cleanFileName,validatedMime,downloadHeaders}=loader()('src/lib/file-validation.ts');
  const name=cleanFileName('../bad\r\n"\\\0'+ '😀'.repeat(130));
  assert.ok(Array.from(name).length<=120);
  assert.doesNotMatch(name,/[\/\\\r\n\0]/);
  assert.doesNotThrow(()=>encodeURIComponent(name));
  assert.equal(validatedMime('text/html\r\nX-Evil: yes',new Uint8Array()),null);
  assert.equal(validatedMime('image/png',new TextEncoder().encode('<html>')), 'application/octet-stream');
  for(const mimeType of ['text/html','image/svg+xml','application/pdf','application/javascript']) {
    const headers=downloadHeaders({name,size:3,mimeType},false);
    assert.match(headers['Content-Disposition'],/^attachment/);
    assert.equal(headers['Content-Type'],'application/octet-stream');
    assert.equal(headers['X-Content-Type-Options'],'nosniff');
  }
});

test('Security: maintenance function rejects missing/wrong/user credentials before DB access',async()=>{
  const source=fs.readFileSync('supabase/functions/room-file-maintenance/index.js','utf8')
    .replace(/^import .*;\r?\n/gm,'');
  let handler,dbCalls=0;
  const secret='s'.repeat(64);
  const context={
    Deno:{env:{get:(name)=>name==='FILE_MAINTENANCE_SECRET'?secret:'test'},serve:(fn)=>{handler=fn;}},
    crypto:global.crypto,TextEncoder,Uint8Array,Response,AbortSignal,fetch,
    createClient:()=>{dbCalls++;return{};},
    cleanupRoomFiles:async()=>({deleted:0,failed:0}),flushFileNotifications:async()=>({notified:0,failed:0}),
  };
  vm.runInNewContext(source,context);
  for(const headers of [{},{Authorization:'Bearer user-jwt'},{'x-file-maintenance-secret':'wrong'}]) {
    assert.equal((await handler(new Request('http://local/f',{method:'POST',headers}))).status,401);
  }
  assert.equal(dbCalls,0);
  assert.equal((await handler(new Request('http://local/f',{headers:{'x-file-maintenance-secret':secret}}))).status,405);
  assert.equal(dbCalls,0);
  assert.equal((await handler(new Request('http://local/f',{method:'POST',headers:{'x-file-maintenance-secret':secret}}))).status,200);
  assert.equal(dbCalls,1);
});
