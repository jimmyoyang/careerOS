import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import https from 'node:https';
import http from 'node:http';
import { createBridge } from './bridge.mjs';

const certDir = mkdtempSync(join(tmpdir(), 'bridge-cert-'));
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', join(certDir, 'key.pem'), '-out', join(certDir, 'cert.pem'), '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=IP:127.0.0.1'], {stdio:'ignore'});
const tls = { key:readFileSync(join(certDir,'key.pem')), cert:readFileSync(join(certDir,'cert.pem')) };
test.after(()=>rmSync(certDir,{recursive:true,force:true}));
async function fixture(t, extra={}) {
  const stateDir=mkdtempSync(join(tmpdir(),'bridge-test-'));
  let time=1000000;
  const bridge=createBridge({stateDir, tls, adminToken:'a'.repeat(48), adminPort:0, phonePort:0, phoneHost:'127.0.0.1', now:()=>time, ...extra});
  await bridge.start();
  t.after(async()=>{await bridge.close();rmSync(stateDir,{recursive:true,force:true});});
  const admin=async(method,path,body,headers={})=>{
    const r=await fetch(`http://127.0.0.1:${bridge.adminPort}${path}`,{method,headers:{authorization:`Bearer ${'a'.repeat(48)}`,...(body===undefined?{}:{'content-type':'application/json'}),...headers},body:body===undefined?undefined:JSON.stringify(body)});
    return {status:r.status,body:await r.json()};
  };
  const phone=(method,path,body,token)=>new Promise((resolve,reject)=>{
    const req=https.request({hostname:'127.0.0.1',port:bridge.phonePort,path,method,ca:tls.cert,headers:{...(token?{authorization:`Bearer ${token}`}:{ }),...(body===undefined?{}:{'content-type':'application/json'})}},r=>{let data='';r.on('data',chunk=>data+=chunk);r.on('end',()=>resolve({status:r.statusCode,body:JSON.parse(data)}));});
    req.on('error',reject);req.end(body===undefined?undefined:JSON.stringify(body));
  });
  async function pair(confirm=true){
    const p=(await admin('POST','/v1/pairings',{})).body;
    const d=(await phone('POST','/v1/pairings/complete',{pairingId:p.pairingId,secret:p.secret,deviceName:'Test phone'})).body;
    if(confirm)assert.equal((await admin('POST',`/v1/pairings/${p.pairingId}/confirm`,{confirmationCode:d.confirmationCode})).status,200);
    return {...d,pairing:p};
  }
  const challenge=async(d,changes={})=>(await admin('POST','/v1/challenges',{deviceId:d.deviceId,site:'synthetic',phoneKey:'phone-1',operationKey:'operation-1',sender:'CareerOS',bodyMarker:'CareerOS-Test',codeLength:6,...changes})).body;
  const candidate=(c,d,changes={})=>phone('POST',`/v1/challenges/${c.id}/candidates`,{code:'123456',sender:c.sender,bodyMarker:c.bodyMarker,receivedAt:time,subscriptionId:-1,source:'synthetic',confirmed:true,...changes},d.token);
  return {bridge,admin,phone,pair,challenge,candidate,stateDir,advance:ms=>time+=ms};
}

test('pairing needs desktop confirmation, is single use, and persists only hashes',async t=>{
  const f=await fixture(t);const d=await f.pair(false);
  assert.equal((await f.phone('GET','/v1/device',undefined,d.token)).body.active,false);
  assert.equal((await f.phone('GET','/v1/challenges/active',undefined,d.token)).status,403);
  assert.equal((await f.phone('POST','/v1/pairings/complete',{pairingId:d.pairing.pairingId,secret:d.pairing.secret,deviceName:'replay'})).status,409);
  assert.equal((await f.admin('POST',`/v1/pairings/${d.pairing.pairingId}/confirm`,{confirmationCode:d.confirmationCode})).status,200);
  assert.equal((await f.phone('GET','/v1/device',undefined,d.token)).body.active,true);
  const state=readFileSync(join(f.stateDir,'devices.json'),'utf8');assert.equal(state.includes(d.token),false);assert.equal(state.includes(d.pairing.secret),false);
  assert.equal(statSync(join(f.stateDir,'devices.json')).mode&0o777,0o600);
  assert.equal(statSync(join(f.stateDir,'admin-token')).mode&0o777,0o600);
});

test('pairing expiration erases pending credential',async t=>{
  const f=await fixture(t);const d=await f.pair(false);f.advance(120001);
  assert.equal((await f.admin('POST',`/v1/pairings/${d.pairing.pairingId}/confirm`,{confirmationCode:d.confirmationCode})).status,404);
  assert.equal((await f.phone('GET','/v1/device',undefined,d.token)).status,401);
});

test('claim is exclusive, retryable during lease, acknowledged once and never listed',async t=>{
  const f=await fixture(t);const d=await f.pair();const c=await f.challenge(d);
  assert.equal((await f.candidate(c,d)).status,200);
  assert.equal(JSON.stringify((await f.admin('GET','/v1/challenges')).body).includes('123456'),false);
  const first=await f.admin('POST',`/v1/challenges/${c.id}/claim`,{consumerId:'browser-a'});assert.equal(first.body.code,'123456');
  assert.deepEqual((await f.admin('POST',`/v1/challenges/${c.id}/claim`,{consumerId:'browser-a'})).body,first.body);
  assert.equal((await f.admin('POST',`/v1/challenges/${c.id}/claim`,{consumerId:'browser-b'})).status,409);
  assert.equal((await f.admin('POST',`/v1/challenges/${c.id}/ack`,{consumerId:'browser-b',leaseId:first.body.leaseId})).status,409);
  assert.equal((await f.admin('POST',`/v1/challenges/${c.id}/ack`,{consumerId:'browser-a',leaseId:first.body.leaseId})).status,200);
  assert.equal((await f.admin('POST',`/v1/challenges/${c.id}/claim`,{consumerId:'browser-a'})).status,409);
  assert.equal(readFileSync(join(f.stateDir,'devices.json'),'utf8').includes('123456'),false);
});

test('candidate isolation enforces device, source, exact metadata, numeric length and confirmation',async t=>{
  const f=await fixture(t);const d=await f.pair();const other=await f.pair();const c=await f.challenge(d,{site:'real-site',sender:'106000',bodyMarker:'登录',subscriptionId:2});
  assert.equal((await f.candidate(c,other,{source:'sms',subscriptionId:2})).status,404);
  const bad=[{}, {source:'sms',confirmed:false},{source:'sms',sender:'106001'}, {source:'sms',bodyMarker:'other'}, {source:'sms',code:'1234567'}, {source:'sms',code:'12 456'}, {source:'sms',subscriptionId:1}, {source:'sms',receivedAt:c.createdAt-1}, {source:'sms',receivedAt:c.createdAt+2001}];
  for(const changes of bad)assert.notEqual((await f.candidate(c,d,{subscriptionId:2,...changes})).status,200);
  assert.equal((await f.candidate(c,d,{source:'sms',subscriptionId:2})).status,200);
  assert.equal((await f.candidate(c,d,{source:'sms',subscriptionId:2,code:'654321'})).status,409);
});

test('small phone clock lead is accepted without extending the request window',async t=>{
  const f=await fixture(t);const d=await f.pair();
  for(const lead of [850,2000]){
    const c=await f.challenge(d,{site:'clock-test',sender:'106000',bodyMarker:'登录'});
    assert.equal((await f.candidate(c,d,{source:'manual',receivedAt:c.createdAt+lead})).status,200);
  }
  const c=await f.challenge(d,{site:'clock-test',sender:'106000',bodyMarker:'登录'});
  assert.equal((await f.candidate(c,d,{source:'sms',receivedAt:c.createdAt+2001})).status,400);
  assert.equal((await f.candidate(c,d,{source:'sms',receivedAt:c.createdAt-1})).status,400);
  f.advance(119500);
  assert.equal((await f.candidate(c,d,{source:'sms',receivedAt:c.expiresAt})).status,400);
  f.advance(500);
  assert.equal((await f.candidate(c,d,{source:'sms',receivedAt:c.expiresAt-1})).status,409);
});

test('explicit 106 sender rule accepts changing service numbers but still requires signature and confirmation',async t=>{
  const f=await fixture(t);const d=await f.pair();
  for(const sender of ['106809645555654','106853078000067','+86106853078000067']){
    const c=await f.challenge(d,{site:'huawei',sender:'106',senderMatch:'prefix',bodyMarker:'【华为】'});
    assert.ok(c.id,'prefix challenge must be accepted');
    assert.equal((await f.candidate(c,d,{source:'sms',sender:'13800000000'})).status,400);
    assert.equal((await f.candidate(c,d,{source:'sms',sender:'106foo'})).status,400);
    assert.equal((await f.candidate(c,d,{source:'sms',sender,bodyMarker:'其他网站'})).status,400);
    assert.equal((await f.candidate(c,d,{source:'sms',sender,confirmed:false})).status,400);
    assert.equal((await f.candidate(c,d,{source:'sms',sender})).status,200);
  }
  for(const changes of [{sender:'1',senderMatch:'prefix'}, {sender:'106',senderMatch:'regex'}, {site:'synthetic',senderMatch:'prefix'}]){
    const response=await f.admin('POST','/v1/challenges',{deviceId:d.deviceId,site:'huawei',phoneKey:'p',operationKey:'o',sender:'106',senderMatch:'prefix',bodyMarker:'【华为】',codeLength:6,...changes});
    assert.equal(response.status,400);
  }
});

test('new site/phone request cancels old request; expiration and revocation destroy codes',async t=>{
  const f=await fixture(t);const d=await f.pair();const first=await f.challenge(d);await f.candidate(first,d);const second=await f.challenge(d);
  assert.equal((await f.admin('POST',`/v1/challenges/${first.id}/claim`,{consumerId:'test'})).status,409);
  assert.equal((await f.candidate(first,d)).status,409);
  await f.candidate(second,d);f.advance(120000);
  assert.equal((await f.admin('POST',`/v1/challenges/${second.id}/claim`,{consumerId:'test'})).status,409);
  const third=await f.challenge(d);await f.candidate(third,d);assert.equal((await f.admin('DELETE',`/v1/devices/${d.deviceId}`)).status,200);
  assert.equal((await f.phone('GET','/v1/device',undefined,d.token)).status,401);
  assert.equal((await f.admin('POST',`/v1/challenges/${third.id}/claim`,{consumerId:'test'})).status,409);
});

test('expired claim lease can be recovered but old ack cannot consume it',async t=>{
  const f=await fixture(t);const d=await f.pair();const c=await f.challenge(d);await f.candidate(c,d);
  const old=(await f.admin('POST',`/v1/challenges/${c.id}/claim`,{consumerId:'one'})).body;f.advance(15000);
  const next=(await f.admin('POST',`/v1/challenges/${c.id}/claim`,{consumerId:'two'})).body;assert.equal(next.code,'123456');assert.notEqual(next.leaseId,old.leaseId);
  assert.equal((await f.admin('POST',`/v1/challenges/${c.id}/ack`,{consumerId:'one',leaseId:old.leaseId})).status,409);
});

test('admin and phone route/auth domains and Origin are isolated',async t=>{
  const f=await fixture(t);const d=await f.pair();
  assert.equal((await f.admin('GET','/v1/devices',undefined,{authorization:''})).status,401);
  assert.equal((await f.admin('GET','/v1/devices',undefined,{authorization:`Bearer ${d.token}`})).status,401);
  assert.equal((await f.phone('GET','/v1/devices',undefined,'a'.repeat(48))).status,404);
  assert.equal((await f.phone('GET','/v1/device',undefined,'a'.repeat(48))).status,401);
  assert.equal((await f.admin('GET','/v1/devices',undefined,{origin:'https://evil.example'})).status,403);
  const hostileHost=await new Promise(resolve=>{http.get({hostname:'127.0.0.1',port:f.bridge.adminPort,path:'/v1/devices',headers:{host:'evil.example',authorization:`Bearer ${'a'.repeat(48)}`}},r=>{r.resume();resolve(r.statusCode);});});
  assert.equal(hostileHost,403);
  assert.equal((await f.admin('POST','/v1/pairings',{unexpected:true})).status,400);
  assert.equal((await f.admin('POST','/v1/pairings',[],{})).status,400);
  assert.equal((await f.admin('POST','/v1/pairings',{}, {'content-type':'text/plain'})).status,415);
});

test('restart keeps confirmed devices but restores no challenges or pending pairings',async t=>{
  const f=await fixture(t);const d=await f.pair();const pending=await f.pair(false);const c=await f.challenge(d);await f.candidate(c,d);await f.bridge.close();
  const next=createBridge({stateDir:f.stateDir,tls,adminPort:0,phonePort:0,phoneHost:'127.0.0.1'});await next.start();t.after(()=>next.close());
  const r=await fetch(`http://127.0.0.1:${next.adminPort}/v1/challenges`,{headers:{authorization:`Bearer ${'a'.repeat(48)}`}});assert.deepEqual((await r.json()).challenges,[]);
  const state=JSON.parse(readFileSync(join(f.stateDir,'devices.json'),'utf8'));assert.equal(state.devices.length,1);assert.equal(state.devices[0].deviceId,d.deviceId);assert.equal(JSON.stringify(state).includes(pending.token),false);
});

test('request limits reject oversized bodies and bounded pairing floods',async t=>{
  const f=await fixture(t,{rateLimit:20});
  assert.equal((await f.admin('POST','/v1/pairings',{padding:'x'.repeat(17000)})).status,413);
  let last;for(let i=0;i<25;i++)last=await f.admin('POST','/v1/pairings',{});assert.equal(last.status,429);
});

test('dashboard loads without secrets and authenticated config carries the server certificate',async t=>{
  const f=await fixture(t);
  const page=await fetch(`http://127.0.0.1:${f.bridge.adminPort}/`);assert.equal(page.status,200);const html=await page.text();assert.equal(html.includes('a'.repeat(48)),false);assert.match(html,/pairingText/);assert.match(page.headers.get('content-security-policy'),/frame-ancestors 'none'/);
  const script=await fetch(`http://127.0.0.1:${f.bridge.adminPort}/dashboard.js`);assert.equal(script.status,200);
  const config=await f.admin('GET','/v1/config');assert.equal(config.status,200);assert.ok(config.body.certificateDer.length>500);assert.equal(config.body.desktopId,f.bridge.desktopId);
});

test('malformed confirmation characters produce a safe client error',async t=>{
  const f=await fixture(t);const d=await f.pair(false);
  const response=await f.admin('POST',`/v1/pairings/${d.pairing.pairingId}/confirm`,{confirmationCode:'中文中文中文'});
  assert.equal(response.status,403);assert.deepEqual(response.body,{error:'CONFIRMATION_MISMATCH'});
});

test('QR generation is authenticated, local, and bound to the current pairing',async t=>{
  const f=await fixture(t);const p=(await f.admin('POST','/v1/pairings',{})).body;const config=(await f.admin('GET','/v1/config')).body;
  const text=JSON.stringify({...p,baseUrl:config.baseUrl,certificateDer:config.certificateDer});
  assert.equal((await f.admin('POST','/v1/qr',{text},{authorization:''})).status,401);
  assert.equal((await f.phone('POST','/v1/qr',{text},'a'.repeat(48))).status,404);
  const qr=await f.admin('POST','/v1/qr',{text});assert.equal(qr.status,200);assert.match(qr.body.dataUrl,/^data:image\/png;base64,/);
  const bytes=Buffer.from(qr.body.dataUrl.split(',')[1],'base64');assert.equal(bytes.subarray(1,4).toString(),'PNG');
  assert.equal((await f.admin('POST','/v1/qr',{text:JSON.stringify({...p,baseUrl:'https://evil.example',certificateDer:config.certificateDer})})).status,400);
  assert.equal((await f.admin('POST','/v1/qr',{text:JSON.stringify({...p,secret:'x'.repeat(43),baseUrl:config.baseUrl,certificateDer:config.certificateDer})})).status,401);
  assert.equal((await f.admin('POST','/v1/qr',{text:'x'.repeat(6001)})).status,400);
  f.advance(120000);assert.equal((await f.admin('POST','/v1/qr',{text})).status,401);
});
