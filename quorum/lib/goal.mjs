import path from "node:path";
import { execSync } from "node:child_process";
import { qdir, readJson, writeJsonAtomic, nowIso } from "./util.mjs";

const GOAL_STATUSES = ["active", "done", "failed", "stopped"];

function goalFile(projectDir) {
  return path.join(qdir(projectDir), "goal.json");
}

export function getGoal(projectDir) {
  return readJson(goalFile(projectDir));
}

export function setGoal(projectDir, text, { acceptance = [] } = {}) {
  const goal = {
    text,
    status: "active",
    acceptance, // [{desc, check}] — check is a shell command, exit 0 = pass
    created: nowIso(),
    updated: nowIso(),
    turns: {}, // role -> count, maintained by supervisor
  };
  writeJsonAtomic(goalFile(projectDir), goal);
  return goal;
}

export function updateGoal(projectDir, patch) {
  const goal = getGoal(projectDir);
  if (!goal) throw new Error("no active goal");
  if ("status" in patch && !GOAL_STATUSES.includes(patch.status)) throw new Error(`bad goal status '${patch.status}'`);
  Object.assign(goal, patch, { updated: nowIso() });
  writeJsonAtomic(goalFile(projectDir), goal);
  return goal;
}

export function setAcceptance(projectDir, acceptance) {
  // locked (human-supplied) checks are a floor: silently re-add any that were dropped
  const existing = getGoal(projectDir)?.acceptance || [];
  const kept = existing.filter(
    (a) => a.locked && !acceptance.some((n) => n.check === a.check),
  );
  return updateGoal(projectDir, { acceptance: [...kept, ...acceptance] });
}

// Run acceptance checks in project dir. Returns {passed, results:[{desc,check,ok,output}]}
export function runAcceptance(projectDir, { timeoutSec = 120 } = {}) {
  const goal = getGoal(projectDir);
  if (!goal) throw new Error("no active goal");
  const results = [];
  for (const a of goal.acceptance || []) {
    let ok = false;
    let output = "";
    try {
      output = execSync(a.check, {
        cwd: projectDir,
        timeout: timeoutSec * 1000,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }).slice(-2000);
      ok = true;
    } catch (e) {
      output = `${e.stdout || ""}\n${e.stderr || ""}`.trim().slice(-2000) || String(e.message);
    }
    results.push({ desc: a.desc, check: a.check, ok, output });
  }
  return { passed: results.length > 0 && results.every((r) => r.ok), results };
}
