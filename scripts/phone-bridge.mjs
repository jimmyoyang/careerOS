import { mkdirSync, readFileSync, writeFileSync, existsSync, chmodSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isIP } from 'node:net';
import { X509Certificate } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultState = join(root, 'data', 'phone-bridge');

export function validateHost(host) {
  if (typeof host !== 'string' || host.length > 253 || host === '0.0.0.0' ||
      (!isIP(host) && !/^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/.test(host))) {
    throw new Error('INVALID_HOST: 请提供手机可访问的电脑 IP 或主机名');
  }
  return host;
}

export function provisionTls(stateDir, host) {
  validateHost(host);
  mkdirSync(stateDir, { recursive: true, mode: 0o700 });
  chmodSync(stateDir, 0o700);
  const key = join(stateDir, 'bridge-key.pem');
  const cert = join(stateDir, 'bridge-cert.pem');
  const config = { host, key, cert, baseUrl: `https://${isIP(host) === 6 ? `[${host}]` : host}:4739` };
  if (existsSync(key) || existsSync(cert)) {
    if (!existsSync(key) || !existsSync(cert)) throw new Error('INCOMPLETE_CERTIFICATE');
    const current = new X509Certificate(readFileSync(cert));
    if (!(isIP(host) ? current.checkIP(host) : current.checkHost(host))) throw new Error('HOST_CHANGED: 保留旧证书，请使用新的 PHONE_BRIDGE_STATE_DIR 重新配对');
    if (Date.parse(current.validTo) < Date.now()) throw new Error('CERTIFICATE_EXPIRED: 请使用新的 PHONE_BRIDGE_STATE_DIR 重新配对');
    return config;
  }
  const conf = join(stateDir, 'openssl.cnf');
  writeFileSync(conf, `[req]\nprompt=no\ndistinguished_name=dn\nx509_extensions=ext\n[dn]\nCN=CareerOS Phone Bridge\n[ext]\nsubjectAltName=${isIP(host) ? 'IP' : 'DNS'}:${host},DNS:localhost,IP:127.0.0.1\nbasicConstraints=critical,CA:TRUE\nkeyUsage=critical,digitalSignature,keyEncipherment,keyCertSign\nextendedKeyUsage=serverAuth\n`, { mode: 0o600 });
  const result = spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-days', '30', '-config', conf, '-keyout', key, '-out', cert], { encoding: 'utf8', timeout: 30000 });
  if (result.status !== 0) throw new Error('TLS_PROVISION_FAILED: 请检查 openssl 是否可用');
  chmodSync(key, 0o600);
  chmodSync(cert, 0o600);
  return config;
}

function runningPid(stateDir) {
  const path = join(stateDir, 'bridge.pid');
  if (!existsSync(path)) return null;
  const pid = Number(readFileSync(path, 'utf8'));
  if (!Number.isInteger(pid) || pid < 2) return null;
  const p = spawnSync('ps', ['-p', String(pid), '-o', 'command='], { encoding: 'utf8' });
  return p.status === 0 && p.stdout.includes(join(root, 'services/phone-bridge/start.mjs')) ? pid : null;
}

async function main() {
  const [action = 'status', host] = process.argv.slice(2);
  const stateDir = resolve(process.env.PHONE_BRIDGE_STATE_DIR || defaultState);
  const configPath = join(stateDir, 'local-config.json');
  if (action === 'setup') {
    const config = provisionTls(stateDir, host);
    writeFileSync(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });
    console.log(`已生成 30 天有效的开发证书，手机入口 ${config.baseUrl}。私钥仅保存在 ${stateDir}。`);
    return;
  }
  if (action === 'stop') {
    const pid = runningPid(stateDir);
    if (pid) process.kill(pid, 'SIGTERM');
    if (existsSync(join(stateDir, 'bridge.pid'))) unlinkSync(join(stateDir, 'bridge.pid'));
    console.log(pid ? '已停止接码 Bridge；配对保留，内存验证码与请求清空。' : '没有找到此脚本启动的接码 Bridge。');
    return;
  }
  if (!existsSync(configPath)) throw new Error('请先运行 npm run phone:bridge -- setup <电脑IP>');
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  if (action === 'start') {
    if (runningPid(stateDir)) { console.log('接码 Bridge 已在运行。'); return; }
    provisionTls(stateDir, config.host);
    const log = openSync(join(stateDir, 'bridge.log'), 'a', 0o600);
    const child = spawn(process.execPath, [join(root, 'services/phone-bridge/start.mjs')], {
      cwd: root, detached: true, stdio: ['ignore', log, log],
      env: { ...process.env, PHONE_BRIDGE_STATE_DIR: stateDir, PHONE_BRIDGE_TLS_KEY: config.key, PHONE_BRIDGE_TLS_CERT: config.cert,
        PHONE_BRIDGE_PUBLIC_URL: config.baseUrl, PHONE_BRIDGE_PHONE_HOST: process.env.PHONE_BRIDGE_PHONE_HOST || '0.0.0.0' },
    });
    closeSync(log);
    child.unref();
    if (!child.pid) throw new Error('START_FAILED');
    writeFileSync(join(stateDir, 'bridge.pid'), String(child.pid), { mode: 0o600 });
    for (let attempt = 0; attempt < 25; attempt++) {
      await new Promise(r => setTimeout(r, 200));
      if (!runningPid(stateDir)) throw new Error('START_FAILED: 检查 data/phone-bridge/bridge.log');
      try {
        const response = await fetch('http://127.0.0.1:4738/', { signal: AbortSignal.timeout(500) });
        if (response.ok) { console.log(`接码 Bridge 已启动，手机入口 ${config.baseUrl}；使用 npm run phone:bridge -- open 打开管理页。`); return; }
      } catch {}
    }
    throw new Error('START_TIMEOUT: 检查 data/phone-bridge/bridge.log');
  }
  if (action === 'open') {
    const token = readFileSync(join(stateDir, 'admin-token'), 'utf8').trim();
    const url = `http://127.0.0.1:4738/#${token}`;
    const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer.exe' : 'xdg-open';
    const result = spawnSync(opener, [url], { stdio: 'ignore' });
    if (result.status !== 0) throw new Error('OPEN_FAILED');
    console.log('已打开本机接码管理页。');
    return;
  }
  if (action !== 'status') throw new Error('用法: setup <电脑IP> | start | status | open | stop');
  console.log(JSON.stringify({ running: !!runningPid(stateDir), phoneUrl: config.baseUrl, adminUrl: 'http://127.0.0.1:4738/', certificateExpires: new X509Certificate(readFileSync(config.cert)).validTo }, null, 2));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
