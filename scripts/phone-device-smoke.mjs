// Runs only synthetic app tests on the selected, already authorized USB device.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const app='com.charles.careeros.companion';
const adb=process.env.ADB || `${process.env.ANDROID_HOME || `${process.env.HOME}/Documents/coding_file/server_monitor/data/toolchains/android-sdk`}/platform-tools/adb`;
const state=resolve(process.env.PHONE_BRIDGE_STATE_DIR||'data/phone-bridge');
const adminToken=readFileSync(`${state}/admin-token`,'utf8').trim();
const checks=[];
let testDevice;
function command(args,input){
 const prefix=process.env.ANDROID_SERIAL?['-s',process.env.ANDROID_SERIAL]:[];
 const p=spawnSync(adb,[...prefix,...args],{encoding:'utf8',input,timeout:90000,maxBuffer:1024*1024});
 if(p.status!==0)throw new Error(`ADB_FAILED ${args[0]}: ${(p.stderr||'').slice(0,200)}`);
 return p.stdout;
}
async function api(method,path,body){
 // Synchronous ADB tests pause Node's socket processing beyond the server's idle timeout.
 // Do not reuse a connection that may have been closed while instrumentation was running.
 const r=await fetch('http://127.0.0.1:4738'+path,{method,headers:{Connection:'close',Authorization:`Bearer ${adminToken}`,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(5000)});
 const result=await r.json();if(!r.ok)throw new Error(`BRIDGE_${r.status}_${result.error}`);return result;
}
function instrument(name){
 const output=command(['shell','am','instrument','-w','-e','class',`${app}.DeviceTests#${name}`,...(testDevice?['-e','deviceId',testDevice.deviceId]:[]),`${app}.test/android.test.InstrumentationTestRunner`]);
 if(!/OK \(1 test\)/.test(output))throw new Error(`DEVICE_TEST_FAILED ${name}: ${output.slice(-3000)}`);
 checks.push(name);console.log(`${name}: passed`);
}
async function challenge(site='synthetic'){
 return api('POST','/v1/challenges',{deviceId:testDevice.deviceId,site,phoneKey:'device-smoke',operationKey:crypto.randomUUID(),sender:'CareerOS',bodyMarker:'CareerOS-Test',codeLength:6});
}
async function main(){
 const installed=command(['shell','pm','path',app]);assert.match(installed,/package:/,'Install the companion APK first');
 const permissions=command(['shell','dumpsys','package',app]);
 for(const permission of ['android.permission.RECEIVE_SMS','android.permission.POST_NOTIFICATIONS']){
  if(!permissions.includes(`${permission}: granted=true`))throw new Error(`PERMISSION_REQUIRED ${permission}: 请在手机伴侣点击“授权接收新短信”并完成系统授权，然后重跑测试。`);
 }
 instrument('testManifestSecurity');
 if(process.env.PHONE_TEST_DEVICE_ID){
  testDevice=(await api('GET','/v1/devices')).devices.find(d=>d.deviceId===process.env.PHONE_TEST_DEVICE_ID && d.active);
  assert.ok(testDevice,'PHONE_TEST_DEVICE_ID must identify a confirmed device already paired on this phone');
 }else{
 const config=await api('GET','/v1/config');const pairing=await api('POST','/v1/pairings',{});
 const before=new Set((await api('GET','/v1/devices')).devices.map(d=>d.deviceId));
 command(['shell',`run-as ${app} mkdir -p files`]);
 command(['shell',`run-as ${app} sh -c 'cat > files/pairing-test.json'`],JSON.stringify({...config,...pairing}));
 instrument('testPairFromPrivateFile');
 testDevice=(await api('GET','/v1/devices')).devices.find(d=>!before.has(d.deviceId));assert.ok(testDevice);
 await api('POST',`/v1/pairings/${pairing.pairingId}/confirm`,{confirmationCode:pairing.confirmationCode});
 }
 instrument('testVerifyCredentialAndTls');
 instrument('testForegroundServiceLifecycle');
 await challenge();instrument('testStopClearsPendingCandidate');
 await challenge();instrument('testCachedSmsMatchesImmediately');
 await challenge();instrument('testSmsReceiverParser');
 const c=await challenge();instrument('testSyntheticCandidate');
 const lease=await api('POST',`/v1/challenges/${c.id}/claim`,{consumerId:'usb-device-smoke'});
 assert.equal(lease.code,'482731');delete lease.code;
 await api('POST',`/v1/challenges/${c.id}/ack`,{consumerId:'usb-device-smoke',leaseId:lease.leaseId});
 await assert.rejects(api('POST',`/v1/challenges/${c.id}/claim`,{consumerId:'other-consumer'}),/BRIDGE_409/);
 checks.push('phone HTTPS to desktop claim + ack + reject replay');
 const manual=await challenge('manual-smoke');instrument('testManualCandidate');
 const manualLease=await api('POST',`/v1/challenges/${manual.id}/claim`,{consumerId:'usb-manual-smoke'});
 assert.equal(manualLease.code,'482731');delete manualLease.code;
 await api('POST',`/v1/challenges/${manual.id}/ack`,{consumerId:'usb-manual-smoke',leaseId:manualLease.leaseId});
 checks.push('manual input with synthetic text + phone HTTPS + desktop claim/ack');
 command(['shell','am','force-stop',app]);
 instrument('testVerifyCredentialAndTls');checks.push('cold process credential persistence');
 command(['shell','am','start','-n',`${app}/.MainActivity`]);
 const result={passed:true,at:new Date().toISOString(),checks,deviceId:testDevice.deviceId,note:'Synthetic data only; real carrier SMS, physical QR scanning, locked-screen receipt and Tailscale not implied.'};
 mkdirSync('data/mobile-test',{recursive:true});writeFileSync('data/mobile-test/device-result.json',JSON.stringify(result,null,2));
 console.log('Device synthetic smoke passed; paired credential retained for use.');
}
main().catch(error=>{console.error(error.message);if(error.cause?.code)console.error(`Transport cause: ${error.cause.code}`);process.exitCode=1;}).finally(()=>{
 try{command(['shell',`run-as ${app} rm -f files/pairing-test.json`]);}catch{}
});
