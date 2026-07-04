import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import * as bus from "../lib/bus.mjs";
import * as tasks from "../lib/tasks.mjs";
import * as goal from "../lib/goal.mjs";
import * as heur from "../lib/heuristics.mjs";
import { loadConfig } from "../lib/config.mjs";
import { withLock } from "../lib/util.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

let P;
beforeEach(() => {
  P = fs.mkdtempSync(path.join(os.tmpdir(), "quorum-test-"));
  fs.mkdirSync(path.join(P, ".quorum"), { recursive: true });
});

test("bus: send validates type and recipients", () => {
  assert.throws(() => bus.send(P, { from: "planner", to: "coder", type: "bogus", body: "x" }));
  assert.throws(() => bus.send(P, { from: "planner", to: "nobody", type: "update", body: "x" }));
  const e = bus.send(P, { from: "planner", to: "coder", type: "assign", task: "t1", body: "do it" });
  assert.equal(e.from, "planner");
  assert.deepEqual(e.to, ["coder"]);
});

test("bus: cursor read delivers only new, addressed events; excludes own", () => {
  bus.send(P, { from: "planner", to: "coder", type: "assign", body: "a" });
  bus.send(P, { from: "planner", to: "*", type: "update", body: "b" });
  bus.send(P, { from: "coder", to: "*", type: "update", body: "own" });
  bus.send(P, { from: "planner", to: "reviewer", type: "assign", body: "not-mine" });

  const first = bus.readNew(P, "coder");
  assert.deepEqual(first.map((e) => e.body), ["a", "b"]);

  // cursor advanced — nothing new
  assert.equal(bus.readNew(P, "coder").length, 0);

  bus.send(P, { from: "reviewer", to: "coder", type: "critique", body: "c" });
  assert.deepEqual(bus.readNew(P, "coder").map((e) => e.body), ["c"]);
});

test("bus: peek does not advance cursor", () => {
  bus.send(P, { from: "planner", to: "coder", type: "assign", body: "a" });
  assert.equal(bus.readNew(P, "coder", { consume: false }).length, 1);
  assert.equal(bus.readNew(P, "coder").length, 1);
});

test("bus: tolerates torn last line", () => {
  bus.send(P, { from: "planner", to: "coder", type: "assign", body: "a" });
  fs.appendFileSync(bus.busFile(P), '{"id":"evt-torn","from":"x"'); // no newline, incomplete
  const got = bus.readNew(P, "coder");
  assert.equal(got.length, 1);
  // torn line stays unconsumed; completing it later delivers it
  fs.appendFileSync(bus.busFile(P), ',"to":["coder"],"type":"update","body":"late","ts":"t","v":1}\n');
  const later = bus.readNew(P, "coder");
  assert.deepEqual(later.map((e) => e.body), ["late"]);
});

test("tasks: add/claim/status lifecycle + dep gating", async () => {
  const t1 = await tasks.addTask(P, { title: "one" });
  const t2 = await tasks.addTask(P, { title: "two", deps: [t1.id] });
  await assert.rejects(tasks.claimTask(P, t2.id, "coder"), /unmet deps/);
  await tasks.claimTask(P, t1.id, "coder");
  await assert.rejects(tasks.claimTask(P, t1.id, "coder"), /not 'todo'/);
  await tasks.setStatus(P, t1.id, "done", { by: "reviewer", note: "lgtm" });
  const c2 = await tasks.claimTask(P, t2.id, "coder");
  assert.equal(c2.status, "doing");
  assert.deepEqual(tasks.summary(P), { total: 2, todo: 0, doing: 1, review: 0, done: 1, blocked: 0 });
});

test("tasks: claimable respects owner hint and deps", async () => {
  await tasks.addTask(P, { title: "for coder", owner: "coder" });
  await tasks.addTask(P, { title: "anyone" });
  const forCoder = tasks.claimable(P, "coder");
  assert.equal(forCoder.length, 2);
  const forReviewer = tasks.claimable(P, "reviewer");
  assert.equal(forReviewer.length, 1);
  assert.equal(forReviewer[0].title, "anyone");
});

test("tasks: concurrent claims — exactly one winner", async () => {
  const t = await tasks.addTask(P, { title: "contested" });
  const attempts = await Promise.allSettled([
    tasks.claimTask(P, t.id, "coder"),
    tasks.claimTask(P, t.id, "reviewer"),
    tasks.claimTask(P, t.id, "researcher"),
  ]);
  const wins = attempts.filter((a) => a.status === "fulfilled");
  assert.equal(wins.length, 1);
});

test("goal: set/verify acceptance with real shell checks", () => {
  goal.setGoal(P, "make it work");
  goal.setAcceptance(P, [
    { desc: "always passes", check: "true" },
    { desc: "always fails", check: "false" },
  ]);
  const r = goal.runAcceptance(P);
  assert.equal(r.passed, false);
  assert.deepEqual(r.results.map((x) => x.ok), [true, false]);
  goal.setAcceptance(P, [{ desc: "ok", check: "echo hi" }]);
  assert.equal(goal.runAcceptance(P).passed, true);
});

test("goal: empty acceptance never passes", () => {
  goal.setGoal(P, "vague goal");
  assert.equal(goal.runAcceptance(P).passed, false);
});

test("heuristics: learn caps at 30 and signals consolidation", () => {
  for (let i = 0; i < 30; i++) {
    const r = heur.learn(P, "coder", `lesson ${i}`);
    assert.equal(r.added, true);
  }
  const overflow = heur.learn(P, "coder", "one too many");
  assert.equal(overflow.added, false);
  assert.equal(overflow.full, true);
  assert.equal(heur.countHeuristics(P, "coder"), 30);
});

test("config: profile 'test' forces free model, deep-merges project file", () => {
  fs.writeFileSync(
    path.join(P, "quorum.config.json"),
    JSON.stringify({ budgets: { maxTurnsPerAgent: 7 } }),
  );
  const cfg = loadConfig(P);
  assert.equal(cfg.budgets.maxTurnsPerAgent, 7);
  assert.equal(cfg.budgets.turnTimeoutSec, 420); // default preserved
  assert.equal(cfg.llm.models.coder[0], "claude-bridge/claude-sonnet-5");
  const testCfg = loadConfig(P, { profile: "test" });
  assert.deepEqual(testCfg.llm.models.coder, ["mantle/zai.glm-4.7-flash"]);
});

test("q CLI: 'goal status done' refuses when acceptance not passing", () => {
  const Q = path.join(HERE, "..", "bin", "q.mjs");
  goal.setGoal(P, "guarded goal");
  goal.setAcceptance(P, [{ desc: "fails", check: "false" }]);
  const env = { ...process.env, QUORUM_PROJECT: P, QUORUM_ROLE: "orchestrator" };
  assert.throws(
    () => execFileSync("node", [Q, "goal", "status", "done"], { env, encoding: "utf8", stdio: "pipe" }),
    /refusing 'done'/,
  );
  assert.equal(goal.getGoal(P).status, "active");
  goal.setAcceptance(P, [{ desc: "passes", check: "true" }]);
  execFileSync("node", [Q, "goal", "status", "done"], { env, encoding: "utf8", stdio: "pipe" });
  assert.equal(goal.getGoal(P).status, "done");
});

test("quorum CLI: --check flags become locked acceptance floor", () => {
  const QUORUM = path.join(HERE, "..", "bin", "quorum.mjs");
  // launches a fleet we immediately stop; use fake profile so no tokens even if a turn fires
  execFileSync(
    "node",
    [QUORUM, "goal", "make", "it", "so", "--profile", "fake", "--check", "node --test x.test.mjs", "--check", "test -x run.sh", "--project", P],
    { encoding: "utf8", stdio: "pipe" },
  );
  try {
    execFileSync("node", [QUORUM, "stop", "--project", P], { stdio: "pipe" });
  } catch {}
  const g = goal.getGoal(P);
  assert.equal(g.acceptance.length, 2);
  assert.ok(g.acceptance.every((a) => a.locked));
  assert.equal(g.acceptance[0].check, "node --test x.test.mjs");
});

test("goal: undefined/invalid status rejected; locked checks survive re-set and setAcceptance", () => {
  goal.setGoal(P, "g", { acceptance: [{ desc: "human: tests", check: "node --test", locked: true }] });
  assert.throws(() => goal.updateGoal(P, { status: undefined }), /bad goal status/);
  // setAcceptance that drops the locked check silently restores it
  goal.setAcceptance(P, [{ desc: "agent check", check: "true" }]);
  const g = goal.getGoal(P);
  assert.equal(g.acceptance.length, 2);
  assert.ok(g.acceptance.some((a) => a.locked && a.check === "node --test"));
  assert.equal(g.status, "active");
});

test("q CLI: 'goal set' refuses overwrite of active goal; keeps locked floor with --force", () => {
  const Q = path.join(HERE, "..", "bin", "q.mjs");
  const env = { ...process.env, QUORUM_PROJECT: P, QUORUM_ROLE: "planner" };
  goal.setGoal(P, "orig", { acceptance: [{ desc: "human: t", check: "true", locked: true }] });
  assert.throws(
    () => execFileSync("node", [Q, "goal", "set", "new goal"], { env, encoding: "utf8", stdio: "pipe" }),
    /refusing overwrite/,
  );
  execFileSync("node", [Q, "goal", "set", "new goal", "--force"], { env, encoding: "utf8", stdio: "pipe" });
  const g = goal.getGoal(P);
  assert.equal(g.text, "new goal");
  assert.equal(g.acceptance.length, 1);
  assert.ok(g.acceptance[0].locked);
  assert.throws(
    () => execFileSync("node", [Q, "goal", "status"], { env, encoding: "utf8", stdio: "pipe" }),
    /need one of/,
  );
});

test("lock: serializes concurrent mutations", async () => {
  const lock = path.join(P, ".quorum", "locks", "x.lock");
  let inCritical = 0;
  let maxConcurrent = 0;
  await Promise.all(
    Array.from({ length: 8 }, () =>
      withLock(lock, async () => {
        inCritical++;
        maxConcurrent = Math.max(maxConcurrent, inCritical);
        await new Promise((r) => setTimeout(r, 10));
        inCritical--;
      }),
    ),
  );
  assert.equal(maxConcurrent, 1);
});
