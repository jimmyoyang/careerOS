import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { X509Certificate } from 'node:crypto';
import { provisionTls, validateHost } from './phone-bridge.mjs';

test('certificate host rejects command/config injection and public URL syntax', () => {
  for (const value of ['x\nsubjectAltName=DNS:evil', 'https://host', 'host/path', 'a;touch /tmp/x', '', '-bad', '0.0.0.0']) {
    assert.throws(() => validateHost(value));
  }
  assert.equal(validateHost('10.82.16.30'), '10.82.16.30');
  assert.equal(validateHost('desktop.tail-example.ts.net'), 'desktop.tail-example.ts.net');
});

test('generated certificate verifies hostname and reuses existing private key', () => {
  const dir = mkdtempSync(join(tmpdir(), 'careeros-tls-'));
  try {
    const config = provisionTls(dir, '10.82.16.30');
    const pem = readFileSync(config.cert);
    const cert = new X509Certificate(pem);
    assert.equal(cert.checkIP('10.82.16.30'), '10.82.16.30');
    assert.equal(cert.checkIP('10.82.16.31'), undefined);
    assert.equal(cert.verify(cert.publicKey), true);
    assert.equal(statSync(config.key).mode & 0o777, 0o600);
    assert.deepEqual(provisionTls(dir, '10.82.16.30'), config);
    assert.deepEqual(readFileSync(config.cert), pem);
    assert.throws(() => provisionTls(dir, '10.82.16.31'), /HOST_CHANGED/);
  } finally { rmSync(dir, {recursive:true,force:true}); }
});
