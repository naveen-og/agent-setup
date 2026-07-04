import { spawn } from "node:child_process";

// Run one agent turn: try each model in the role's fallback chain until one
// exits 0. The LLM command is fully config-driven — swap `pi` for any other
// harness CLI without touching this file.
export async function runTurn({ cfg, role, promptFile, projectDir, log = () => {} }) {
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

function execWithTimeout(cmd, args, { cwd, timeoutMs, env }) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
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
