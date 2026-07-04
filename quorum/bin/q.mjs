#!/usr/bin/env node
// q — quorum protocol CLI. Agents mutate shared state ONLY through this tool.
// Project dir = QUORUM_PROJECT env or cwd (walks up to find .quorum).
import fs from "node:fs";
import path from "node:path";
import * as bus from "../lib/bus.mjs";
import * as tasks from "../lib/tasks.mjs";
import * as goal from "../lib/goal.mjs";
import * as heur from "../lib/heuristics.mjs";
import { qdir } from "../lib/util.mjs";

function findProjectDir() {
  if (process.env.QUORUM_PROJECT) return path.resolve(process.env.QUORUM_PROJECT);
  let d = process.cwd();
  for (;;) {
    if (fs.existsSync(path.join(d, ".quorum"))) return d;
    const up = path.dirname(d);
    if (up === d) return process.cwd();
    d = up;
  }
}

function parseFlags(argv) {
  const flags = {};
  const pos = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const k = argv[i].slice(2);
      if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
        flags[k] = argv[++i];
      } else {
        flags[k] = true;
      }
    } else pos.push(argv[i]);
  }
  return { flags, pos };
}

function out(x) {
  process.stdout.write((typeof x === "string" ? x : JSON.stringify(x, null, 2)) + "\n");
}

const P = findProjectDir();
const [cmd, ...rest] = process.argv.slice(2);
const { flags, pos } = parseFlags(rest);
const me = flags.as || process.env.QUORUM_ROLE;

try {
  switch (cmd) {
    case "send": {
      // q send --type propose --to coder [--task t3] [--refs evt-x,evt-y] "body"
      if (!me) throw new Error("send: need --as <role> or QUORUM_ROLE");
      const evt = bus.send(P, {
        from: me,
        to: flags.to ? String(flags.to).split(",") : ["*"],
        type: flags.type || "update",
        task: flags.task,
        refs: flags.refs ? String(flags.refs).split(",") : undefined,
        body: pos.join(" "),
      });
      out(`sent ${evt.id}`);
      break;
    }
    case "read": {
      // q read [--peek] — new events for me (advances cursor unless --peek)
      if (!me) throw new Error("read: need --as <role> or QUORUM_ROLE");
      out(bus.readNew(P, me, { consume: !flags.peek }));
      break;
    }
    case "log": {
      // q log [--tail N] — whole bus, for humans/debugging
      const all = bus.readAll(P);
      out(flags.tail ? all.slice(-Number(flags.tail)) : all);
      break;
    }
    case "task": {
      const sub = pos[0];
      if (sub === "add") {
        const t = await tasks.addTask(P, {
          title: pos.slice(1).join(" "),
          acceptance: flags.acceptance || "",
          deps: flags.deps ? String(flags.deps).split(",") : [],
          owner: flags.owner || null,
        });
        out(t);
      } else if (sub === "claim") {
        if (!me) throw new Error("claim: need --as <role>");
        out(await tasks.claimTask(P, pos[1], me));
      } else if (sub === "status") {
        out(await tasks.setStatus(P, pos[1], pos[2], { note: flags.note, by: me }));
      } else if (sub === "list") {
        out(tasks.loadBoard(P));
      } else if (sub === "claimable") {
        if (!me) throw new Error("claimable: need --as <role>");
        out(tasks.claimable(P, me));
      } else if (sub === "summary") {
        out(tasks.summary(P));
      } else throw new Error("task: add|claim|status|list|claimable|summary");
      break;
    }
    case "goal": {
      const sub = pos[0];
      if (sub === "get") out(goal.getGoal(P) || "no goal");
      else if (sub === "set") {
        const g = goal.getGoal(P);
        if (g && g.status === "active" && !flags.force)
          throw new Error("goal already active — refusing overwrite (would wipe acceptance). Use accept-add or --force.");
        out(goal.setGoal(P, pos.slice(1).join(" "), { acceptance: g?.acceptance?.filter((a) => a.locked) || [] }));
      }
      else if (sub === "status") {
        if (!pos[1]) throw new Error("goal status: need one of active|done|failed|stopped");
        // hard invariant: 'done' only when acceptance actually passes right now
        if (pos[1] === "done") {
          const r = goal.runAcceptance(P);
          if (!r.passed) {
            const failing = r.results.filter((x) => !x.ok).map((x) => `${x.desc} (${x.check})`).join("; ") || "no acceptance checks defined";
            throw new Error(`refusing 'done': acceptance not passing — ${failing}`);
          }
        }
        out(goal.updateGoal(P, { status: pos[1] }));
      }
      else if (sub === "accept-add") {
        const g = goal.getGoal(P);
        if (!g.acceptance.some((a) => a.check === flags.check)) {
          g.acceptance.push({ desc: flags.desc || pos.slice(1).join(" "), check: flags.check });
          goal.setAcceptance(P, g.acceptance);
        }
        out(`acceptance now ${g.acceptance.length} checks`);
      } else if (sub === "verify") out(goal.runAcceptance(P));
      else throw new Error("goal: get|set|status|accept-add|verify");
      break;
    }
    case "learn": {
      // q learn "heuristic text" — appends to my heuristics file
      if (!me) throw new Error("learn: need --as <role> or QUORUM_ROLE");
      out(heur.learn(P, me, pos.join(" ")));
      break;
    }
    case "status": {
      const g = goal.getGoal(P);
      out({
        project: P,
        goal: g ? { text: g.text.slice(0, 120), status: g.status, turns: g.turns } : null,
        tasks: tasks.summary(P),
        busEvents: bus.readAll(P).length,
      });
      break;
    }
    case "init": {
      fs.mkdirSync(path.join(qdir(P), "bus", "cursors"), { recursive: true });
      fs.mkdirSync(path.join(qdir(P), "memory", "heuristics"), { recursive: true });
      fs.mkdirSync(path.join(qdir(P), "locks"), { recursive: true });
      out(`initialized ${qdir(P)}`);
      break;
    }
    default:
      out(`q — quorum protocol CLI
usage:
  q init
  q send --as ROLE --type TYPE --to R1,R2 [--task tN] [--refs e1,e2] "body"
  q read --as ROLE [--peek]
  q log [--tail N]
  q task add "title" [--acceptance "..."] [--deps t1,t2] [--owner ROLE]
  q task claim tN --as ROLE
  q task status tN STATUS [--note "..."] [--as ROLE]
  q task list | claimable --as ROLE | summary
  q goal get | set "text" | status STATUS | accept-add --desc "..." --check "cmd" | verify
  q learn --as ROLE "heuristic"
  q status
types: propose critique approve update block unblock assign done question answer reflect say system
statuses: todo doing review done blocked`);
      if (cmd && cmd !== "help") process.exit(2);
  }
} catch (e) {
  process.stderr.write(`q error: ${e.message}\n`);
  process.exit(1);
}
