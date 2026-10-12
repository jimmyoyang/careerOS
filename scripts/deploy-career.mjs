#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";

const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = path.join(
  os.homedir(),
  "Library",
  "Application Support",
  "CareerOS",
);
const agents = path.join(os.homedir(), "Library", "LaunchAgents");
const labels = ["local.careeros.web", "local.careeros.latex"];
const domain = `gui/${process.getuid()}`;
const stateFile = path.join(root, "deployment.json");
const action = process.argv[2] ?? "deploy";
if (process.platform !== "darwin")
  throw new Error(
    "Native installer supports macOS; use docker-compose.career.yml on other hosts.",
  );
const run = (cmd, args, options = {}) =>
  execFileSync(cmd, args, { cwd: source, stdio: "inherit", ...options });
const optionalStop = (label) => {
  try {
    execFileSync("/bin/launchctl", ["bootout", `${domain}/${label}`], {
      stdio: "ignore",
    });
  } catch {
    /* It may not be installed yet. */
  }
};
const xml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
const plist = (label, args, cwd, env = {}) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>Label</key><string>${label}</string><key>ProgramArguments</key><array>${args.map((a) => `<string>${xml(a)}</string>`).join("")}</array><key>WorkingDirectory</key><string>${xml(cwd)}</string><key>EnvironmentVariables</key><dict>${Object.entries(
    env,
  )
    .map(
      ([key, value]) => `<key>${xml(key)}</key><string>${xml(value)}</string>`,
    )
    .join(
      "",
    )}</dict><key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ThrottleInterval</key><integer>10</integer><key>StandardOutPath</key><string>${xml(path.join(root, "logs", `${label}.log`))}</string><key>StandardErrorPath</key><string>${xml(path.join(root, "logs", `${label}.error.log`))}</string></dict></plist>\n`;

await fs.mkdir(root, { recursive: true, mode: 0o700 });
await fs.mkdir(path.join(root, "logs"), { recursive: true });
await fs.mkdir(agents, { recursive: true });
if (action === "stop") {
  labels.forEach(optionalStop);
  console.log("CareerOS stopped. Data and releases retained.");
  process.exit(0);
}
const state = JSON.parse(
  await fs.readFile(stateFile, "utf8").catch(() => "{}"),
);
const configPath = path.join(root, "config.json");
let config;
try {
  config = JSON.parse(await fs.readFile(configPath, "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  config = {
    DATABASE_URL: `file:${path.join(root, "data", "career.db")}`,
    UPLOADS_DIR: path.join(root, "data"),
    AUTH_SECRET: randomBytes(32).toString("base64"),
    ENCRYPTION_KEY: randomBytes(32).toString("base64"),
    AUTH_TRUST_HOST: "true",
    NEXTAUTH_URL: "http://localhost:3737",
    NODE_ENV: "production",
    HOSTNAME: "127.0.0.1",
    PORT: "3737",
    CAREER_ENABLED: "true",
    CAREER_LATEX_URL: "http://127.0.0.1:3738",
    MCP_ENABLED: "false",
    TZ: "Asia/Shanghai",
    NEXT_TELEMETRY_DISABLED: "1",
  };
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), {
    mode: 0o600,
    flag: "wx",
  });
}
await fs.mkdir(config.UPLOADS_DIR, { recursive: true, mode: 0o700 });
const dbPath = config.DATABASE_URL.slice(5);
try {
  await fs.access(dbPath);
} catch {
  await fs.writeFile(dbPath, "", { mode: 0o600, flag: "wx" });
}
let release;
if (action === "rollback") {
  if (!state.previousRelease)
    throw new Error(
      "No previous release exists; current data was not changed.",
    );
  release = state.previousRelease;
} else if (action === "deploy") {
  await fs.access(path.join(source, ".next", "standalone", "server.js"));
  release = path.join(
    root,
    "releases",
    new Date().toISOString().replace(/[:.]/g, "-"),
  );
  await fs.mkdir(release, { recursive: true });
  await fs.cp(path.join(source, ".next", "standalone"), release, {
    recursive: true,
    filter: (item) => !path.basename(item).startsWith(".env"),
  });
  await fs.cp(
    path.join(source, ".next", "static"),
    path.join(release, ".next", "static"),
    { recursive: true },
  );
  await fs.cp(path.join(source, "public"), path.join(release, "public"), {
    recursive: true,
  });
  await fs.cp(
    path.join(source, "services", "latex"),
    path.join(release, "compiler"),
    { recursive: true },
  );
  await fs.writeFile(
    path.join(release, "run-web.cjs"),
    `const fs = require('node:fs');\nObject.assign(process.env, JSON.parse(fs.readFileSync(${JSON.stringify(configPath)}, 'utf8')));\nprocess.env.PHONE_BRIDGE_STATE_DIR ??= ${JSON.stringify(path.join(source, 'data', 'phone-bridge'))};\nrequire('./server.js');\n`,
  );
} else throw new Error("Expected deploy, rollback, or stop.");
labels.forEach(optionalStop);
if (action === "deploy") {
  const { DatabaseSync, backup } = await import("node:sqlite");
  const database = new DatabaseSync(dbPath);
  await fs.mkdir(path.join(root, "backups"), { recursive: true });
  await backup(
    database,
    path.join(root, "backups", `${path.basename(release)}.db`),
  );
  database.close();
  run(
    process.execPath,
    [
      path.join(source, "node_modules", "prisma", "build", "index.js"),
      "migrate",
      "deploy",
    ],
    { env: { ...process.env, DATABASE_URL: config.DATABASE_URL } },
  );
}
const definitions = [
  plist(
    labels[0],
    [process.execPath, path.join(release, "run-web.cjs")],
    release,
  ),
  plist(
    labels[1],
    [process.execPath, path.join(release, "compiler", "server.mjs")],
    release,
    {
      PATH: "/Library/TeX/texbin:/usr/bin:/bin",
      XELATEX_BIN: "/Library/TeX/texbin/xelatex",
      LATEX_HOST: "127.0.0.1",
      LATEX_PORT: "3738",
    },
  ),
];
for (let i = 0; i < labels.length; i++) {
  const file = path.join(agents, `${labels[i]}.plist`);
  await fs.writeFile(file, definitions[i], { mode: 0o600 });
  run("/bin/launchctl", ["bootstrap", domain, file]);
}
await fs.writeFile(
  stateFile,
  JSON.stringify(
    {
      currentRelease: release,
      previousRelease: state.currentRelease ?? null,
      deployedAt: new Date().toISOString(),
      dataDirectory: config.UPLOADS_DIR,
    },
    null,
    2,
  ),
  { mode: 0o600 },
);
console.log(
  `CareerOS deployed to http://localhost:3737\nPersistent data: ${config.UPLOADS_DIR}\nRelease: ${release}`,
);
