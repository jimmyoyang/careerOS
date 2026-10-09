import http from "node:http";
import { mkdtemp, writeFile, readFile, rm, realpath } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { renderLatex } from "./render.mjs";
const exec = promisify(execFile);

export async function compile(input) {
  const tex = renderLatex(input);
  const directory = await realpath(
    await mkdtemp(path.join(os.tmpdir(), "careeros-latex-")),
  );
  try {
    await writeFile(path.join(directory, "resume.tex"), tex);
    const binary = process.env.XELATEX_BIN || "xelatex";
    const args = [
      "-no-shell-escape",
      "-interaction=nonstopmode",
      "-halt-on-error",
      "-file-line-error",
      "resume.tex",
    ];
    const sandboxed = process.platform === "darwin";
    const profile = `(version 1)(deny default)(allow process*)(allow sysctl-read)(allow mach-lookup)(allow file-read*)(allow file-write* (subpath ${JSON.stringify(directory)}))(deny network*)`;
    const command = sandboxed ? "/usr/bin/sandbox-exec" : binary;
    const commandArgs = sandboxed ? ["-p", profile, binary, ...args] : args;
    const result = await exec(command, commandArgs, {
      cwd: directory,
      timeout: 60000,
      maxBuffer: 2_000_000,
      env: {
        PATH: process.env.PATH,
        HOME: directory,
        TMPDIR: directory,
        openin_any: "p",
        openout_any: "p",
        TEXMFOUTPUT: directory,
        LANG: "en_US.UTF-8",
      },
    });
    if (/Overfull \\[hv]box/.test(result.stdout))
      throw new Error("LAYOUT_OVERFLOW");
    const pdf = await readFile(path.join(directory, "resume.pdf"));
    if (!pdf.subarray(0, 5).equals(Buffer.from("%PDF-")))
      throw new Error("INVALID_PDF");
    return { tex, pdf };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let busy = false;
  http
    .createServer(async (req, res) => {
      res.setHeader("Content-Type", "application/json");
      if (req.method === "GET" && req.url === "/health") {
        res.end('{"ok":true,"templateVersion":"zh-single-page-v1"}');
        return;
      }
      if (
        req.method !== "POST" ||
        req.url !== "/compile" ||
        req.headers["content-type"] !== "application/json"
      ) {
        res.writeHead(404);
        res.end("{}");
        return;
      }
      if (busy) {
        res.writeHead(429);
        res.end('{"error":"BUSY"}');
        return;
      }
      busy = true;
      try {
        let length = 0;
        const chunks = [];
        for await (const chunk of req) {
          length += chunk.length;
          if (length > 100000) throw new Error("INPUT_TOO_LARGE");
          chunks.push(chunk);
        }
        const result = await compile(
          JSON.parse(Buffer.concat(chunks).toString("utf8")),
        );
        res.end(
          JSON.stringify({
            tex: result.tex,
            pdf: result.pdf.toString("base64"),
          }),
        );
      } catch (error) {
        res.writeHead(422);
        res.end(
          JSON.stringify({
            error: [
              "LAYOUT_OVERFLOW",
              "INPUT_TOO_LARGE",
              "INVALID_TEMPLATE_INPUT",
            ].includes(error.message)
              ? error.message
              : "COMPILE_FAILED",
          }),
        );
      } finally {
        busy = false;
      }
    })
    .listen(
      Number(process.env.LATEX_PORT || 3738),
      process.env.LATEX_HOST || "127.0.0.1",
      () => console.log("CareerOS compiler ready"),
    );
}
