#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync, openSync, closeSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { get } from "node:http";
import process from "node:process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Config ───
function loadConfig() {
  const cfgPath = resolve(__dirname, "service.json");
  if (!existsSync(cfgPath)) {
    console.error("service.json nao encontrado em", __dirname);
    process.exit(1);
  }
  return JSON.parse(readFileSync(cfgPath, "utf-8"));
}

// ─── PID ───
function pidPath(cfg) { return resolve(__dirname, cfg.pidFile); }

function readPid(cfg) {
  try {
    const n = parseInt(readFileSync(pidPath(cfg), "utf-8").trim(), 10);
    return isNaN(n) ? null : n;
  } catch { return null; }
}

function isAlive(pid) {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

// ─── Port ───
function getPort(cfg) {
  if (cfg.healthUrl) {
    try { return new URL(cfg.healthUrl).port || null; } catch { /* ignore */ }
  }
  return cfg.start?.env?.PORT || cfg.start?.env?.API_PORT || null;
}

// ─── Health ───
function checkHealth(url) {
  return new Promise((ok) => {
    const req = get(url, { timeout: 3000 }, (res) => {
      ok(res.statusCode >= 200 && res.statusCode < 400);
      res.resume();
    });
    req.on("error", () => ok(false));
    req.on("timeout", () => { req.destroy(); ok(false); });
  });
}

// ─── Lifecycle ───
async function doStart(cfg) {
  const pid = readPid(cfg);
  if (isAlive(pid)) { console.log(`Ja rodando (PID ${pid}).`); return; }

  if (cfg.build && cfg.build.command) {
    const buildCmd = cfg.build.command === "node" ? process.execPath : cfg.build.command;
    const buildArgs = cfg.build.args || [];
    console.log(`  \x1b[2mBuild: ${cfg.build.command} ${buildArgs.join(" ")}\x1b[0m`);
    const result = spawnSync(buildCmd, buildArgs, {
      cwd: __dirname,
      env: { ...process.env, ...cfg.build.env },
      stdio: "inherit",
      windowsHide: true,
    });
    if (result.status !== 0) {
      console.error("Build falhou. Abortando start.");
      return;
    }
  }

  const { command, args = [], env = {} } = cfg.start || {};
  if (!command) { console.error("Nenhum comando de start em service.json."); return; }

  const resolved = command === "node" ? process.execPath : command;
  const logFile = cfg.logFile ? resolve(__dirname, cfg.logFile) : null;
  let logFd = null;
  if (logFile) try { logFd = openSync(logFile, "a"); } catch { /* ignore */ }

  const child = spawn(resolved, args, {
    cwd: __dirname,
    env: { ...process.env, ...env },
    detached: true,
    stdio: logFd != null ? ["ignore", logFd, logFd] : "ignore",
    windowsHide: true,
  });

  let spawnErr = null;
  child.on("error", (e) => { spawnErr = e; });

  if (child.pid) {
    writeFileSync(pidPath(cfg), String(child.pid));
    child.unref();
    if (logFd != null) closeSync(logFd);
    await sleep(300);
    if (spawnErr) {
      try { unlinkSync(pidPath(cfg)); } catch { /* ignore */ }
      console.error(`Erro ao iniciar: ${spawnErr.message}`);
      return;
    }
    console.log(`${cfg.name} iniciado (PID ${child.pid}).`);
  } else {
    if (logFd != null) closeSync(logFd);
    console.error("Falha ao iniciar (sem PID).");
  }
}

async function doStop(cfg) {
  const pid = readPid(cfg);
  if (!isAlive(pid)) { console.log("Nao esta rodando."); return; }

  const isWin = process.platform === "win32";
  const grace = isWin ? 1000 : (cfg.stop?.gracefulTimeoutMs ?? 5000);
  const retries = Math.ceil(grace / 500);

  try { process.kill(pid, "SIGTERM"); } catch {
    try { unlinkSync(pidPath(cfg)); } catch { /* ignore */ }
    console.log("Encerrado."); return;
  }

  for (let i = 0; i < retries; i++) {
    await sleep(500);
    if (!isAlive(pid)) {
      try { unlinkSync(pidPath(cfg)); } catch { /* ignore */ }
      console.log(`${cfg.name} encerrado (PID ${pid}).`); return;
    }
  }

  try { process.kill(pid, isWin ? "SIGTERM" : "SIGKILL"); } catch { /* ignore */ }
  await sleep(500);
  try { unlinkSync(pidPath(cfg)); } catch { /* ignore */ }
  console.log(`${cfg.name} encerrado forcadamente (PID ${pid}).`);
}

async function doRestart(cfg) { await doStop(cfg); await sleep(500); await doStart(cfg); }

async function doStatus(cfg) {
  const pid = readPid(cfg);
  const alive = isAlive(pid);
  const port = getPort(cfg);
  let health = "---";
  if (alive && cfg.healthUrl) health = (await checkHealth(cfg.healthUrl)) ? "ok" : "fail";

  const status = alive ? `\x1b[32mRodando\x1b[0m (PID ${pid}${port ? `, Porta ${port}` : ""})` : `\x1b[31mParado\x1b[0m${port ? ` (Porta ${port})` : ""}`;
  const hLabel = health === "ok" ? "\x1b[32mOK\x1b[0m" : health === "fail" ? "\x1b[31mFail\x1b[0m" : "\x1b[2m---\x1b[0m";
  const link = port ? `http://localhost:${port}` : "";
  console.log(`  ${cfg.name}: ${status} | Health: ${hLabel}${link ? ` | \x1b[36m${link}\x1b[0m` : ""}`);
}

// ─── Menu Interativo ───
async function showMenu(cfg) {
  if (!process.stdin.isTTY) { console.error("TTY necessario para menu interativo."); process.exit(1); }

  const port = getPort(cfg);
  const link = port ? `http://localhost:${port}` : null;
  let busy = false;

  const render = async () => {
    process.stdout.write("\x1b[2J\x1b[H");
    const pid = readPid(cfg);
    const alive = isAlive(pid);
    let health = "---";
    if (alive && cfg.healthUrl) health = (await checkHealth(cfg.healthUrl)) ? "ok" : "fail";

    const pidInfo = alive ? `PID ${pid}${port ? `, Porta ${port}` : ""}` : "";
    const statusTxt = alive ? `\x1b[32mRodando\x1b[0m (${pidInfo})` : `\x1b[31mParado\x1b[0m${port ? ` (Porta ${port})` : ""}`;
    const hTxt = health === "ok" ? "\x1b[32mOK\x1b[0m" : health === "fail" ? "\x1b[31mFail\x1b[0m" : "\x1b[2m---\x1b[0m";

    const lines = [
      "",
      `  \x1b[1m${cfg.name}\x1b[0m - Gerenciador Local`,
      `  \x1b[2m${"─".repeat(40)}\x1b[0m`,
      `  Status: ${statusTxt} | Health: ${hTxt}`,
    ];
    if (link) lines.push(`  Link:   \x1b[36m${link}\x1b[0m`);
    lines.push(
      "",
      "  [1] Iniciar",
      "  [2] Parar",
      "  [3] Reiniciar",
      "  [q] Sair",
      "",
      "  \x1b[2mPressione 1-3 ou q:\x1b[0m",
      "",
    );
    process.stdout.write(lines.join("\n"));
  };

  await render();

  const refreshTimer = setInterval(async () => {
    if (!busy) await render();
  }, 5000);

  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf-8");

  process.stdin.on("data", async (key) => {
    if (busy) return;
    busy = true;
    switch (key) {
      case "1": await doStart(cfg); await sleep(500); await render(); break;
      case "2": await doStop(cfg); await sleep(500); await render(); break;
      case "3": await doRestart(cfg); await sleep(500); await render(); break;
      case "q": case "Q": case "\x03": case "\x1b":
        clearInterval(refreshTimer);
        process.stdout.write("\x1b[?25h\n");
        process.exit(0);
    }
    busy = false;
  });
}

// ─── Main ───
const cfg = loadConfig();
const [cmd] = process.argv.slice(2);

if (!cmd && process.stdin.isTTY) {
  showMenu(cfg);
} else {
  switch (cmd) {
    case "start": await doStart(cfg); break;
    case "stop": await doStop(cfg); break;
    case "restart": await doRestart(cfg); break;
    case "status": await doStatus(cfg); break;
    default:
      console.log(`Uso: node manage.mjs [start|stop|restart|status]`);
      console.log(`Sem argumentos: abre menu interativo.`);
  }
}
