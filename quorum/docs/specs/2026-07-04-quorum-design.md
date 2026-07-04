# Quorum — 5-Agent Peer-to-Peer Coding Fleet

**Date:** 2026-07-04 · **Status:** approved (Naveen delegated final call)

## What It Is

Quorum turns any project directory into a workspace for five concurrent AI engineers — Planner, Coder, Reviewer, Researcher, Orchestrator — coordinated entirely through files. One command (`/goal` in pi, or `quorum goal` anywhere) starts the fleet; it works autonomously until the goal's acceptance criteria pass, then writes a final report and idles.

## Core Bet: The Filesystem Is the Protocol

Every piece of coordination state lives in a `.quorum/` directory inside the target project:

```
.quorum/
  goal.json              goal text, acceptance criteria, status, budgets
  bus/events.jsonl       single append-only event log (total order, replayable)
  bus/cursors/<role>.json  each agent's read position
  tasks.json             task board (todo/doing/review/done/blocked), lock-guarded
  plan.md                living plan (Planner owns)
  memory/heuristics/<role>.md   per-role learned heuristics (Reflexion/ERL style)
  memory/playbook.md     shared cross-agent patterns (Orchestrator curates)
  report.md              final report (Orchestrator writes on completion)
  locks/                 lock files for guarded writes
```

Why this wins on future-proofing:

- **Model-agnostic:** agents are *stateless functions over shared files*. Each turn is a fresh one-shot LLM invocation whose entire context is rebuilt from `.quorum/`. No in-process memory, no session affinity, no model-specific feature anywhere.
- **Harness-agnostic:** the turn executor is one configurable command (`pi -p` today; `claude -p`, `opencode run`, or anything else tomorrow). Swap the command, keep the workflow.
- **Inspectable & replayable:** `cat .quorum/bus/events.jsonl` is the full team conversation. Event sourcing for free.
- **Crash-proof:** any agent (or the whole machine) can die and resume — state is on disk.

A2A gave us the message semantics (task lifecycle, typed envelopes, refs); we transport them over files instead of HTTP because the fleet is local.

## Message Schema (v1)

One JSON object per line in `bus/events.jsonl`:

```json
{
  "id": "evt-01J...",        // ulid-ish, sortable
  "ts": "2026-07-04T10:00:00Z",
  "v": 1,
  "from": "planner",
  "to": ["coder"],           // or ["*"] broadcast
  "type": "propose | critique | approve | update | block | unblock |
           assign | done | question | answer | reflect | say | system",
  "task": "t3",              // optional task ref
  "refs": ["evt-..."],       // optional reply-to chain
  "body": "free text ≤ ~200 words"
}
```

Appends are single-line `O_APPEND` writes (atomic well under the 4KB pipe-buffer bound). Readers filter by `to` containing their role or `*`, tracked via cursor byte offset.

## Task Board

`tasks.json`: `{ "seq": 7, "tasks": [{ "id":"t3", "title":..., "status":"todo|doing|review|done|blocked", "owner":"coder", "deps":["t1"], "acceptance":"...", "notes":[...] }] }`. All writes go through the `q` CLI which takes an exclusive lock (`locks/tasks.lock`, mkdir-based, portable) — agents never edit it by hand.

## Roles

| Role | Duty | Turn trigger |
|------|------|-------------|
| Planner | Decompose goal → acceptance criteria + task board; keep plan.md alive; re-plan on blocks | new goal, block events, plan drift |
| Coder | Claim `todo` tasks, implement + tests, mark `review` | assignable tasks, review feedback |
| Reviewer | Review `review` tasks: correctness, security, tests; approve→`done` or critique→`doing` | tasks in review |
| Researcher | Answer `question` events; proactive research on new tech in plan | questions, new plan sections |
| Orchestrator | Route/unblock, detect stalls, verify acceptance criteria (runs real commands), write report, curate playbook, interface with human `say` events | every cycle |

Peer-to-peer: any agent may message any agent. Orchestrator is first-among-equals — owns goal verdict, not a message broker.

## Turn Loop (per agent, run by supervisor)

1. Read new bus events for me. Nothing relevant + no claimable work → sleep (backoff 5s→60s), skip LLM entirely (zero burn when idle).
2. Compose prompt: role prompt + goal + plan.md + task board + my heuristics + playbook + new events (+ tail of recent broadcast context).
3. Execute turn: spawn `<llm_cmd> -p <prompt>` **in the project dir** — the harness's own tools (edit/bash) let the agent act on code directly. The prompt instructs it to communicate only via `q send ...` / `q task ...` shell commands.
4. Reflect: prompt requires ending with a reflection; significant lessons appended to `memory/heuristics/<role>.md` via `q learn` (bounded: max 30 heuristics/role, agent must merge/replace, not hoard — SkillOps curation).
5. Loop until `goal.json.status ∈ {done, failed, stopped}`.

## Evolution Layer

- `q learn <role> "<heuristic>"` appends dated heuristics; file capped, agent told to consolidate when full.
- Heuristics are injected into every future turn of that role → behavioral learning without retraining.
- Orchestrator every N cycles promotes cross-cutting lessons into `playbook.md` (all roles read it).
- `reflect` events on the bus make learning visible/auditable.

## Config (`quorum.config.json`, per project or global default)

```json
{
  "llm": {
    "cmd": "pi",
    "args": ["-p", "--mode", "text", "--no-session"],
    "models": {
      "orchestrator": ["claude-bridge/claude-fable-5", "mantle/zai.glm-4.7"],
      "planner":      ["claude-bridge/claude-fable-5", "mantle/moonshotai.kimi-k2-thinking"],
      "reviewer":     ["claude-bridge/claude-opus-4-8", "mantle/zai.glm-4.7"],
      "coder":        ["claude-bridge/claude-sonnet-5", "mantle/qwen.qwen3-coder-480b-a35b-instruct"],
      "researcher":   ["claude-bridge/claude-sonnet-5", "mantle/moonshotai.kimi-k2.5"]
    }
  },
  "budgets": { "maxTurnsPerAgent": 40, "turnTimeoutSec": 420, "maxWallClockMin": 240 },
  "profiles": { "test": "all roles → mantle/zai.glm-4.7-flash", "fake": "scripted responses" }
}
```

First model in list that the executor accepts wins; on failure, next in chain. Removing claude-bridge = fleet silently uses column 2. **That is the Fable-5-removal guarantee.**

## Goal Completion

`goal.json.acceptance` = array of `{ "desc": ..., "check": "<shell command>" }` (Planner writes them turn 1; human can pre-supply). Orchestrator runs checks when all tasks `done`; all pass → status `done`, writes `report.md` (what was done, files changed via `git diff --stat`, tests, open risks, next steps). Any fail → reopens tasks with critique.

## Failure Modes

| Failure | Handling |
|---------|----------|
| Agent turn hangs | supervisor kills child at `turnTimeoutSec`, logs `system` event, retries next cycle |
| Agent crash-loops | 3 consecutive failures → role paused, `block` event to Orchestrator |
| Model unavailable | fallback chain in config |
| Two coders… n/a (one coder) — task conflicts | task claim via locked `q task claim` (first wins) |
| Stall (no bus activity, tasks not done) | Orchestrator stall detector → nudge/re-plan after `stallMin` |
| Budget exhausted | fleet stops, Orchestrator writes partial report with status `failed:budget` |
| Malformed agent output | agents act only via `q` CLI (validates input); prose output otherwise ignored |
| Human interjection | `quorum say "..."` → broadcast `say` event, Orchestrator must acknowledge |

## Success Metrics

- Goal completion rate (acceptance checks green) per goal
- Wall-clock + turns per goal (efficiency trend across goals = evolution signal)
- Review rejection rate (Coder quality trend)
- Heuristics reuse: turns citing a heuristic / total turns
- Zero-token idle: bus quiet ⇒ no LLM spend

## Testing Strategy (no Claude tokens)

1. **Unit:** `node --test` on lib (bus, cursors, locks, tasks, config) — no LLM.
2. **Integration:** `fake` profile — executor is a script replaying canned role responses; full 5-agent goal runs deterministically offline.
3. **Live smoke:** free models (`mantle/zai.glm-4.7-flash`) one turn per role.
4. **Demo goal:** small real feature in a scratch repo on free models; trace saved to docs.

## Deliverables

`/home/blarz/quorum`: `bin/quorum` (CLI), `lib/*.mjs` (zero-dep Node), `prompts/*.md`, `extension/index.ts` (pi wrapper: `/goal`, `/say`, `/fleet-status`, `/fleet-stop`), tests, docs (schema, example trace, portability guide for Claude Code/OpenCode).
