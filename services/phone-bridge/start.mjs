import { readFileSync } from 'node:fs';
import { createBridge } from './bridge.mjs';

function port(name,fallback){const raw=process.env[name];const n=raw===undefined?fallback:Number(raw);if(!Number.isInteger(n)||n<1||n>65535)throw new Error('INVALID_PORT');return n;}
try{
  const key=process.env.PHONE_BRIDGE_TLS_KEY,cert=process.env.PHONE_BRIDGE_TLS_CERT;
  if(!key||!cert)throw new Error('TLS_PATHS_REQUIRED');
  const bridge=createBridge({
    stateDir:process.env.PHONE_BRIDGE_STATE_DIR??'data/phone-bridge',
    tls:{key:readFileSync(key),cert:readFileSync(cert)},
    adminPort:port('PHONE_BRIDGE_ADMIN_PORT',4738),phonePort:port('PHONE_BRIDGE_PHONE_PORT',4739),
    phoneHost:process.env.PHONE_BRIDGE_PHONE_HOST??'0.0.0.0',publicBaseUrl:process.env.PHONE_BRIDGE_PUBLIC_URL
  });
  await bridge.start();
  console.log(`Phone Bridge started. Desktop http://127.0.0.1:${bridge.adminPort}; HTTPS phone port ${bridge.phonePort}.`);
  const stop=async()=>{await bridge.close();process.exit(0);};
  process.once('SIGINT',stop);process.once('SIGTERM',stop);
}catch{
  console.error('Phone Bridge startup failed. Check TLS files, ports, and state directory.');process.exitCode=1;
}
