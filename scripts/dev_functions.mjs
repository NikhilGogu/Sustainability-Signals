import { spawn, spawnSync } from "node:child_process";
import http from "node:http";

const isWin = process.platform === "win32";
const NPM = "npm";
const NPX = "npx";

function killTree(child) {
  if (!child || typeof child.pid !== "number") return;
  if (isWin) {
    spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
    return;
  }

  // Kill the whole process group (child is spawned detached on non-Windows).
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    try { child.kill("SIGTERM"); } catch { /* ignore */ }
  }
}

function spawnInherit(cmd, args, name) {
  const spawnOpts = {
    stdio: "inherit",
    env: process.env,
    shell: false,
    detached: !isWin,
  };

  // On Windows, .cmd/.bat shims require cmd.exe.
  if (isWin) {
    const comspec = process.env.comspec || "cmd.exe";
    const quote = (s) => {
      const v = String(s);
      if (!/[ \t"]/g.test(v)) return v;
      return `"${v.replaceAll('"', '""')}"`;
    };
    const commandLine = [cmd, ...args].map(quote).join(" ");
    // /d: Disable AutoRun, /s: reliable parsing, /c: run then exit
    // https://learn.microsoft.com/windows-server/administration/windows-commands/cmd
    return spawn(comspec, ["/d", "/s", "/c", commandLine], {
      ...spawnOpts,
      detached: false,
    });
  }

  const child = spawn(cmd, args, spawnOpts);

  child.on("exit", (code, signal) => {
    const msg = `[dev:functions] ${name} exited (${signal || code || 0})`;
    // eslint-disable-next-line no-console
    console.log(msg);
  });

  return child;
}

function urlIsUp(url, timeoutMs = 1000) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(Boolean(res.statusCode) && res.statusCode < 500);
    });

    req.on("error", () => resolve(false));
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForUrl(url, { timeoutMs = 30_000, intervalMs = 250 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    // eslint-disable-next-line no-await-in-loop
    if (await urlIsUp(url)) return true;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

let shuttingDown = false;
let vite = null;
let wrangler = null;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  killTree(wrangler);
  killTree(vite);
  process.exit(code);
}

process.on("SIGINT", () => shutdown(130));
process.on("SIGTERM", () => shutdown(143));

vite = spawnInherit(NPM, ["run", "dev"], "vite");

const ready = await waitForUrl("http://127.0.0.1:5174", { timeoutMs: 45_000 });
if (!ready) {
  // eslint-disable-next-line no-console
  console.error("[dev:functions] Vite did not become ready on http://127.0.0.1:5174 in time.");
  shutdown(1);
}

const wranglerArgs = ["wrangler", "pages", "dev", "--proxy", "5174", "--port", "8788"];

const finbertUrl = (process.env.FINBERT_URL || "").trim();
if (finbertUrl) {
  wranglerArgs.push("--binding", `FINBERT_URL=${finbertUrl}`);
}

const finbertApiKey = (process.env.FINBERT_API_KEY || "").trim();
if (finbertApiKey) {
  wranglerArgs.push("--binding", `FINBERT_API_KEY=${finbertApiKey}`);
}

wrangler = spawnInherit(NPX, wranglerArgs, "wrangler");

wrangler.on("exit", (code) => shutdown(code || 0));
vite.on("exit", (code) => shutdown(code || 0));
