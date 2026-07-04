#!/usr/bin/env node
// Scripted stand-in for an LLM turn. Used by the 'fake' profile so the entire
// fleet (supervisor, bus, tasks, goal, evolution) is integration-tested
// deterministically with zero tokens. Behaves like a disciplined agent:
// reads shared state, acts, communicates via the same lib the q CLI uses.
import fs from "node:fs";
import path from "node:path";
import * as bus from "./bus.mjs";
import * as tasks from "./tasks.mjs";
import * as goal from "./goal.mjs";
import * as heur from "./heuristics.mjs";
import { qdir } from "./util.mjs";

const role = process.argv[2] || process.env.QUORUM_ROLE;
const P = process.env.QUORUM_PROJECT || process.cwd();
const g = goal.getGoal(P);
if (!g || g.status !== "active") process.exit(0);

const board = () => tasks.loadBoard(P);
const say = (to, type, body, extra = {}) => bus.send(P, { from: role, to: [to], type, body, ...extra });

switch (role) {
  case "planner": {
    if (board().tasks.length === 0) {
      fs.writeFileSync(
        path.join(qdir(P), "plan.md"),
        `# Plan\n\nGoal: ${g.text}\n\n1. t1 — create hello.txt (coder)\n2. t2 — document it in HELLO.md (coder, after t1)\n`,
      );
      goal.setAcceptance(P, [
        { desc: "hello.txt says hello world", check: "grep -q 'hello world' hello.txt" },
        { desc: "HELLO.md exists", check: "test -f HELLO.md" },
      ]);
      const t1 = await tasks.addTask(P, { title: "create hello.txt containing 'hello world'", owner: "coder", acceptance: "grep -q 'hello world' hello.txt" });
      const t2 = await tasks.addTask(P, { title: "write HELLO.md documenting the file", owner: "coder", deps: [t1.id] });
      say("coder", "assign", `Tasks ${t1.id}, ${t2.id} are yours. Plan in .quorum/plan.md.`, { task: t1.id });
      say("researcher", "question", "Any pitfalls writing plain-text files cross-platform?");
      heur.learn(P, role, "Always define acceptance criteria as runnable shell checks in the same turn as decomposition.");
    }
    break;
  }
  case "researcher": {
    const answered = bus.readAll(P).some((e) => e.from === role && e.type === "answer");
    const question = bus.readAll(P).find((e) => e.type === "question" && e.to.includes(role));
    if (question && !answered) {
      say("planner", "answer", "Use LF line endings and UTF-8; no BOM. No other pitfalls for plain text.", { refs: [question.id] });
      heur.learn(P, role, "Answer concretely and cite the question event id in refs.");
    }
    break;
  }
  case "coder": {
    for (const t of tasks.claimable(P, role)) await tasks.claimTask(P, t.id, role);
    for (const t of board().tasks.filter((x) => x.status === "doing" && x.owner === role)) {
      const critiqued = t.notes.some((n) => n.by === "reviewer");
      if (t.title.includes("hello.txt")) {
        // first pass intentionally imperfect (no trailing newline) → reviewer critiques
        fs.writeFileSync(path.join(P, "hello.txt"), critiqued ? "hello world\n" : "hello world");
      } else {
        fs.writeFileSync(path.join(P, "HELLO.md"), "# HELLO\n\nhello.txt greets the world.\n");
      }
      await tasks.setStatus(P, t.id, "review", { by: role, note: "implemented" });
      say("reviewer", "done", `${t.id} ready for review.`, { task: t.id });
    }
    heur.learn(P, role, "Re-read reviewer notes before resubmitting a task.");
    break;
  }
  case "reviewer": {
    for (const t of board().tasks.filter((x) => x.status === "review")) {
      if (t.title.includes("hello.txt")) {
        const content = fs.readFileSync(path.join(P, "hello.txt"), "utf8");
        if (!content.endsWith("\n")) {
          await tasks.setStatus(P, t.id, "doing", { by: role, note: "missing trailing newline (POSIX text file)" });
          say("coder", "critique", `${t.id}: add trailing newline, POSIX text files end with one.`, { task: t.id });
          continue;
        }
      }
      await tasks.setStatus(P, t.id, "done", { by: role, note: "approved" });
      say("coder", "approve", `${t.id} approved.`, { task: t.id });
    }
    heur.learn(P, role, "Check POSIX text conventions (trailing newline) on every file artifact.");
    break;
  }
  case "orchestrator": {
    const b = board();
    if (b.tasks.length && b.tasks.every((t) => t.status === "done")) {
      const r = goal.runAcceptance(P);
      if (r.passed) {
        fs.writeFileSync(
          path.join(qdir(P), "report.md"),
          `# Quorum report\n\n**Goal:** ${g.text}\n**Status:** done\n\n## What was done\n${b.tasks.map((t) => `- ${t.id}: ${t.title} (${t.owner})`).join("\n")}\n\n## Acceptance\n${r.results.map((x) => `- [x] ${x.desc}`).join("\n")}\n\n## Open risks\nNone.\n\n## Next steps\nNone — goal complete.\n`,
        );
        goal.updateGoal(P, { status: "done" });
        say("*", "update", "All acceptance checks green. Goal complete, report written.");
        heur.learn(P, role, "Verify acceptance with real command runs before declaring done.");
      } else {
        const failed = r.results.filter((x) => !x.ok).map((x) => x.desc).join("; ");
        say("planner", "block", `Acceptance failing: ${failed}. Re-plan.`);
      }
    }
    break;
  }
}
console.log(`[fake-llm] ${role} turn complete`);
