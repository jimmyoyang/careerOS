import http from 'node:http';
import https from 'node:https';
import QRCode from 'qrcode';
import { randomBytes, randomInt, randomUUID, createHash, timingSafeEqual, X509Certificate } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, renameSync, chmodSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WINDOW=120000, LEASE=15000, MAX_BODY=16384;
// Devices can be slightly ahead of the desktop. This does not extend a request's lifetime.
const MAX_CLOCK_LEAD=2000;
const terminal=new Set(['consumed','cancelled','expired']);
const hash=value=>createHash('sha256').update(value).digest('hex');
const token=()=>randomBytes(32).toString('base64url');
const equal=(a,b)=>typeof a==='string' && typeof b==='string' && Buffer.byteLength(a)===Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a),Buffer.from(b));
function fail(status,error){throw Object.assign(new Error(error),{status,error});}
function object(value,required,optional=[]){
  if(!value || typeof value!=='object' || Array.isArray(value) || Object.keys(value).some(k=>![...required,...optional].includes(k)) || required.some(k=>!Object.hasOwn(value,k)))fail(400,'INVALID_BODY');
}
function string(value,max=160){if(typeof value!=='string'||!value.trim()||value.length>max||/[\u0000-\u001f\u007f]/.test(value))fail(400,'INVALID_BODY');}
function integer(value,min,max){if(!Number.isSafeInteger(value)||value<min||value>max)fail(400,'INVALID_BODY');}
function atomic(path,value){const temp=`${path}.${randomUUID()}.tmp`;writeFileSync(temp,value,{mode:0o600,flag:'wx'});renameSync(temp,path);chmodSync(path,0o600);}
async function json(req){
  if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers['content-type']??''))fail(415,'JSON_REQUIRED');
  if(Number(req.headers['content-length'])>MAX_BODY)fail(413,'BODY_TOO_LARGE');
  const chunks=[];let size=0;
  for await(const part of req){size+=part.length;if(size>MAX_BODY)fail(413,'BODY_TOO_LARGE');chunks.push(part);}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{fail(400,'INVALID_JSON');}
}

export function createBridge(options={}){
  const now=options.now??Date.now;
  const stateDir=resolve(options.stateDir??'.local/phone-bridge');
  mkdirSync(stateDir,{recursive:true,mode:0o700});chmodSync(stateDir,0o700);
  const tokenFile=join(stateDir,'admin-token'), stateFile=join(stateDir,'devices.json');
  let adminToken=options.adminToken;
  if(!adminToken)adminToken=existsSync(tokenFile)?readFileSync(tokenFile,'utf8').trim():token();
  if(typeof adminToken!=='string'||adminToken.length<32||adminToken.length>256)throw new Error('INVALID_ADMIN_TOKEN');
  atomic(tokenFile,`${adminToken}\n`);
  let desktopId=randomUUID();const devices=new Map(),pairings=new Map(),challenges=new Map(),rates=new Map();
  if(existsSync(stateFile)){
    const saved=JSON.parse(readFileSync(stateFile,'utf8'));desktopId=saved.desktopId;
    if(typeof desktopId!=='string'||!Array.isArray(saved.devices)||saved.devices.length>100)throw new Error('INVALID_DEVICE_STORE');
    for(const d of saved.devices){if(!d||typeof d.deviceId!=='string'||typeof d.deviceName!=='string'||!(/^[a-f0-9]{64}$/.test(d.tokenHash)))throw new Error('INVALID_DEVICE_STORE');devices.set(d.deviceId,{deviceId:d.deviceId,deviceName:d.deviceName,tokenHash:d.tokenHash,active:true});}
  }
  function persist(){atomic(stateFile,JSON.stringify({desktopId,devices:[...devices.values()].filter(d=>d.active).map(({deviceId,deviceName,tokenHash})=>({deviceId,deviceName,tokenHash}))}));}
  persist();
  function clear(c,state){delete c.code;delete c.lease;c.state=state;}
  function sweep(){
    const t=now();
    for(const [id,p] of pairings)if(t>=p.expiresAt){if(p.deviceId&&!devices.get(p.deviceId)?.active)devices.delete(p.deviceId);pairings.delete(id);}
    for(const [id,c] of challenges){
      if(t>=c.expiresAt&&!terminal.has(c.state))clear(c,'expired');
      if(c.lease&&t>=c.lease.expiresAt){delete c.lease;c.state='ready';}
      if(terminal.has(c.state)&&t>=c.expiresAt+WINDOW)challenges.delete(id);
    }
    for(const [id,r] of rates)if(t>=r.until)rates.delete(id);
  }
  async function readBody(req){const body=await json(req);sweep();return body;}
  function revoke(d){devices.delete(d.deviceId);for(const c of challenges.values())if(c.deviceId===d.deviceId)clear(c,'cancelled');for(const [id,p] of pairings)if(p.deviceId===d.deviceId)pairings.delete(id);persist();}
  function limit(key,max=options.rateLimit??240){const t=now();const r=rates.get(key)??{count:0,until:t+60000};if(rates.size>=2000&&!rates.has(key))fail(429,'RATE_LIMITED');rates.set(key,r);if(++r.count>max)fail(429,'RATE_LIMITED');}
  function bearer(req){const v=req.headers.authorization;return typeof v==='string'&&/^Bearer [A-Za-z0-9_-]{32,256}$/.test(v)?v.slice(7):'';}
  function authenticate(req){const digest=hash(bearer(req));for(const d of devices.values())if(equal(d.tokenHash,digest))return d;fail(401,'UNAUTHORIZED');}
  function view(c){const {code,lease,...safe}=c;return safe;}
  function getChallenge(id){const c=challenges.get(id);if(!c)fail(404,'NOT_FOUND');return c;}
  function available(c){if(terminal.has(c.state))fail(409,'CHALLENGE_INACTIVE');}
  const routeId='([a-f0-9-]{36})';
  let adminServer,phoneServer,timer;
  const api={get adminPort(){return adminServer?.address()?.port;},get phonePort(){return phoneServer?.address()?.port;},desktopId,stateDir,
    async start(){
      if(adminServer)throw new Error('ALREADY_STARTED');
      if(!options.tls?.key||!options.tls?.cert)throw new Error('TLS_REQUIRED');
      adminServer=http.createServer(handler('admin'));
      phoneServer=https.createServer({...options.tls,minVersion:'TLSv1.2'},handler('phone'));
      for(const server of [adminServer,phoneServer]){server.requestTimeout=10000;server.headersTimeout=10000;server.keepAliveTimeout=3000;server.maxHeadersCount=40;server.setTimeout(10000,socket=>socket.destroy());}
      const listen=(server,port,host)=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,()=>{server.off('error',reject);resolve();});});
      try{await listen(adminServer,options.adminPort??4738,'127.0.0.1');await listen(phoneServer,options.phonePort??4739,options.phoneHost??'0.0.0.0');}catch(error){await api.close();throw error;}
      timer=setInterval(sweep,1000);timer.unref();return api;
    },
    async close(){clearInterval(timer);for(const c of challenges.values())clear(c,'cancelled');challenges.clear();pairings.clear();await Promise.all([adminServer,phoneServer].filter(Boolean).map(server=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();})));adminServer=undefined;phoneServer=undefined;}
  };
  function handler(kind){return async(req,res)=>{
    const headers={'Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'; base-uri 'none'"};
    function send(status,body){res.writeHead(status,headers);res.end(JSON.stringify(body));}
    try{
      sweep();limit(`${kind}:ip:${req.socket.remoteAddress}`);
      const path=req.url;
      if(typeof path!=='string'||path.length>256||!path.startsWith('/')||path.includes('?')||path.includes('#'))fail(404,'NOT_FOUND');
      if(kind==='admin'){
        const expected=`127.0.0.1:${api.adminPort}`;
        if(req.headers.host!==expected&&req.headers.host!==`localhost:${api.adminPort}`)fail(403,'HOST_FORBIDDEN');
        if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)fail(403,'ORIGIN_FORBIDDEN');
      }else if(req.headers.origin)fail(403,'ORIGIN_FORBIDDEN');
      if(kind==='admin'&&req.method==='GET'&&['/','/dashboard.js','/dashboard.css'].includes(path)){
        const name=path==='/'?'dashboard.html':path.slice(1);
        const type=path==='/'?'text/html':path.endsWith('.js')?'text/javascript':'text/css';
        res.writeHead(200,{...headers,'Content-Type':`${type}; charset=utf-8`});res.end(readFileSync(join(fileURLToPath(new URL('.',import.meta.url)),name)));return;
      }
      if(kind==='admin'){
        if(!equal(hash(bearer(req)),hash(adminToken)))fail(401,'UNAUTHORIZED');
        const body=await admin(req,path);send(200,body);
      }else{const body=await phone(req,path);send(200,body);}
    }catch(error){if(!res.headersSent)send(error.status??500,{error:error.error??'INTERNAL_ERROR'});else res.end();}
  };}
  async function admin(req,path){
    const method=req.method;let match;
    const publicConfig=()=>({desktopId,baseUrl:options.publicBaseUrl??`https://127.0.0.1:${api.phonePort}`,certificateDer:new X509Certificate(options.tls.cert).raw.toString('base64')});
    if(method==='GET'&&path==='/v1/config')return publicConfig();
    if(method==='POST'&&path==='/v1/qr'){
      limit(`qr:${req.socket.remoteAddress}`,20);
      const b=await readBody(req);object(b,['text']);string(b.text,6000);
      let payload;try{payload=JSON.parse(b.text);}catch{fail(400,'INVALID_BODY');}
      object(payload,['pairingId','secret','confirmationCode','desktopId','expiresAt','baseUrl','certificateDer']);
      string(payload.pairingId,36);string(payload.secret,100);
      const p=pairings.get(payload.pairingId),config=publicConfig();
      if(!p||!equal(p.secretHash,hash(payload.secret)))fail(401,'PAIRING_INVALID');
      if(p.deviceId)fail(409,'PAIRING_ALREADY_CLAIMED');
      if(payload.confirmationCode!==p.confirmationCode||payload.desktopId!==desktopId||payload.expiresAt!==p.expiresAt||payload.baseUrl!==config.baseUrl||payload.certificateDer!==config.certificateDer)fail(400,'PAIRING_MISMATCH');
      let dataUrl;try{dataUrl=await QRCode.toDataURL(b.text,{errorCorrectionLevel:'M',scale:4,margin:4});}catch{fail(400,'QR_PAYLOAD_TOO_LARGE');}
      sweep();if(!pairings.has(p.pairingId))fail(401,'PAIRING_INVALID');
      return {dataUrl};
    }
    if(method==='POST'&&path==='/v1/pairings'){
      object(await readBody(req),[]);if(pairings.size>=100||devices.size>=100)fail(429,'CAPACITY_REACHED');
      const p={pairingId:randomUUID(),secret:token(),confirmationCode:String(randomInt(100000,1000000)),desktopId,expiresAt:now()+WINDOW};
      pairings.set(p.pairingId,{...p,secret:undefined,secretHash:hash(p.secret)});return p;
    }
    if(method==='POST'&&(match=path.match(new RegExp(`^/v1/pairings/${routeId}/confirm$`)))){
      const b=await readBody(req);object(b,['confirmationCode']);string(b.confirmationCode,6);
      const p=pairings.get(match[1]);if(!p)fail(404,'NOT_FOUND');if(!p.deviceId)fail(409,'PAIRING_NOT_CLAIMED');
      if(!equal(p.confirmationCode,b.confirmationCode))fail(403,'CONFIRMATION_MISMATCH');
      const d=devices.get(p.deviceId);if(!d)fail(404,'NOT_FOUND');d.active=true;persist();pairings.delete(p.pairingId);return {ok:true};
    }
    if(method==='GET'&&path==='/v1/devices')return {devices:[...devices.values()].map(({deviceId,deviceName,active})=>({deviceId,deviceName,active}))};
    if(method==='DELETE'&&(match=path.match(new RegExp(`^/v1/devices/${routeId}$`)))){const d=devices.get(match[1]);if(!d)fail(404,'NOT_FOUND');revoke(d);return {ok:true};}
    if(method==='GET'&&path==='/v1/challenges')return {challenges:[...challenges.values()].map(view)};
    if(method==='POST'&&path==='/v1/challenges'){
      const b=await readBody(req);object(b,['deviceId','site','phoneKey','operationKey','sender','bodyMarker','codeLength'],['subscriptionId','senderMatch']);
      for(const key of ['deviceId','site','phoneKey','operationKey','sender','bodyMarker'])string(b[key],key==='bodyMarker'?200:160);
      integer(b.codeLength,4,10);if(b.subscriptionId!==undefined)integer(b.subscriptionId,0,2147483647);
      if(b.senderMatch!==undefined&&!['exact','prefix'].includes(b.senderMatch))fail(400,'INVALID_SENDER_RULE');
      if(b.senderMatch==='prefix'&&(b.sender!=='106'||b.site==='synthetic'))fail(400,'INVALID_SENDER_RULE');
      if(!devices.get(b.deviceId)?.active)fail(404,'NOT_FOUND');
      if(b.site==='synthetic'&&(b.sender!=='CareerOS'||b.bodyMarker!=='CareerOS-Test'||b.codeLength!==6))fail(400,'INVALID_SYNTHETIC_RULE');
      if(challenges.size>=1000)fail(429,'CAPACITY_REACHED');
      for(const c of challenges.values())if(c.site===b.site&&c.phoneKey===b.phoneKey&&!terminal.has(c.state))clear(c,'cancelled');
      const id=randomUUID(),createdAt=now();const c={...b,id,challengeId:id,desktopId,createdAt,expiresAt:createdAt+WINDOW,state:'awaiting_sms'};challenges.set(id,c);return view(c);
    }
    if(method==='DELETE'&&(match=path.match(new RegExp(`^/v1/challenges/${routeId}$`)))){clear(getChallenge(match[1]),'cancelled');return {ok:true};}
    if(method==='POST'&&(match=path.match(new RegExp(`^/v1/challenges/${routeId}/(claim|ack)$`)))){
      const action=match[2],b=await readBody(req);object(b,action==='claim'?['consumerId']:['consumerId','leaseId']);string(b.consumerId);
      if(action==='ack')string(b.leaseId,80);const c=getChallenge(match[1]);available(c);
      if(!c.code)fail(409,'CODE_NOT_READY');
      if(action==='claim'){
        if(c.lease&&c.lease.consumerId!==b.consumerId)fail(409,'LEASE_CONFLICT');
        if(!c.lease)c.lease={consumerId:b.consumerId,leaseId:token(),expiresAt:Math.min(now()+LEASE,c.expiresAt)};
        c.state='claimed';return {code:c.code,leaseId:c.lease.leaseId,expiresAt:c.lease.expiresAt};
      }
      if(!c.lease||c.lease.consumerId!==b.consumerId||!equal(c.lease.leaseId,b.leaseId))fail(409,'LEASE_CONFLICT');
      clear(c,'consumed');return {ok:true};
    }
    fail(404,'NOT_FOUND');
  }
  async function phone(req,path){
    const method=req.method;let match;
    if(method==='POST'&&path==='/v1/pairings/complete'){
      limit(`pair:${req.socket.remoteAddress}`,12);const b=await readBody(req);object(b,['pairingId','secret','deviceName']);string(b.pairingId,36);string(b.secret,100);string(b.deviceName,80);
      const p=pairings.get(b.pairingId);if(!p||!equal(p.secretHash,hash(b.secret)))fail(401,'PAIRING_INVALID');if(p.deviceId)fail(409,'PAIRING_ALREADY_CLAIMED');
      const deviceId=randomUUID(),credential=token();devices.set(deviceId,{deviceId,deviceName:b.deviceName,active:false,tokenHash:hash(credential)});p.deviceId=deviceId;
      return {deviceId,token:credential,desktopId,confirmationCode:p.confirmationCode};
    }
    const isDevice=path==='/v1/device'&&['GET','DELETE'].includes(method);
    const isActive=path==='/v1/challenges/active'&&method==='GET';
    const isCandidate=method==='POST'&&(match=path.match(new RegExp(`^/v1/challenges/${routeId}/candidates$`)));
    if(!isDevice&&!isActive&&!isCandidate)fail(404,'NOT_FOUND');
    const d=authenticate(req);
    if(isDevice){if(method==='DELETE'){revoke(d);return {ok:true};}return {deviceId:d.deviceId,deviceName:d.deviceName,desktopId,active:d.active};}
    if(!d.active)fail(403,'PAIRING_UNCONFIRMED');
    if(isActive)return {challenges:[...challenges.values()].filter(c=>c.deviceId===d.deviceId&&!terminal.has(c.state)).map(view)};
    const b=await readBody(req);object(b,['code','sender','bodyMarker','receivedAt','subscriptionId','source','confirmed']);
    string(b.code,10);string(b.sender);string(b.bodyMarker,200);integer(b.receivedAt,0,Number.MAX_SAFE_INTEGER);integer(b.subscriptionId,-1,2147483647);
    if(!['sms','manual','synthetic'].includes(b.source)||typeof b.confirmed!=='boolean')fail(400,'INVALID_BODY');
    const c=getChallenge(match[1]);if(c.deviceId!==d.deviceId)fail(404,'NOT_FOUND');available(c);
    if(c.state!=='awaiting_sms')fail(409,'CANDIDATE_ALREADY_ACCEPTED');
    const senderMatches=c.senderMatch==='prefix'?c.sender==='106'&&/^(?:\+86)?106[0-9]{3,20}$/.test(b.sender):b.sender===c.sender;
    if(!new RegExp(`^[0-9]{${c.codeLength}}$`).test(b.code)||!senderMatches||b.bodyMarker!==c.bodyMarker||b.receivedAt<c.createdAt||b.receivedAt>=c.expiresAt||b.receivedAt>now()+MAX_CLOCK_LEAD||(c.subscriptionId!==undefined&&c.subscriptionId!==b.subscriptionId))fail(400,'CANDIDATE_MISMATCH');
    if((b.source==='synthetic')!==(c.site==='synthetic'))fail(400,'SOURCE_MISMATCH');
    if(b.source!=='synthetic'&&!b.confirmed)fail(400,'CONFIRMATION_REQUIRED');
    c.code=b.code;c.state='ready';return {ok:true};
  }
  return api;
}
