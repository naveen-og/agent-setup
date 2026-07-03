# handoff

Session-handoff skill: writes a document that lets a fresh agent (or a human) continue the
current work after a context reset. v2 — multi-harness package, same pattern as
`coding-excellence/`.

## Files

| File | Role |
|------|------|
| `CORE.md` | **Canonical behavior spec.** Purpose, triggers, hard rules (temp-dir output, secret redaction, reference-not-duplicate), full section template, audience modes, quality bar. Harness-neutral. |
| `SKILL.md` | Claude Code adapter (auto-discovered skill; defers to CORE.md; auto-invokes near context limit) |
| `AGENTS.md` | Pi + Codex CLI + OpenCode adapter (contract inlined + CORE.md pointer) |
| `GEMINI.md` | Gemini CLI adapter (same content, Gemini's context filename) |

## Install per harness

- **Claude Code** — already installed: this directory lives in `~/.claude/skills/`, so the
  skill auto-appears. Triggers manually ("write a handoff") or proactively near the context
  limit / before compaction.
- **Pi / OpenCode / Codex CLI** — copy or symlink `AGENTS.md` into the project root (or the
  harness's global context location):
  `ln -s ~/.claude/skills/handoff/AGENTS.md ./AGENTS.md`
- **Gemini CLI** — copy or symlink `GEMINI.md` into the project root or `~/.gemini/GEMINI.md`.
- **Any other harness** — point the agent at `CORE.md` and say "write a handoff per this spec".

## What v2 adds over v1

- **Capture depth:** dedicated sections for open TODOs/task state, last known test status,
  unresolved errors (summarized), git state (branch, uncommitted summary, session commits),
  and decisions + why.
- **Format-aware output:** agent-facing (terse, file:line) vs human-facing (narrative);
  defaults to agent-facing when ambiguous.
- **Ranked skill suggestions:** ranked by relevance to the *remaining* work, one-line reason
  each — not a log of skills used.
- **Auto-trigger:** `disable-model-invocation` removed; the model invokes the skill
  proactively when nearing the context limit or compaction. Manual invocation unchanged
  from v1.

## Editing the brain

`CORE.md` is the single source of truth. `AGENTS.md` inlines the contract so single-context-
file harnesses get it without extra reads; `GEMINI.md` is generated from `AGENTS.md` with
only the top 3 header lines differing. **If you edit CORE.md, re-sync the adapters:**

```bash
cd ~/.claude/skills/handoff
# 1. Update AGENTS.md's inlined contract to match CORE.md
# 2. Regenerate GEMINI.md:
sed '1s/.*/# Handoff — Gemini CLI Rules/; 3s|.*|<!-- Adapter for Gemini CLI (reads GEMINI.md as standing context). -->|' AGENTS.md > GEMINI.md
```

## Design notes

- Handoff is **on-demand**, not always-on like coding-excellence — adapters describe the
  trigger and contract, and the full template lives only in CORE.md, keeping standing-context
  cost low.
- Empty sections are written as `None`, never deleted — absence must be provably deliberate.
- Output goes to the OS temp dir by design: handoffs are transient bridge artifacts, not
  repo content.
