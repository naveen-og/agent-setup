import path from "node:path";
import { qdir, readJson, writeJsonAtomic, withLock, nowIso, ROLES } from "./util.mjs";

const STATUSES = ["todo", "doing", "review", "done", "blocked"];

function tasksFile(projectDir) {
  return path.join(qdir(projectDir), "tasks.json");
}
function lockDir(projectDir) {
  return path.join(qdir(projectDir), "locks", "tasks.lock");
}

export function loadBoard(projectDir) {
  return readJson(tasksFile(projectDir), { seq: 0, tasks: [] });
}

async function mutate(projectDir, fn) {
  return withLock(lockDir(projectDir), () => {
    const board = loadBoard(projectDir);
    const result = fn(board);
    writeJsonAtomic(tasksFile(projectDir), board);
    return result;
  });
}

export async function addTask(projectDir, { title, acceptance = "", deps = [], owner = null }) {
  if (!title) throw new Error("task add: title required");
  return mutate(projectDir, (b) => {
    b.seq += 1;
    const t = {
      id: `t${b.seq}`,
      title,
      status: "todo",
      owner,
      deps,
      acceptance,
      notes: [],
      updated: nowIso(),
    };
    b.tasks.push(t);
    return t;
  });
}

export async function claimTask(projectDir, id, role) {
  if (!ROLES.includes(role)) throw new Error(`claim: unknown role '${role}'`);
  return mutate(projectDir, (b) => {
    const t = b.tasks.find((x) => x.id === id);
    if (!t) throw new Error(`claim: no task ${id}`);
    if (t.status !== "todo") throw new Error(`claim: ${id} is '${t.status}', not 'todo'`);
    const unmet = t.deps.filter((d) => b.tasks.find((x) => x.id === d)?.status !== "done");
    if (unmet.length) throw new Error(`claim: ${id} blocked by unmet deps: ${unmet.join(",")}`);
    t.status = "doing";
    t.owner = role;
    t.updated = nowIso();
    return t;
  });
}

export async function setStatus(projectDir, id, status, { note, by } = {}) {
  if (!STATUSES.includes(status)) throw new Error(`bad status '${status}' (valid: ${STATUSES.join(",")})`);
  return mutate(projectDir, (b) => {
    const t = b.tasks.find((x) => x.id === id);
    if (!t) throw new Error(`no task ${id}`);
    t.status = status;
    t.updated = nowIso();
    if (note) t.notes.push({ ts: nowIso(), by: by || "?", note });
    return t;
  });
}

export function claimable(projectDir, role) {
  const b = loadBoard(projectDir);
  return b.tasks.filter(
    (t) =>
      t.status === "todo" &&
      (!t.owner || t.owner === role) &&
      t.deps.every((d) => b.tasks.find((x) => x.id === d)?.status === "done"),
  );
}

export function summary(projectDir) {
  const b = loadBoard(projectDir);
  const by = {};
  for (const s of STATUSES) by[s] = b.tasks.filter((t) => t.status === s).length;
  return { total: b.tasks.length, ...by };
}
