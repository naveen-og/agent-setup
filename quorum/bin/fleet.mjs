#!/usr/bin/env node
// fleet — quorum supervisor. Runs 5 concurrent agent loops over one project.
// Each loop: wake-check (zero LLM cost) → compose prompt from files → one-shot
// LLM turn → repeat. Exits when the goal leaves 'active'.
import fs from "node:fs";
import path from "node:path";
import * as bus from "../lib/bus.mjs";
import * as tasksLib from "../lib/tasks.mjs";
import * as goalLib from "../lib/goal.mjs";
import { loadConfig } from "../lib/config.mjs";
import { composePrompt } from "../lib/prompt.mjs";
import { runTurn } from "../lib/executor.mjs";
import { qdir, nowIso, ROLES } from "../lib/util.mjs";

const argv = process.argv.slice(2);
const flags = {};
const pos = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith("--")) flags[argv[i].slice(2)] = argv[i + 1]?.startsWith("--") || i + 1 >= argv.length ? true : argv[++i];
  else pos.push(argv[i]);
}
const P = path.resolve(pos[0] || process.cwd());
const cfg = loadConfig(P, { profile: flags.profile });
const startedAt = Date.now();

fs.mkdirSync(path.join(qdir(P), "bus", "cursors"), { recursive: true });
fs.mkdirSync(path.join(qdir(P), "memory", "heuristics"), { recursive: true });
fs.mkdirSync(path.join(qdir(P), "logs"), { recursive: true });
fs.mkdirSync(path.join(qdir(P), "tmp"), { recursive: true });

if (flags.goal) {
  goalLib.setGoal(P, String(flags.goal));
  bus.send(P, { from: "human", to: ["*"], type: "say", body: `New goal: ${flags.goal}` });
}
const goal0 = goalLib.getGoal(P);
if (!goal0 || goal0.status !== "active") {
  console.error("fleet: no active goal (use --goal \"...\" or `q goal set`)");
  process.exit(1);
}

function flog(msg) {
  const line = `[${nowIso()}] ${msg}\n`;
  fs.appendFileSync(path.join(qdir(P), "logs", "fleet.log"), line);
  if (!flags.quiet) process.stdout.write(line);
}

function busSize() {
  try {
    return fs.statSync(bus.busFile(P)).size;
  } catch {
    return 0;
  }
}

function goalActive() {
  return goalLib.getGoal(P)?.status === "active";
}

function wallClockExceeded() {
  return Date.now() - startedAt > (cfg.budgets.maxWallClockMin || 240) * 60 * 1000;
}

// Role-specific wake predicates — decide WITHOUT an LLM call whether a turn is worth paying for.
function shouldWake(role) {
  const events = bus.readNew(P, role, { consume: false });
  if (events.length) return true;
  const board = tasksLib.loadBoard(P);
  switch (role) {
    case "planner":
      return board.tasks.length === 0; // nothing decomposed yet
    case "coder":
      return tasksLib.claimable(P, "coder").length > 0 || board.tasks.some((t) => t.status === "doing" && t.owner === "coder");
    case "reviewer":
      return board.tasks.some((t) => t.status === "review");
    case "researcher":
      return false; // purely reactive: questions arrive as events
    case "orchestrator":
      return board.tasks.length > 0 && board.tasks.every((t) => t.status === "done");
    default:
      return false;
  }
}

const turns = Object.fromEntries(ROLES.map((r) => [r, 0]));
let lastBusSize = busSize();
let lastBusChange = Date.now();

async function agentLoop(role) {
  let fails = 0;
  let sleepSec = cfg.budgets.idleSleepMinSec ?? 5;
  while (goalActive() && !wallClockExceeded()) {
    if (turns[role] >= cfg.budgets.maxTurnsPerAgent) {
      await sleep(10);
      continue; // exhausted: idle until fleet ends (safety net below may finalize)
    }
    if (!shouldWake(role)) {
      await sleep(sleepSec);
      sleepSec = Math.min(sleepSec * 2, cfg.budgets.idleSleepMaxSec ?? 60);
      continue;
    }
    sleepSec = cfg.budgets.idleSleepMinSec ?? 5;
    turns[role] += 1;
    const events = bus.readNew(P, role, { consume: true });
    const promptFile = path.join(qdir(P), "tmp", `${role}-turn${turns[role]}.md`);
    fs.writeFileSync(promptFile, composePrompt({ projectDir: P, role, events, turn: turns[role], cfg }));
    flog(`${role}: turn ${turns[role]} starting (${events.length} events)`);
    const res = await runTurn({
      cfg, role, promptFile, projectDir: P,
      log: (m) => flog(`${role}: ${m}`),
      streamFile: path.join(qdir(P), "logs", `${role}.live.log`),
    });
    fs.appendFileSync(
      path.join(qdir(P), "logs", `${role}.log`),
      `\n===== turn ${turns[role]} @ ${nowIso()} model=${res.model || "?"} ok=${res.ok} =====\n${res.output || res.error || ""}\n`,
    );
    try {
      goalLib.updateGoal(P, { turns: { ...goalLib.getGoal(P).turns, [role]: turns[role] } });
    } catch {}
    if (res.ok) {
      fails = 0;
      flog(`${role}: turn ${turns[role]} done (${res.model}, ${Math.round(res.ms / 1000)}s)`);
    } else {
      fails += 1;
      flog(`${role}: turn ${turns[role]} FAILED (${fails} consecutive) — ${res.error?.slice(0, 200)}`);
      if (fails >= 3) {
        bus.send(P, { from: role, to: ["orchestrator"], type: "block", body: `${role} paused: 3 consecutive turn failures. Last: ${res.error?.slice(0, 300)}` });
        await sleep(120); // long pause, then try again
        fails = 0;
      }
    }
  }
}

// Stall watchdog + deterministic finalizer (safety net when orchestrator can't run).
async function watchdog() {
  while (goalActive() && !wallClockExceeded()) {
    await sleep(5);
    const size = busSize();
    if (size !== lastBusSize) {
      lastBusSize = size;
      lastBusChange = Date.now();
    }
    const board = tasksLib.loadBoard(P);
    const allDone = board.tasks.length > 0 && board.tasks.every((t) => t.status === "done");
    const stalled = Date.now() - lastBusChange > (cfg.budgets.stallMin || 15) * 60 * 1000;
    if (stalled && !allDone) {
      lastBusChange = Date.now();
      bus.send(P, { from: "system", to: ["orchestrator"], type: "system", body: `Stall: no bus activity for ${cfg.budgets.stallMin} min and tasks incomplete. Diagnose, unblock or re-plan.` });
      flog("watchdog: stall nudge sent to orchestrator");
    }
    if (allDone && turns.orchestrator >= cfg.budgets.maxTurnsPerAgent) {
      const r = goalLib.runAcceptance(P);
      goalLib.updateGoal(P, { status: r.passed ? "done" : "failed" });
      writeFallbackReport(r);
      flog(`watchdog: orchestrator exhausted — supervisor finalized goal as ${r.passed ? "done" : "failed"}`);
    }
  }
}

function writeFallbackReport(accept) {
  const f = path.join(qdir(P), "report.md");
  if (fs.existsSync(f)) return;
  const g = goalLib.getGoal(P);
  fs.writeFileSync(
    f,
    `# Quorum report (supervisor fallback)\n\nGoal: ${g.text}\nStatus: ${g.status}\nTurns: ${JSON.stringify(g.turns)}\n\n## Acceptance\n${accept.results.map((r) => `- [${r.ok ? "x" : " "}] ${r.desc} (\`${r.check}\`)`).join("\n")}\n`,
  );
}

function sleep(sec) {
  return new Promise((r) => setTimeout(r, sec * 1000));
}

flog(`fleet starting: profile=${flags.profile || "default"} project=${P}`);
flog(`goal: ${goalLib.getGoal(P).text.slice(0, 150)}`);

await Promise.all([...ROLES.map((r) => agentLoop(r)), watchdog()]);

if (goalActive() && wallClockExceeded()) {
  goalLib.updateGoal(P, { status: "failed" });
  bus.send(P, { from: "system", to: ["*"], type: "system", body: "Wall-clock budget exceeded; fleet stopped." });
  writeFallbackReport(goalLib.runAcceptance(P));
}

const finalGoal = goalLib.getGoal(P);
flog(`fleet finished: goal status=${finalGoal.status} turns=${JSON.stringify(finalGoal.turns)}`);
const reportFile = path.join(qdir(P), "report.md");
if (fs.existsSync(reportFile)) flog(`report: ${reportFile}`);
process.exit(finalGoal.status === "done" ? 0 : 1);
