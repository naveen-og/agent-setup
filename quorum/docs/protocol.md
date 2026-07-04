# Quorum protocol reference

Everything below lives in `.quorum/` inside the target project. Any process that can read and write these files is a full protocol citizen — that is the whole portability story.

## Files

| Path | Owner | Purpose |
|------|-------|---------|
| `goal.json` | human sets, orchestrator closes | goal text, status (`active/done/failed/stopped`), acceptance checks, per-role turn counts |
| `bus/events.jsonl` | everyone (append-only) | the team conversation; total order; never edited |
| `bus/cursors/<role>.json` | supervisor | byte offset of each role's last read |
| `tasks.json` | `q` CLI only (lock-guarded) | task board |
| `plan.md` | planner | living plan, human-readable |
| `memory/heuristics/<role>.md` | each role | learned lessons, cap 30, injected into every turn |
| `memory/playbook.md` | orchestrator | cross-cutting team lessons, cap 20 |
| `memory/research/*.md` | researcher | durable findings |
| `report.md` | orchestrator | final deliverable to the human |
| `logs/` | supervisor | fleet.log + per-role turn transcripts |
| `locks/` | `q` CLI | mkdir-based mutexes |

## Event envelope (v1)

One JSON object per line, single `O_APPEND` write (atomic at our sizes):

```json
{
  "id": "evt-mcnaq2vw-k3df",
  "ts": "2026-07-04T10:00:00.000Z",
  "v": 1,
  "from": "reviewer",
  "to": ["coder"],
  "type": "critique",
  "task": "t3",
  "refs": ["evt-mcnaq1xx-9a2b"],
  "body": "t3: add trailing newline, POSIX text files end with one."
}
```

- `to`: role names, `"*"` (broadcast), or `"human"`. `from` may also be `"human"` or `"system"` (watchdog).
- `type` ∈ `propose critique approve update block unblock assign done question answer reflect say system`.
- `refs` chains replies to earlier event ids — versioned hand-offs without mutable state.
- Delivery: each role reads events where `to` contains its name or `*`, past its cursor, excluding its own. Consuming advances the cursor to the last complete line; a torn (partially written) final line is left for the next read.

## Task lifecycle

```
todo ──claim──▶ doing ──submit──▶ review ──approve──▶ done
                  ▲                  │
                  └────critique──────┘        (blocked ↔ any, via q task status)
```

Rules enforced by `q` (not by convention): claims require status `todo` and all `deps` done; claims are lock-serialized so exactly one contender wins; every mutation stamps `updated` and appends reviewer/coder notes.

## Goal contract

```json
{
  "text": "...",
  "status": "active",
  "acceptance": [
    { "desc": "tests pass", "check": "node --test todo.test.mjs" }
  ]
}
```

`q goal verify` runs every `check` in the project dir; the goal is done **only** when all exit 0. An empty acceptance list never passes — vague goals cannot be declared complete. The planner's first duty on a fresh goal is to make acceptance executable.

## Turn loop (what the supervisor does per role)

1. **Wake-check, zero LLM cost:** unread events? claimable/registered work for this role? If no — sleep with backoff (5s→60s).
2. Consume events, compose the prompt *entirely from files*: role prompt + goal + plan + board + own heuristics + playbook + new events + turn budget.
3. Spawn the executor (`pi -p @promptfile --model <first-working-model-in-chain>`) in the project dir. The agent acts with the harness's own tools and communicates only via `q`.
4. Log transcript, count the turn, repeat until goal leaves `active`.

Watchdog (same process): stall detection (no bus writes for `stallMin` while tasks incomplete → `system` nudge to orchestrator), wall-clock budget, and a deterministic finalizer if the orchestrator exhausts its turns with all tasks done.

## Failure handling

| Failure | Mechanism |
|---------|-----------|
| turn hangs | SIGKILL at `turnTimeoutSec`, logged, retried next wake |
| model down | per-role fallback chain in config |
| 3 consecutive turn failures | role pauses 2 min + `block` event to orchestrator |
| task claim race | lock; exactly one winner (unit-tested) |
| torn bus line | reader stops at last complete line; line delivered when completed |
| stall | watchdog nudge → orchestrator re-plans |
| budget exhausted | fleet stops; goal `failed`; fallback report written |
| corrupt JSON line | skipped by all readers |
| machine reboot | `quorum run` resumes: cursors, board, plan, memory all on disk |

## Success metrics

Read them straight off the files after each goal:
- completion: `goal.json.status == "done"` with all checks green
- efficiency: `goal.json.turns` totals and wall clock (fleet.log) — should trend down for similar goals as heuristics accumulate
- quality: critique-per-approve ratio on the bus (reviewer rejections trend)
- evolution: heuristics cited in turn transcripts; playbook growth vs churn
- cost: turns spent idle-waking = 0 by construction (wake-checks are file reads)
