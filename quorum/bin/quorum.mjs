#!/usr/bin/env node
// quorum — human-facing CLI. Works in any harness or bare shell; the pi
// extension is just a thin wrapper around these commands.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as bus from "../lib/bus.mjs";
import * as goalLib from "../lib/goal.mjs";
import * as tasksLib from "../lib/tasks.mjs";
import { qdir } from "../lib/util.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FLEET = path.join(HERE, "fleet.mjs");

const argv = process.argv.slice(2);
const flags = {};
const pos = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith("--")) {
    const k = argv[i].slice(2);
    const v = argv[i + 1]?.startsWith("--") || i + 1 >= argv.length ? true : argv[++i];
    if (flags[k] === undefined) flags[k] = v;
    else flags[k] = [].concat(flags[k], v); // repeated flags accumulate
  } else pos.push(argv[i]);
}
const [cmd, ...rest] = pos;
const P = path.resolve(flags.project || process.cwd());
const pidFile = () => path.join(qdir(P), "fleet.pid");

function fleetRunning() {
  const pid = Number(fs.existsSync(pidFile()) ? fs.readFileSync(pidFile(), "utf8") : 0);
  if (!pid) return null;
  try {
    process.kill(pid, 0);
    return pid;
  } catch {
    return null;
  }
}

function launchFleet(extraArgs = []) {
  fs.mkdirSync(path.join(qdir(P), "logs"), { recursive: true });
  const out = fs.openSync(path.join(qdir(P), "logs", "fleet-stdout.log"), "a");
  const child = spawn("node", [FLEET, P, "--quiet", ...extraArgs], {
    detached: true,
    stdio: ["ignore", out, out],
  });
  child.unref();
  fs.writeFileSync(pidFile(), String(child.pid));
  return child.pid;
}

switch (cmd) {
  case "goal": {
    if (!rest.length) {
      console.error('usage: quorum goal "<natural language goal>" [--check "<shell cmd>"]... [--profile test|fake]');
      process.exit(2);
    }
    if (fleetRunning()) {
      console.error(`fleet already running (pid ${fleetRunning()}) — use 'quorum stop' first`);
      process.exit(1);
    }
    const text = rest.join(" ");
    // human-supplied checks are the acceptance floor: agents may add, never remove
    const checks = flags.check ? [].concat(flags.check) : [];
    goalLib.setGoal(P, text, {
      acceptance: checks.map((c) => ({ desc: `human: ${String(c).slice(0, 60)}`, check: String(c), locked: true })),
    });
    bus.send(P, { from: "human", to: ["*"], type: "say", body: `New goal: ${text}` });
    const args = flags.profile ? ["--profile", String(flags.profile)] : [];
    const pid = launchFleet(args);
    console.log(`fleet launched (pid ${pid})\n  watch:  quorum status\n  talk:   quorum say "..."\n  stop:   quorum stop\n  report: ${path.join(qdir(P), "report.md")} (when done)`);
    break;
  }
  case "run": {
    // resume fleet on an existing active goal (after reboot/crash)
    const g = goalLib.getGoal(P);
    if (!g || g.status !== "active") {
      console.error("no active goal to resume");
      process.exit(1);
    }
    if (fleetRunning()) {
      console.error(`fleet already running (pid ${fleetRunning()})`);
      process.exit(1);
    }
    const args = flags.profile ? ["--profile", String(flags.profile)] : [];
    console.log(`fleet resumed (pid ${launchFleet(args)})`);
    break;
  }
  case "say": {
    bus.send(P, { from: "human", to: ["orchestrator"], type: "say", body: rest.join(" ") });
    console.log("delivered to orchestrator");
    break;
  }
  case "status": {
    const g = goalLib.getGoal(P);
    const pid = fleetRunning();
    console.log(JSON.stringify({
      fleet: pid ? `running (pid ${pid})` : "stopped",
      goal: g ? { text: g.text.slice(0, 120), status: g.status, turns: g.turns } : null,
      tasks: tasksLib.summary(P),
      lastEvents: bus.readAll(P).slice(-8).map((e) => `${e.ts.slice(11, 19)} ${e.from}→${e.to.join(",")} [${e.type}] ${e.body.slice(0, 80)}`),
    }, null, 2));
    break;
  }
  case "log": {
    const all = bus.readAll(P);
    for (const e of flags.tail ? all.slice(-Number(flags.tail)) : all) {
      console.log(`${e.ts.slice(0, 19)} ${e.from.padEnd(12)}→ ${e.to.join(",").padEnd(12)} [${e.type}] ${e.body}`);
    }
    break;
  }
  case "stop": {
    const pid = fleetRunning();
    const g = goalLib.getGoal(P);
    if (g && g.status === "active") goalLib.updateGoal(P, { status: "stopped" });
    if (pid) {
      try { process.kill(pid, "SIGTERM"); } catch {}
      console.log(`fleet stopped (pid ${pid})`);
    } else console.log("fleet was not running; goal marked stopped");
    try { fs.unlinkSync(pidFile()); } catch {}
    break;
  }
  case "watch": {
    // 6-pane tmux dashboard: one pane per role transcript + bus/status pane
    const { execSync } = await import("node:child_process");
    const logs = path.join(qdir(P), "logs");
    fs.mkdirSync(logs, { recursive: true });
    const roles = ["planner", "coder", "reviewer", "researcher", "orchestrator"];
    for (const r of roles) {
      const f = path.join(logs, `${r}.log`);
      if (!fs.existsSync(f)) fs.writeFileSync(f, "");
    }
    const S = "quorum-watch";
    const sh = (c) => execSync(c, { stdio: "pipe" });
    try { sh(`tmux kill-session -t ${S} 2>/dev/null`); } catch {}
    const tailCmd = (r) => `tail -n 20 -f '${path.join(logs, `${r}.log`)}'`;
    const busCmd = `watch -n 2 -t "node '${path.join(HERE, "quorum.mjs")}' status --project '${P}'"`;
    sh(`tmux new-session -d -s ${S} -n fleet -x 220 -y 50 "${tailCmd(roles[0])}"`);
    for (const r of roles.slice(1)) {
      sh(`tmux split-window -t ${S} "${tailCmd(r)}"`);
      sh(`tmux select-layout -t ${S} tiled`);
    }
    sh(`tmux split-window -t ${S} '${busCmd}'`);
    sh(`tmux select-layout -t ${S} tiled`);
    const ids = sh(`tmux list-panes -t ${S} -F '#{pane_id}'`).toString().trim().split("\n");
    const titles = [...roles, "status"];
    ids.forEach((id, i) => sh(`tmux select-pane -t ${id} -T ${titles[i] || "extra"}`));
    sh(`tmux set -t ${S} pane-border-status top`);
    if (process.env.TMUX) {
      console.log(`session '${S}' ready — switch with: tmux switch-client -t ${S}`);
    } else {
      const { spawnSync } = await import("node:child_process");
      spawnSync("tmux", ["attach", "-t", S], { stdio: "inherit" });
    }
    break;
  }
  case "report": {
    const f = path.join(qdir(P), "report.md");
    console.log(fs.existsSync(f) ? fs.readFileSync(f, "utf8") : "no report yet");
    break;
  }
  default:
    console.log(`quorum — 5-agent coding fleet
usage:
  quorum goal "<goal text>" [--profile test|fake]   set goal + launch fleet (background)
  quorum run [--profile ...]                        resume fleet on existing active goal
  quorum status                                     fleet/goal/tasks snapshot
  quorum log [--tail N]                             team conversation
  quorum say "<message>"                            talk to the orchestrator mid-run
  quorum watch                                      tmux dashboard — 5 role panes + status
  quorum report                                     print final report
  quorum stop                                       stop fleet + mark goal stopped
  (all commands take --project <dir>; default cwd)`);
    if (cmd) process.exit(2);
}
