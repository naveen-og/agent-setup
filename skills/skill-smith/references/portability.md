# Portability reference

Everything in this file is harness-variable. Nothing here belongs in a skill body —
put the intent there and point at this table.

## Install locations

| Harness | Global skills dir | Project-local |
|---|---|---|
| Claude Code | `~/.claude/skills/` | `./.claude/skills/` |
| Cross-runtime alias (Codex, Copilot CLI, Gemini CLI) | `~/.agents/skills/` | — |
| pi | `~/.pi/agent/skills/` (note the nested `agent/`; `~/.pi/skills/` is **not** read) | `./.pi/agent/skills/` |
| Cursor | project rules under `.cursor/rules/*.mdc` (not SKILL.md) | same |

Project-local wins over global on a name collision.

**One-source layout** (the setup on this machine): author once under a real directory,
symlink into each harness dir. Verified layout here:

```
~/agent-setup/skills/<name>/SKILL.md          # canonical, git-tracked
~/.claude/skills/<name>   -> ~/agent-setup/skills/<name>
~/.agents/skills/<name>   -> ~/agent-setup/skills/<name>
~/.pi/agent/skills/<name> -> ~/agent-setup/skills/<name>
```

Verify a distribution actually landed — identical byte counts across every location:

```bash
SKILL=<name>
for p in ~/agent-setup/skills ~/.claude/skills ~/.agents/skills ~/.pi/agent/skills; do
  printf '%s: %s\n' "$p" "$(wc -c < "$p/$SKILL/SKILL.md" 2>&1)"
done
```

A mismatch means a broken symlink or a diverged copy. Investigate before shipping.

## Invocation control (client-specific — not in the core spec)

Manual-only invocation is **not** part of the Agent Skills specification. Each client
does it differently, so a manual-only skill needs more than one declaration:

| Client | Mechanism |
|---|---|
| Claude Code, VS Code / Copilot | `disable-model-invocation: true` in SKILL.md frontmatter |
| OpenAI Codex | separate file `agents/openai.yaml` inside the skill folder: `policy:\n  allow_implicit_invocation: false` |
| Others | verify per client; assume nothing |

Unknown frontmatter keys are generally ignored rather than fatal, so shipping both is
safe. Never assume a client-specific field works everywhere — test implicit invocation
in each runtime you care about.

## Session snapshotting

Several harnesses read the skill set once at session start. An edit mid-session is
invisible until restart. When a skill "isn't working" right after you edited it, restart
before debugging anything else.

## Writing tool-agnostic steps

Name the capability, then the harness binding in parentheses. The step stays readable
where the binding does not apply.

| Capability | Claude Code | pi (this machine) |
|---|---|---|
| Read a file | `Read` | `read` / `read_hashline` |
| Structured multi-line edit | `Edit` | `splice_edit` after `read_scope_map`, or `edit_hashline` |
| Run a command | `Bash` | `bash` |
| Delegate work | `Agent` (subagent types) | silicorism DAG nodes |
| Scheduled / repeating run | `/loop`, `ScheduleWakeup`, cron routines | harness cron, external clock |

For a skill that must run under silicorism worker nodes: worker agents resolve skills
from the orchestrator's skill list only, and they start with **zero** conversation
context. Any skill meant for a worker must be fully self-contained — no "as discussed
above", no reliance on the planner's reasoning.

## Model-agnostic wording

Replace model names with the property you need:

| Don't write | Write |
|---|---|
| "use Fable 5 Max for the review" | "use the strongest reasoning model available for the review pass" |
| "Sonnet can't handle this" | "if the run has a small context budget, read only the named files" |
| "with a 1M context window" | "if the whole file does not fit, read the scope map first" |

Model names date the skill and make it wrong on harnesses that never had that model.
