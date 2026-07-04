# Quorum

My 5-agent AI engineering fleet. I give it one goal, five agents — Planner, Coder, Reviewer, Researcher, Orchestrator — work on it in parallel, argue with each other over a shared message bus, and stop when the acceptance checks pass. Then I read one report.

The trick that makes it future-proof: **the filesystem is the protocol.** There's no framework, no server, no vendor SDK. All coordination lives in a `.quorum/` directory — an append-only JSONL event bus, a task board, a living plan, a goal contract, and a memory the agents write lessons into. Agents are stateless one-shot LLM invocations that rebuild their whole context from those files every turn. Swap the model, swap the harness, kill the machine mid-run — nothing is lost, because nothing lives anywhere else.

## Quick start

```bash
# inside any project directory
node /home/blarz/quorum/bin/quorum.mjs goal "Add rate limiting to the API, with tests"

# watch the team talk
node /home/blarz/quorum/bin/quorum.mjs log --tail 20
node /home/blarz/quorum/bin/quorum.mjs status

# interject mid-run
node /home/blarz/quorum/bin/quorum.mjs say "use sliding window, not fixed buckets"

# when it's done
node /home/blarz/quorum/bin/quorum.mjs report
```

Inside pi, it's a slash command: `/goal <text>`, `/fleet-status`, `/say <msg>`, `/fleet-stop`, `/fleet-report`.

## The five agents

| Agent | Owns | Never does |
|-------|------|-----------|
| **Planner** | decomposition, living plan, acceptance criteria as *runnable shell checks* | write code |
| **Coder** | implementation + tests | approve its own work |
| **Reviewer** | correctness, security, test quality; sole authority to mark `done` | fix code itself |
| **Researcher** | external knowledge, docs, library picks | touch the project |
| **Orchestrator** | goal verification, conflict resolution, human interface, team evolution | code or plan |

Peer-to-peer: anyone can message anyone. The Orchestrator is first among equals — it owns the goal verdict, not the conversation.

## Why it survives any model or harness

- **Models** are a per-role fallback chain in `quorum.config.json`. Today: claude-bridge (Fable 5 / Opus 4.8 / Sonnet 5). Remove claude-bridge and the fleet silently drops to the free Bedrock column. No code change.
- **The turn executor is one configurable command.** Today it's `pi -p`. Point it at `claude -p`, `opencode run`, or anything that can read a prompt file and use shell/file tools — the workflow is identical because the protocol never leaves the filesystem.
- **Zero runtime dependencies.** Plain Node, `node:test`, JSONL, mkdir locks.

## Evolution layer

Every agent ends every turn with a reflection. Durable lessons go to `.quorum/memory/heuristics/<role>.md` via `q learn` (capped at 30 — the agent must consolidate, not hoard). The Orchestrator promotes cross-cutting lessons into `memory/playbook.md`, which every agent reads every turn. The team genuinely gets better at working together across goals, with no retraining.

## Cost discipline

Wake-checks are pure file reads — an idle agent costs zero tokens. The fleet only spends when there's a message to act on or work to claim, and goes fully quiet when the goal leaves `active`. Budgets (`maxTurnsPerAgent`, `turnTimeoutSec`, `maxWallClockMin`) hard-stop runaways.

## Testing

```bash
node --test test/          # 13 tests, zero tokens
```

- Unit tests cover the protocol: bus atomicity, cursor delivery, torn-line tolerance, task claiming races, lock serialization, goal verification, heuristic caps.
- The integration test runs the **entire fleet** against a scripted fake LLM: plan → assign → code → critique → fix → approve → verify → report, deterministically, offline.
- Live smokes run on free models (`--profile test`) so validating changes never costs Claude tokens.

## Layout

```
bin/quorum.mjs      human CLI (goal/run/status/log/say/report/stop)
bin/q.mjs           agent protocol CLI (send/read/task/goal/learn) — agents' only write path
bin/fleet.mjs       supervisor: 5 concurrent turn loops + watchdog
lib/                bus, tasks, goal, heuristics, config, prompt composer, executor
prompts/            the five role prompts
extension/index.ts  pi wrapper (slash commands)
docs/               design spec, protocol reference, example trace, portability
test/               unit + integration (fake LLM)
```

More detail: [docs/protocol.md](docs/protocol.md) · [docs/portability.md](docs/portability.md) · [docs/example-trace.md](docs/example-trace.md) · [design spec](docs/specs/2026-07-04-quorum-design.md)
