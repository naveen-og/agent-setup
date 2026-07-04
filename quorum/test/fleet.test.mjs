import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import * as bus from "../lib/bus.mjs";
import * as goal from "../lib/goal.mjs";
import { countHeuristics } from "../lib/heuristics.mjs";
import { ROLES } from "../lib/util.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FLEET = path.join(HERE, "..", "bin", "fleet.mjs");

test("full fleet run with fake LLM: goal → plan → code → critique → fix → approve → verify → report", () => {
  const P = fs.mkdtempSync(path.join(os.tmpdir(), "quorum-fleet-"));
  // fast loop timings for test
  fs.writeFileSync(
    path.join(P, "quorum.config.json"),
    JSON.stringify({
      budgets: { maxTurnsPerAgent: 10, turnTimeoutSec: 30, maxWallClockMin: 2, idleSleepMinSec: 0.1, idleSleepMaxSec: 0.3, stallMin: 1 },
    }),
  );
  let out = "";
  try {
    out = execFileSync("node", [FLEET, P, "--profile", "fake", "--goal", "Create hello.txt with hello world and document it", "--quiet"], {
      encoding: "utf8",
      timeout: 110_000,
    });
  } catch (e) {
    // exit 1 = goal not done — dump logs for diagnosis
    const log = fs.readFileSync(path.join(P, ".quorum", "logs", "fleet.log"), "utf8");
    assert.fail(`fleet exited non-zero.\nstdout:${e.stdout}\nfleet.log:\n${log}`);
  }

  // goal reached
  assert.equal(goal.getGoal(P).status, "done");

  // artifacts produced by "coder"
  assert.equal(fs.readFileSync(path.join(P, "hello.txt"), "utf8"), "hello world\n");
  assert.ok(fs.existsSync(path.join(P, "HELLO.md")));

  // orchestrator report
  const report = fs.readFileSync(path.join(P, ".quorum", "report.md"), "utf8");
  assert.match(report, /Status:\*\* done/);
  assert.match(report, /- \[x\]/);

  // the critique→fix cycle actually happened
  const events = bus.readAll(P);
  const types = new Set(events.map((e) => e.type));
  for (const t of ["assign", "question", "answer", "done", "critique", "approve", "update", "say"]) {
    assert.ok(types.has(t), `bus missing event type '${t}'`);
  }

  // evolution layer: every role learned at least one heuristic
  for (const r of ROLES) {
    assert.ok(countHeuristics(P, r) >= 1, `${r} learned nothing`);
  }

  // acceptance criteria verifiable standalone (replayability)
  assert.equal(goal.runAcceptance(P).passed, true);
});
