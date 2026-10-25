/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loader } = require('./file-storage-loader.cjs');

const userId='00000000-0000-4000-8000-000000000002';
const verified={id:'verified-totp',factor_type:'totp',status:'verified',friendly_name:'Authenticator'};
const pending={id:'pending-totp',factor_type:'totp',status:'unverified',friendly_name:'KumoTalk pending'};

function fixture() {
  const state={user:{id:userId,is_anonymous:false,factors:[]},aal:'aal1',claimsError:false,live:true,liveError:false,
    wrongCode:false,challengeCalls:[],enrollCalls:[],removed:[],dbCalls:0};
  const client={
    auth:{
      getUser:async()=>({data:{user:state.user},error:null}),
      getClaims:async()=>({data:state.claimsError?null:{claims:{sub:state.claimSub??userId,aal:state.aal}},error:state.claimsError?Error('invalid JWT'):null}),
      signInWithPassword:async()=>({error:null}),
      exchangeCodeForSession:async()=>({error:null}),
      mfa:{
        enroll:async(params)=>{state.enrollCalls.push(params);state.user.factors.push(pending);return {data:{id:pending.id,type:'totp',totp:{qr_code:'data:image/svg+xml;utf-8,<svg/>',secret:'test-only-secret'}},error:null};},
        unenroll:async({factorId})=>{state.removed.push(factorId);return {error:null};},
        challengeAndVerify:async(params)=>{
          state.challengeCalls.push(params);
          if(state.wrongCode)return {error:{code:'mfa_verification_failed'}};
          state.aal='aal2';state.user.factors=state.user.factors.map(f=>f.id===params.factorId?{...f,status:'verified'}:f);
          return {error:null};
        },
      },
    },
    rpc:async(name)=>{assert.equal(name,'admin_mfa_session_is_live');return {data:state.live,error:state.liveError?Error('down'):null};},
    from:()=>{state.dbCalls++;throw Error('unauthorized DB access');},
  };
  const redirect=(path)=>{throw Object.assign(Error('redirect'),{destination:path});};
  const load=loader({
    '@/lib/supabase/server':{createClient:async()=>client},
    'next/navigation':{redirect},
    'next/cache':{revalidatePath:()=>{}},
    '@/lib/invite':{ensureTodayInvite:()=>{throw Error('must not issue invite');}},
    '@/lib/redis-messages':{getRoomHeats:()=>{throw Error('must not read Redis');}},
  });
  return {state,client,load};
}
async function redirected(fn,path){await assert.rejects(fn,e=>e.destination===path);}
function form(values){const data=new FormData();for(const [k,v]of Object.entries(values))data.set(k,v);return data;}

test('MFA: verified JWT + live session + verified TOTP required, anonymous users excluded',async()=>{
  const {state,client,load}=fixture();const {adminMfaState}=load('src/lib/admin-mfa.ts');
  assert.equal(await adminMfaState(client,null),'login');
  assert.equal(await adminMfaState(client,{id:userId,is_anonymous:true}),'login');
  assert.equal(await adminMfaState(client,state.user),'enroll');
  state.user.factors=[verified];assert.equal(await adminMfaState(client,state.user),'verify');
  state.aal='aal2';assert.equal(await adminMfaState(client,state.user),'ready');
  state.live=false;assert.equal(await adminMfaState(client,state.user),'login');
  state.live=true;state.claimsError=true;await assert.rejects(adminMfaState(client,state.user));
  state.claimsError=false;state.claimSub='different-user';await assert.rejects(adminMfaState(client,state.user));
  state.claimSub=userId;state.liveError=true;await assert.rejects(adminMfaState(client,state.user));
});

test('MFA: an AAL2 token without a current TOTP factor cannot bypass reenrollment',async()=>{
  const {state,client,load}=fixture();state.aal='aal2';state.user.factors=[{...verified,factor_type:'phone'}];
  assert.equal(await load('src/lib/admin-mfa.ts').adminMfaState(client,state.user),'enroll');
});

test('MFA: password login routes new and existing administrators to enrollment/challenge',async()=>{
  const f=fixture();const {login}=f.load('src/app/(auth)/login/actions.ts');
  const data=form({email:'admin@example.test',password:'password'});
  await redirected(()=>login({},data),'/signup/totp');
  f.state.user.factors=[verified];await redirected(()=>login({},data),'/login/verify');
});

test('MFA: enrollment requires first factor, returns real provider QR and never removes verified factors',async()=>{
  const f=fixture();f.state.user.factors=[pending];
  const actions=f.load('src/app/(auth)/signup/totp/actions.ts');
  const result=await actions.startTotpEnrollment();
  assert.equal(result.enrollment.factorId,pending.id);assert.match(result.enrollment.qrCode,/^data:image\/svg\+xml/);
  assert.equal(f.state.enrollCalls[0].issuer,'KumoTalk');assert.deepEqual(f.state.removed,[pending.id]);
  f.state.user.factors=[verified];await redirected(()=>actions.startTotpEnrollment(),'/login/verify');
  assert.deepEqual(f.state.removed,[pending.id]);
  f.state.user.is_anonymous=true;await redirected(()=>actions.startTotpEnrollment(),'/login');
});

test('MFA: initial verify checks factor ownership/status and validates six digits before provider call',async()=>{
  const f=fixture();f.state.user.factors=[pending];const {verifyTotpEnrollment:verify}=f.load('src/app/(auth)/signup/totp/actions.ts');
  assert.ok((await verify(pending.id,{},form({code:'abc',factorId:pending.id}))).error);assert.equal(f.state.challengeCalls.length,0);
  assert.ok((await verify('other-users-factor',{},form({code:'123456'}))).error);assert.equal(f.state.challengeCalls.length,0);
  f.state.wrongCode=true;assert.ok((await verify(pending.id,{},form({code:'123456',factorId:pending.id}))).error);
  assert.equal(f.state.aal,'aal1');
  f.state.wrongCode=false;await redirected(()=>verify(pending.id,{},form({code:'123456',factorId:pending.id})),'/dashboard');
  assert.equal(f.state.aal,'aal2');
});

test('MFA: login challenge accepts only owned verified TOTP and stays blocked after wrong code',async()=>{
  const f=fixture();f.state.user.factors=[verified,pending];const {verifyLoginCode:verify}=f.load('src/app/(auth)/login/verify/actions.ts');
  assert.ok((await verify(pending.id,{},form({code:'123456'}))).error);assert.equal(f.state.challengeCalls.length,0);
  f.state.wrongCode=true;assert.ok((await verify(verified.id,{},form({code:'123456',factorId:verified.id}))).error);
  f.state.wrongCode=false;await redirected(()=>verify(verified.id,{},form({code:'123456',factorId:verified.id})),'/dashboard');
});

test('MFA: admin Server Actions deny AAL1 before mutations',async()=>{
  const f=fixture();f.state.user.factors=[verified];
  const update=f.load('src/app/(admin)/rooms/[roomId]/settings/actions.ts').updateRoomPeriod;
  await redirected(()=>update({},form({roomId:'room',startDate:'2026-10-26',endDate:'2026-10-27'})),'/login/verify');
  assert.equal(f.state.dbCalls,0);
  const create=f.load('src/app/(admin)/rooms/new/actions.ts').createRoom;
  await redirected(()=>create({},form({name:'test',startDate:'2099-01-01',endDate:'2099-01-02'})),'/login/verify');
  assert.equal(f.state.dbCalls,0);
  const requireAdmin=f.load('src/lib/admin-authorization.ts').requireAdminAal2;
  f.state.aal='aal2';assert.equal((await requireAdmin()).user.id,userId);
  f.state.live=false;await redirected(()=>requireAdmin(),'/login');
});

test('MFA: admin heat API rejects AAL1 and anonymous users, fails closed on claims outage',async()=>{
  const f=fixture();f.state.user.factors=[verified];const get=f.load('src/app/api/rooms/heat/route.ts').GET;
  assert.equal((await get()).status,403);assert.equal(f.state.dbCalls,0);
  f.state.claimsError=true;assert.equal((await get()).status,503);
  f.state.user.is_anonymous=true;assert.equal((await get()).status,401);
});

test('MFA: callback cannot skip MFA or redirect to an external origin',async()=>{
  const f=fixture();const get=f.load('src/app/auth/callback/route.ts').GET;
  let response=await get(new Request('https://local/auth/callback?code=test&next=//evil.example'));
  assert.equal(response.headers.get('location'),'https://local/signup/totp');
  f.state.user.factors=[verified];f.state.aal='aal2';
  response=await get(new Request('https://local/auth/callback?code=test&next=//evil.example'));
  assert.equal(response.headers.get('location'),'https://local/dashboard');
  const {safeAuthNext}=f.load('src/lib/admin-mfa.ts');
  for(const path of ['//evil.example','/\\evil.example','https://evil.example'])assert.equal(safeAuthNext(path),'/dashboard');
  assert.equal(safeAuthNext('/rooms/new'),'/rooms/new');
});

test('MFA: proxy redirects protected pages while preserving all refreshed cookie chunks',async()=>{
  const {NextRequest}=require('next/server');const f=fixture();f.state.user.factors=[verified];
  const load=loader({'@supabase/ssr':{createServerClient:(_url,_key,options)=>{
    options.cookies.setAll([{name:'session.0',value:'first',options:{path:'/'}},{name:'session.1',value:'second',options:{path:'/'}}]);
    return f.client;
  }}});
  const {middleware:proxy}=load('middleware.ts');
  for(const path of ['/dashboard','/rooms/new','/rooms/example/settings']){
    const response=await proxy(new NextRequest('http://localhost'+path));
    assert.equal(response.headers.get('location'),'http://localhost/login/verify');
    assert.equal(response.cookies.get('session.0').value,'first');assert.equal(response.cookies.get('session.1').value,'second');
  }
});

test('MFA: proxy does not challenge guest chat/files, and enrollment responses are not cacheable',async()=>{
  const {NextRequest}=require('next/server');const f=fixture();f.state.user.is_anonymous=true;
  f.client.auth.getClaims=()=>{throw Error('must not check guest AAL');};
  const load=loader({'@supabase/ssr':{createServerClient:()=>f.client}});const {middleware:proxy}=load('middleware.ts');
  for(const path of ['/join/invite','/rooms/example','/api/rooms/example/messages','/api/rooms/example/files/file']){
    const response=await proxy(new NextRequest('http://localhost'+path));assert.equal(response.headers.get('location'),null);
  }
  const response=await proxy(new NextRequest('http://localhost/signup/totp'));
  assert.match(response.headers.get('cache-control'),/no-store/);
});

test('MFA: backup enrollment, rotation and removal require AAL2; last or foreign factor cannot be removed',async()=>{
  const f=fixture();f.state.user.factors=[verified];
  const actions=f.load('src/app/(auth)/signup/totp/actions.ts');
  await redirected(()=>actions.addTotpFactor(),'/login/verify');
  await redirected(()=>actions.removeTotpFactor(verified.id),'/login/verify');
  f.state.aal='aal2';
  assert.ok((await actions.removeTotpFactor(verified.id)).error);
  assert.ok((await actions.removeTotpFactor('foreign-id')).error);assert.equal(f.state.removed.length,0);
  const added=await actions.addTotpFactor();assert.ok(added.enrollment);
  assert.ok((await actions.verifyAdditionalTotpFactor('foreign-id','123456')).error);
  assert.deepEqual(await actions.verifyAdditionalTotpFactor(pending.id,'123456'),{success:true});
  assert.deepEqual(await actions.removeTotpFactor(verified.id),{success:true});
  assert.deepEqual(f.state.removed,[verified.id]);
});
