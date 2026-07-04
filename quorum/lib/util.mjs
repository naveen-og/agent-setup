import fs from "node:fs";
import path from "node:path";

export const ROLES = ["planner", "coder", "reviewer", "researcher", "orchestrator"];

export function qdir(projectDir) {
  return path.join(projectDir, ".quorum");
}

export function nowIso() {
  return new Date().toISOString();
}

let lastId = "";
export function newId(prefix = "evt") {
  // time-sortable: base36 ms + 4 random chars; bump if collision within same ms
  let id;
  do {
    id = `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  } while (id === lastId);
  lastId = id;
  return id;
}

export function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

export function writeJsonAtomic(file, obj) {
  const tmp = `${file}.tmp-${process.pid}-${Math.random().toString(36).slice(2, 6)}`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + "\n");
  fs.renameSync(tmp, file);
}

// Portable exclusive lock via mkdir (atomic on POSIX). Stale after staleMs.
export async function withLock(lockDir, fn, { timeoutMs = 10000, staleMs = 60000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  fs.mkdirSync(path.dirname(lockDir), { recursive: true });
  for (;;) {
    try {
      fs.mkdirSync(lockDir);
      break;
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
      try {
        const age = Date.now() - fs.statSync(lockDir).mtimeMs;
        if (age > staleMs) {
          fs.rmdirSync(lockDir);
          continue;
        }
      } catch {
        continue; // lock vanished between check and stat — retry
      }
      if (Date.now() > deadline) throw new Error(`lock timeout: ${lockDir}`);
      await new Promise((r) => setTimeout(r, 50 + Math.random() * 100));
    }
  }
  try {
    return await fn();
  } finally {
    try {
      fs.rmdirSync(lockDir);
    } catch {}
  }
}
