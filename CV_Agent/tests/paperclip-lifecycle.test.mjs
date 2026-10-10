import assert from 'node:assert/strict';
import { chmod, cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scriptNames = [
  'paperclip-start.sh',
  'paperclip-status.sh',
  'paperclip-stop.sh',
];
const validHealth = JSON.stringify({ status: 'ok', deploymentMode: 'local_trusted' });

const fakeCommands = {
  lsof: `#!/bin/zsh
if [[ -n "\${PAPERCLIP_FAKE_LSOF_OUTPUT:-}" ]]; then
  printf '%s\\n' "$PAPERCLIP_FAKE_LSOF_OUTPUT"
  exit 0
fi
exit 1
`,
  curl: `#!/bin/zsh
if [[ -n "\${PAPERCLIP_FAKE_CURL_EXIT:-}" ]]; then
  exit "$PAPERCLIP_FAKE_CURL_EXIT"
fi
printf '%s' "\${PAPERCLIP_FAKE_CURL_BODY:-}"
`,
  ps: `#!/bin/zsh
if [[ -n "\${PAPERCLIP_FAKE_PS_COMMAND_FILE:-}" && -s "$PAPERCLIP_FAKE_PS_COMMAND_FILE" ]]; then
  cat "$PAPERCLIP_FAKE_PS_COMMAND_FILE"
  exit 0
fi
if [[ -n "\${PAPERCLIP_FAKE_PS_COMMAND:-}" ]]; then
  printf '%s\\n' "$PAPERCLIP_FAKE_PS_COMMAND"
  exit 0
fi
exit 1
`,
  kill: `#!/bin/zsh
if [[ "$1" == "-0" ]]; then
  exit "\${PAPERCLIP_FAKE_KILL0_EXIT:-0}"
fi
if [[ -n "\${PAPERCLIP_FAKE_KILL_LOG:-}" ]]; then
  printf '%s\\n' "$*" >> "$PAPERCLIP_FAKE_KILL_LOG"
fi
if [[ "\${PAPERCLIP_FAKE_KILL_CLEAR_PS:-0}" == "1" && -n "\${PAPERCLIP_FAKE_PS_COMMAND_FILE:-}" ]]; then
  : > "$PAPERCLIP_FAKE_PS_COMMAND_FILE"
fi
exit 0
`,
  sleep: `#!/bin/zsh
exit 0
`,
};

async function createWorkspace() {
  const root = await mkdtemp(path.join(tmpdir(), 'paperclip-lifecycle-'));
  const scriptsDir = path.join(root, 'scripts');
  const binDir = path.join(root, 'fake-bin');
  const dataDir = path.join(root, '.runtime', 'paperclip');
  const cli = path.join(root, '.runtime', 'paperclip-cli', 'node_modules', 'paperclipai', 'dist', 'index.js');
  await mkdir(scriptsDir, { recursive: true });
  await mkdir(binDir, { recursive: true });
  await mkdir(path.dirname(cli), { recursive: true });

  for (const name of scriptNames) {
    const source = path.join(repositoryRoot, 'scripts', name);
    const destination = path.join(scriptsDir, name);
    await cp(source, destination);
    await chmod(destination, 0o755);
  }

  const commandPaths = {};
  for (const [name, contents] of Object.entries(fakeCommands)) {
    const commandPath = path.join(binDir, name);
    await writeFile(commandPath, contents, 'utf8');
    await chmod(commandPath, 0o755);
    commandPaths[name] = commandPath;
  }

  await writeFile(cli, `
const fs = require('node:fs');
const output = process.env.PAPERCLIP_TEST_ARGS_FILE;
if (output) fs.writeFileSync(output, JSON.stringify(process.argv.slice(2)));
if (process.env.PAPERCLIP_TEST_SECRET) console.log(process.env.PAPERCLIP_TEST_SECRET);
`, 'utf8');

  return {
    root,
    scriptsDir,
    dataDir,
    cli,
    pidFile: path.join(dataDir, 'server.pid'),
    sentinel: path.join(root, 'unrelated-sentinel.txt'),
    argsFile: path.join(root, 'start-args.json'),
    psCommandFile: path.join(root, 'fake-ps-command.txt'),
    killLog: path.join(root, 'fake-kill.log'),
    commandPaths,
  };
}

function baseEnvironment(workspace) {
  return {
    PAPERCLIP_CURL_BIN: workspace.commandPaths.curl,
    PAPERCLIP_KILL_BIN: workspace.commandPaths.kill,
    PAPERCLIP_LSOF_BIN: workspace.commandPaths.lsof,
    PAPERCLIP_NODE_BIN: process.execPath,
    PAPERCLIP_PS_BIN: workspace.commandPaths.ps,
    PAPERCLIP_SLEEP_BIN: workspace.commandPaths.sleep,
    PAPERCLIP_STOP_TIMEOUT_SECONDS: '2',
    PAPERCLIP_TEST_ARGS_FILE: workspace.argsFile,
    PAPERCLIP_FAKE_KILL_LOG: workspace.killLog,
    PAPERCLIP_FAKE_PS_COMMAND_FILE: workspace.psCommandFile,
  };
}

function runScript(workspace, name, extraEnvironment = {}) {
  return spawnSync('/bin/zsh', [path.join(workspace.scriptsDir, name)], {
    cwd: workspace.root,
    encoding: 'utf8',
    env: {
      ...process.env,
      ...baseEnvironment(workspace),
      ...extraEnvironment,
    },
    timeout: 5_000,
  });
}

function combinedOutput(result) {
  return `${result.stdout ?? ''}${result.stderr ?? ''}`;
}

async function fileContents(file) {
  try {
    return await readFile(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function removeWorkspace(workspace) {
  await rm(workspace.root, { recursive: true, force: true });
}

function expectedCommand(workspace) {
  return `${process.execPath} ${workspace.cli} run --data-dir ${workspace.dataDir} --bind loopback --no-repair`;
}

test('status requires valid Paperclip health JSON', async (t) => {
  const workspace = await createWorkspace();
  t.after(() => removeWorkspace(workspace));

  const result = runScript(workspace, 'paperclip-status.sh', {
    PAPERCLIP_FAKE_CURL_BODY: validHealth,
  });

  assert.equal(result.status, 0, combinedOutput(result));
  assert.match(result.stdout, /health=ok/);
});

test('status rejects an HTTP-success response without the required JSON fields', async (t) => {
  const workspace = await createWorkspace();
  t.after(() => removeWorkspace(workspace));

  const result = runScript(workspace, 'paperclip-status.sh', {
    PAPERCLIP_FAKE_CURL_BODY: '{"status":"ok"}',
  });

  assert.equal(result.status, 0, combinedOutput(result));
  assert.match(result.stdout, /health=unavailable/);
  assert.doesNotMatch(result.stdout, /health=ok/);
});

test('start refuses an occupied port that is not a verified Paperclip listener', async (t) => {
  const workspace = await createWorkspace();
  t.after(() => removeWorkspace(workspace));

  const result = runScript(workspace, 'paperclip-start.sh', {
    PAPERCLIP_FAKE_LSOF_OUTPUT: '7001',
    PAPERCLIP_FAKE_CURL_BODY: JSON.stringify({ status: 'ok', deploymentMode: 'authenticated' }),
    PAPERCLIP_FAKE_PS_COMMAND: '/usr/bin/python unrelated-server.py',
  });

  assert.notEqual(result.status, 0, combinedOutput(result));
  assert.match(combinedOutput(result), /refus|not a verified|identity|health/);
  assert.doesNotMatch(combinedOutput(result), /already listening|health=ok pid=/);
  assert.equal(await fileContents(workspace.argsFile), null);
});

test('start refuses a healthy listener whose process identity is not this workspace', async (t) => {
  const workspace = await createWorkspace();
  t.after(() => removeWorkspace(workspace));

  const result = runScript(workspace, 'paperclip-start.sh', {
    PAPERCLIP_FAKE_LSOF_OUTPUT: '7002',
    PAPERCLIP_FAKE_CURL_BODY: validHealth,
    PAPERCLIP_FAKE_PS_COMMAND: '/usr/bin/node /tmp/other-paperclip.js run --data-dir /tmp/other-data',
  });

  assert.notEqual(result.status, 0, combinedOutput(result));
  assert.match(combinedOutput(result), /identity|refus|workspace/);
  assert.equal(await fileContents(workspace.argsFile), null);
});

test('start is idempotent only for a verified workspace listener', async (t) => {
  const workspace = await createWorkspace();
  t.after(() => removeWorkspace(workspace));
  const command = expectedCommand(workspace);

  const environment = {
    PAPERCLIP_FAKE_LSOF_OUTPUT: '7003',
    PAPERCLIP_FAKE_CURL_BODY: validHealth,
    PAPERCLIP_FAKE_PS_COMMAND: command,
    PAPERCLIP_FAKE_KILL0_EXIT: '0',
  };
  const first = runScript(workspace, 'paperclip-start.sh', environment);
  const second = runScript(workspace, 'paperclip-start.sh', environment);

  assert.equal(first.status, 0, combinedOutput(first));
  assert.equal(second.status, 0, combinedOutput(second));
  assert.match(combinedOutput(first), /already listening|already running/);
  assert.match(combinedOutput(second), /already listening|already running/);
  assert.equal(await fileContents(workspace.argsFile), null);
  assert.equal(await fileContents(workspace.pidFile), '7003\n');
});

test('start uses --no-repair after an existing local bootstrap and does not print CLI output', async (t) => {
  const workspace = await createWorkspace();
  t.after(() => removeWorkspace(workspace));
  const instanceDir = path.join(workspace.dataDir, 'instances', 'default');
  await mkdir(instanceDir, { recursive: true });
  await writeFile(path.join(instanceDir, 'config.json'), '{}\n', 'utf8');
  await writeFile(path.join(instanceDir, 'runtime-info.json'), '{}\n', 'utf8');

  const secret = 'test-secret-must-stay-in-log';
  const result = runScript(workspace, 'paperclip-start.sh', {
    PAPERCLIP_FAKE_CURL_BODY: validHealth,
    PAPERCLIP_FAKE_KILL0_EXIT: '0',
    PAPERCLIP_TEST_SECRET: secret,
  });

  assert.equal(result.status, 0, combinedOutput(result));
  assert.doesNotMatch(combinedOutput(result), new RegExp(secret));
  const args = JSON.parse((await fileContents(workspace.argsFile)) ?? 'null');
  assert.deepEqual(args, [
    'run',
    '--data-dir',
    workspace.dataDir,
    '--bind',
    'loopback',
    '--no-repair',
  ]);
});

test('stop refuses a mismatched PID without killing it or removing unrelated files', async (t) => {
  const workspace = await createWorkspace();
  t.after(() => removeWorkspace(workspace));
  await mkdir(workspace.dataDir, { recursive: true });
  await writeFile(workspace.pidFile, '7101\n', 'utf8');
  await writeFile(workspace.sentinel, 'keep me\n', 'utf8');

  const result = runScript(workspace, 'paperclip-stop.sh', {
    PAPERCLIP_FAKE_KILL0_EXIT: '0',
    PAPERCLIP_FAKE_PS_COMMAND: '/bin/sleep 60',
  });

  assert.notEqual(result.status, 0, combinedOutput(result));
  assert.match(combinedOutput(result), /refus|mismatch|identity/);
  assert.equal(await fileContents(workspace.killLog), null);
  assert.equal(await fileContents(workspace.pidFile), '7101\n');
  assert.equal(await fileContents(workspace.sentinel), 'keep me\n');
});

test('stop removes only its stale PID file when the recorded process is gone', async (t) => {
  const workspace = await createWorkspace();
  t.after(() => removeWorkspace(workspace));
  await mkdir(workspace.dataDir, { recursive: true });
  await writeFile(workspace.pidFile, '7102\n', 'utf8');
  await writeFile(workspace.sentinel, 'keep me\n', 'utf8');

  const result = runScript(workspace, 'paperclip-stop.sh', {
    PAPERCLIP_FAKE_KILL0_EXIT: '1',
  });

  assert.equal(result.status, 0, combinedOutput(result));
  assert.equal(await fileContents(workspace.pidFile), null);
  assert.equal(await fileContents(workspace.killLog), null);
  assert.equal(await fileContents(workspace.sentinel), 'keep me\n');
});

test('stop waits for a verified process, times out, and never escalates to SIGKILL', async (t) => {
  const workspace = await createWorkspace();
  t.after(() => removeWorkspace(workspace));
  await mkdir(workspace.dataDir, { recursive: true });
  await writeFile(workspace.pidFile, '7103\n', 'utf8');
  await writeFile(workspace.psCommandFile, `${expectedCommand(workspace)}\n`, 'utf8');

  const result = runScript(workspace, 'paperclip-stop.sh', {
    PAPERCLIP_FAKE_KILL0_EXIT: '0',
  });

  assert.notEqual(result.status, 0, combinedOutput(result));
  assert.match(combinedOutput(result), /did not exit|timeout|timed out/i);
  assert.doesNotMatch((await fileContents(workspace.killLog)) ?? '', /-9|SIGKILL/);
  assert.equal(await fileContents(workspace.pidFile), '7103\n');
  assert.equal(await fileContents(workspace.sentinel), null);
});

test('stop removes the PID file after the verified process exits gracefully', async (t) => {
  const workspace = await createWorkspace();
  t.after(() => removeWorkspace(workspace));
  await mkdir(workspace.dataDir, { recursive: true });
  await writeFile(workspace.pidFile, '7104\n', 'utf8');
  await writeFile(workspace.psCommandFile, `${expectedCommand(workspace)}\n`, 'utf8');
  await writeFile(workspace.sentinel, 'keep me\n', 'utf8');

  const result = runScript(workspace, 'paperclip-stop.sh', {
    PAPERCLIP_FAKE_KILL0_EXIT: '0',
    PAPERCLIP_FAKE_KILL_CLEAR_PS: '1',
  });

  assert.equal(result.status, 0, combinedOutput(result));
  assert.match(combinedOutput(result), /Stopped Paperclip process 7104/);
  assert.doesNotMatch((await fileContents(workspace.killLog)) ?? '', /-9|SIGKILL/);
  assert.equal(await fileContents(workspace.pidFile), null);
  assert.equal(await fileContents(workspace.sentinel), 'keep me\n');
});
