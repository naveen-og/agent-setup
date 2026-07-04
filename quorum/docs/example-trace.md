# Example traces (real runs, free models)

Both traces below are from actual fleet runs on `mantle/zai.glm-4.7-flash` (the *weakest* model in the config — chosen deliberately: if the protocol holds the team together at this level, stronger models only improve it).

## Trace 1 — smoke: executable greeting script

Goal: *"Create greet.sh that prints exactly 'Hello Quorum' and is executable."*

Result: **done** in 47s wall clock, 11 turns total, all five roles participated.

```
21:19:59 human       → *            [say]      New goal: Create greet.sh ...
21:20:13 planner     → coder        [assign]   t1/t2/t3 created, plan.md written, acceptance checks set
21:20:17 coder       → reviewer     [done]     t1 ready for review
21:20:30 researcher  → planner      [answer]   shebang + permission guidance
21:20:40 reviewer    → coder        [critique] verify content matches exactly
21:20:43 coder       → reviewer     [done]     fixed + resubmitted
21:20:44 orchestrator→ *            [update]   GOAL COMPLETE ✓ greet.sh verified, report written
```

Artifacts: `greet.sh` (`#!/bin/bash` + `echo "Hello Quorum"`, mode 755), `.quorum/report.md` following the report template, and **7 learned heuristics across 5 roles**, e.g.:

> - coder: "Verify script output by running it after chmod before submitting — write+chmod alone isn't enough"
> - planner: "Verify task completion by checking physical artifacts (files) before updating the task board; otherwise plan state may diverge from reality."

## Trace 2 — feature: todo CLI app with tests

Goal: *"Build a Node.js CLI todo app: todo.mjs with add <text>, list, done <id>. State persists to todos.json. Tests in todo.test.mjs runnable via `node --test`, all passing."*

Run with `--check "node --test todo.test.mjs"` (locked human acceptance floor) on the free `test` profile (glm-4.7-flash for every role).

**First attempt exposed two real protocol bugs, both now fixed:** the flash planner ran `q goal status` with no argument, which set `status: undefined` — `JSON.stringify` dropped the key and every agent loop exited (goal no longer "active"). It also re-ran `q goal set`, wiping the locked human check. Fixes: `updateGoal` rejects missing/invalid status, `q goal set` refuses to overwrite an active goal, `setAcceptance` silently restores any dropped locked checks, `accept-add` dedupes. Ironically the half-built app's own tests passed 6/6 — the fleet died of state corruption, not bad code.

**Second attempt (hardened): honest `done` in ~5 min.** `todo.mjs` (110 lines) + `todo.test.mjs` (175 lines), locked check passes, report accurate including an open-risks section the orchestrator wrote itself. Residual quality gap is model-grade, not protocol-grade: `done <id>` wants the internal timestamp ID rather than the displayed list index. A stronger coder model (the default claude-bridge chain) would catch that; the protocol guarantees honesty, not brilliance.

Representative bus excerpt mid-run — the peer-to-peer texture is visible: planner chasing the coder, reviewer refusing to review work not yet submitted, statuses flowing:

```
21:54:48 reviewer    → orchestrator [update]  progress ping
21:54:49 planner     → coder        [assign]  t1 complete. Assigning t2 (add command)
21:55:03 reviewer    → planner      [say]     waiting for coder to move tasks to 'review' before verdicts
21:55:08 planner     → coder        [assign]  t1 verified done — claim t2
21:55:18 planner     → *            [update]  assigned coder to t2, sequential build order
```

## Reading a live fleet

```bash
quorum status          # goal, per-role turn counts, task summary, last 8 events
quorum log --tail 30   # raw conversation
tail -f <project>/.quorum/logs/fleet.log   # supervisor view: turn starts/finishes/failures
cat <project>/.quorum/logs/coder.log       # full transcript of every coder turn
```
