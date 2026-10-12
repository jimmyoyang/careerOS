'use strict';
const $=id=>document.getElementById(id);
let credential='',config,pairing,connected=false,purgeTimer,pairExpiryTimer;
const consumerId=crypto.randomUUID();
const fragment=location.hash.slice(1);
if(fragment){$('adminToken').value=fragment.startsWith('token=')?decodeURIComponent(fragment.slice(6)):fragment;history.replaceState(null,'',location.pathname);}
async function api(method,path,body){
  const response=await fetch(path,{method,cache:'no-store',headers:{Authorization:`Bearer ${credential}`,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
  const result=await response.json();if(!response.ok)throw new Error(result.error??'REQUEST_FAILED');return result;
}
function status(message){$('status').textContent=message;}
function run(fn){return async()=>{try{await fn();}catch(error){status(`操作未完成：${error.message}`);}};}
function erasePairing(){clearTimeout(pairExpiryTimer);$('pairingQr').removeAttribute('src');$('pairingQr').hidden=true;pairing=undefined;$('pairingText').value='';$('confirmationCode').value='';$('pairingInfo').textContent='';}
async function refresh(){
  if(!connected)return;
  const [devices,list]=await Promise.all([api('GET','/v1/devices'),api('GET','/v1/challenges')]);
  const selected=$('device').value;$('device').replaceChildren();
  for(const d of devices.devices){const option=document.createElement('option');option.value=d.deviceId;option.textContent=`${d.deviceName} · ${d.active?'已确认':'等待确认'} · ${d.deviceId.slice(0,8)}`;$('device').append(option);}
  if([...$('device').options].some(o=>o.value===selected))$('device').value=selected;
  $('challenges').replaceChildren();
  for(const c of list.challenges.slice().reverse()){
    const row=document.createElement('article'),info=document.createElement('p');
    info.textContent=`${c.site} · ${c.phoneKey} · ${c.state} · 剩余 ${Math.max(0,Math.ceil((c.expiresAt-Date.now())/1000))} 秒 · ${c.id.slice(0,8)}`;row.append(info);
    if(['ready','claimed'].includes(c.state)){
      const claim=document.createElement('button');claim.textContent='回填并确认消费';claim.onclick=run(async()=>{
        const lease=await api('POST',`/v1/challenges/${c.id}/claim`,{consumerId});
        $('testCode').value=lease.code;delete lease.code;clearTimeout(purgeTimer);purgeTimer=setTimeout(()=>{$('testCode').value='';},15000);
        await api('POST',`/v1/challenges/${c.id}/ack`,{consumerId,leaseId:lease.leaseId});status('本地输入框已回填，Bridge 已消费并擦除验证码。');await refresh();
      });row.append(claim);
    }
    if(['awaiting_sms','ready','claimed'].includes(c.state)){const cancel=document.createElement('button');cancel.textContent='取消请求';cancel.onclick=run(async()=>{await api('DELETE',`/v1/challenges/${c.id}`);await refresh();});row.append(cancel);}
    $('challenges').append(row);
  }
  if(pairing&&Date.now()>=pairing.expiresAt){erasePairing();status('配对已过期，请重新创建。');}
}
$('connect').onclick=run(async()=>{credential=$('adminToken').value.trim();config=await api('GET','/v1/config');$('adminToken').value='';connected=true;$('desktop').textContent=`桌面 ${config.desktopId} · 手机入口 ${config.baseUrl}`;status('已连接桌面 Bridge。');await refresh();});
$('createPairing').onclick=run(async()=>{
  if(!config)throw new Error('请先连接');erasePairing();pairing=await api('POST','/v1/pairings',{});
  const current=pairing;
  $('pairingText').value=JSON.stringify({...current,baseUrl:config.baseUrl,certificateDer:config.certificateDer});
  $('pairingInfo').textContent=`校验串 ${current.confirmationCode} · 桌面 ${current.desktopId}`;
  pairExpiryTimer=setTimeout(()=>{if(pairing?.pairingId===current.pairingId){erasePairing();status('配对已过期，请重新创建。');}},Math.max(0,current.expiresAt-Date.now()));
  status('在手机扫描二维码或导入配对文本，然后核对两端校验串。');
  const qr=await api('POST','/v1/qr',{text:$('pairingText').value});
  if(pairing?.pairingId===current.pairingId&&Date.now()<current.expiresAt){$('pairingQr').src=qr.dataUrl;$('pairingQr').hidden=false;}
});
$('confirmPairing').onclick=run(async()=>{if(!pairing)throw new Error('请先创建配对');await api('POST',`/v1/pairings/${pairing.pairingId}/confirm`,{confirmationCode:$('confirmationCode').value.trim()});erasePairing();status('手机配对已确认。');await refresh();});
$('refresh').onclick=run(refresh);
$('revoke').onclick=run(async()=>{if(!$('device').value)throw new Error('请先选择设备');await api('DELETE',`/v1/devices/${$('device').value}`);$('testCode').value='';status('设备凭据已撤销，相关请求已取消。');await refresh();});
$('mode').onchange=()=>{$('realRules').hidden=$('mode').value!=='real';};
$('createChallenge').onclick=run(async()=>{
  if(!$('device').value)throw new Error('请先配对手机');const synthetic=$('mode').value==='synthetic',huawei=$('mode').value==='huawei';
  const body={deviceId:$('device').value,site:synthetic?'synthetic':huawei?'huawei':$('site').value.trim(),phoneKey:$('phoneKey').value.trim(),operationKey:crypto.randomUUID(),sender:synthetic?'CareerOS':huawei?'106':$('sender').value.trim(),bodyMarker:synthetic?'CareerOS-Test':huawei?'【华为】':$('bodyMarker').value.trim(),codeLength:synthetic||huawei?6:Number($('codeLength').value)};
  if(huawei)body.senderMatch='prefix';
  if(!synthetic&&!huawei&&$('subscriptionId').value!=='')body.subscriptionId=Number($('subscriptionId').value);
  await api('POST','/v1/challenges',body);status(synthetic?'已创建合成请求，请在手机点击合成测试。':'等手机显示当前请求后，再自行触发真实短信并在手机确认候选。');await refresh();
});
setInterval(()=>{if(connected)refresh().catch(error=>status(`刷新失败：${error.message}`));},3000);
window.addEventListener('pagehide',()=>{$('testCode').value='';erasePairing();credential='';});
if($('adminToken').value)$('connect').click();
