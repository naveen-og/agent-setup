import fs from "node:fs";
import path from "node:path";
import { qdir, newId, nowIso, readJson, writeJsonAtomic, ROLES } from "./util.mjs";

const TYPES = [
  "propose", "critique", "approve", "update", "block", "unblock",
  "assign", "done", "question", "answer", "reflect", "say", "system",
];

export function busFile(projectDir) {
  return path.join(qdir(projectDir), "bus", "events.jsonl");
}

function cursorFile(projectDir, role) {
  return path.join(qdir(projectDir), "bus", "cursors", `${role}.json`);
}

export function send(projectDir, { from, to, type, body, task, refs }) {
  if (!from) throw new Error("send: 'from' required");
  if (!TYPES.includes(type)) throw new Error(`send: bad type '${type}' (valid: ${TYPES.join(", ")})`);
  const toList = Array.isArray(to) ? to : [to || "*"];
  for (const t of toList) {
    if (t !== "*" && t !== "human" && !ROLES.includes(t)) throw new Error(`send: unknown recipient '${t}'`);
  }
  const evt = { id: newId(), ts: nowIso(), v: 1, from, to: toList, type, body: String(body ?? "") };
  if (task) evt.task = task;
  if (refs?.length) evt.refs = refs;
  const file = busFile(projectDir);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // single-line O_APPEND write: atomic for our line sizes
  fs.appendFileSync(file, JSON.stringify(evt) + "\n");
  return evt;
}

export function readAll(projectDir) {
  const file = busFile(projectDir);
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null; // tolerate a torn/corrupt line
      }
    })
    .filter(Boolean);
}

// Events addressed to `role` (or broadcast) after its cursor. Advances cursor when consume=true.
export function readNew(projectDir, role, { consume = true, includeAll = false } = {}) {
  const file = busFile(projectDir);
  const cf = cursorFile(projectDir, role);
  const cur = readJson(cf, { offset: 0 });
  if (!fs.existsSync(file)) return [];
  const buf = fs.readFileSync(file);
  if (cur.offset >= buf.length) return [];
  // only consume up to the last complete line
  let end = buf.length;
  while (end > cur.offset && buf[end - 1] !== 0x0a) end--;
  if (end <= cur.offset) return [];
  const chunk = buf.slice(cur.offset, end).toString("utf8");
  const events = chunk
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  if (consume) writeJsonAtomic(cf, { offset: end, ts: nowIso() });
  if (includeAll) return events;
  return events.filter((e) => e.from !== role && (e.to.includes(role) || e.to.includes("*")));
}

export function resetCursor(projectDir, role) {
  writeJsonAtomic(cursorFile(projectDir, role), { offset: 0, ts: nowIso() });
}
