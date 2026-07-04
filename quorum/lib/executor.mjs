import { spawn } from "node:child_process";
import { appendFileSync } from "node:fs";

// Run one agent turn: try each model in the role's fallback chain until one
// exits 0. The LLM command is fully config-driven — swap `pi` for any other
// harness CLI without touching this file.
export async function runTurn({ cfg, role, promptFile, projectDir, log = () => {}, streamFile }) {
  const chain = cfg.llm.models[role] || [];
  if (!chain.length) throw new Error(`no models configured for ${role}`);
  const timeoutMs = (cfg.budgets.turnTimeoutSec || 420) * 1000;
  let lastErr = "";
  for (const model of chain) {
    const args = cfg.llm.args.map((a) =>
      a.replaceAll("{model}", model).replaceAll("{promptFile}", promptFile).replaceAll("{role}", role),
    );
    const started = Date.now();
    const res = await execWithTimeout(cfg.llm.cmd, args, {
      cwd: projectDir,
      timeoutMs,
      streamFile,
      streamHeader: `\n\x1b[1;36m━━━ ${role} · model ${model} · ${new Date().toISOString().slice(11, 19)} ━━━\x1b[0m\n`,
      env: {
        ...process.env,
        QUORUM_ROLE: role,
        QUORUM_PROJECT: projectDir,
        PI_OFFLINE: "1", // skip pi startup network checks in child turns
      },
    });
    const ms = Date.now() - started;
    if (res.code === 0) return { ok: true, model, ms, output: res.stdout };
    lastErr = `${model}: exit ${res.code}${res.timedOut ? " (timeout)" : ""}: ${res.stderr.slice(-500)}`;
    log(`turn failed on ${lastErr}`);
  }
  return { ok: false, error: lastErr };
}

function execWithTimeout(cmd, args, { cwd, timeoutMs, env, streamFile, streamHeader }) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    // live mirror: append chunks as they arrive so `quorum watch` panes show
    // the agent working in real time, not a dump after the turn ends
    const mirror = (d) => {
      if (!streamFile) return;
      try {
        if (streamHeader) {
          appendFileSync(streamFile, streamHeader);
          streamHeader = null;
        }
        appendFileSync(streamFile, d);
      } catch {}
    };
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);
    child.stdout.on("data", (d) => {
      stdout += d;
      mirror(d);
    });
    child.stderr.on("data", (d) => {
      stderr += d;
      mirror(d);
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      resolve({ code: -1, stdout, stderr: String(e), timedOut });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? -1, stdout, stderr, timedOut });
    });
  });
}
