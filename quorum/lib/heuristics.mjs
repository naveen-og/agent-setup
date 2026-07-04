import fs from "node:fs";
import path from "node:path";
import { qdir, nowIso, ROLES } from "./util.mjs";

const MAX_HEURISTICS = 30;

function heurFile(projectDir, role) {
  return path.join(qdir(projectDir), "memory", "heuristics", `${role}.md`);
}

export function playbookFile(projectDir) {
  return path.join(qdir(projectDir), "memory", "playbook.md");
}

export function readHeuristics(projectDir, role) {
  const f = heurFile(projectDir, role);
  return fs.existsSync(f) ? fs.readFileSync(f, "utf8") : "";
}

export function readPlaybook(projectDir) {
  const f = playbookFile(projectDir);
  return fs.existsSync(f) ? fs.readFileSync(f, "utf8") : "";
}

export function countHeuristics(projectDir, role) {
  return readHeuristics(projectDir, role)
    .split("\n")
    .filter((l) => l.startsWith("- ")).length;
}

// Append a learned heuristic. Returns {added, count, full} — full=true means
// the role must consolidate (rewrite its file) before it can add more.
export function learn(projectDir, role, text) {
  if (!ROLES.includes(role)) throw new Error(`learn: unknown role '${role}'`);
  if (!text?.trim()) throw new Error("learn: empty heuristic");
  const f = heurFile(projectDir, role);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const count = countHeuristics(projectDir, role);
  if (count >= MAX_HEURISTICS) return { added: false, count, full: true };
  if (!fs.existsSync(f)) fs.writeFileSync(f, `# Learned heuristics — ${role}\n\n`);
  fs.appendFileSync(f, `- [${nowIso().slice(0, 10)}] ${text.trim().replace(/\n+/g, " ")}\n`);
  return { added: true, count: count + 1, full: count + 1 >= MAX_HEURISTICS };
}

// Consolidation: role rewrites its whole file (done via normal file edit by the
// agent); this validates the result stays within budget.
export function validateHeuristics(projectDir, role) {
  const count = countHeuristics(projectDir, role);
  return { count, ok: count <= MAX_HEURISTICS };
}
