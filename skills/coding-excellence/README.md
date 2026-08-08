# coding-excellence

One brain, many mouths: a portable execution-discipline package that raises the coding
quality of **any model in any harness** — from frontier models down to the smallest local
ones. It works by enforcing the discipline strong engineers use (read before touching,
verify before claiming, smallest diff, evidence always), which is where weak models actually
lose — not knowledge, discipline.

## Files

| File | Role |
|------|------|
| `CORE.md` | **The instructions.** The loop, the rules, debugging, tests, deep mode, review mode, quality, the report. Harness-neutral, and the only file with content. |
| `SKILL.md` | Claude Code adapter (auto-discovered skill; defers to CORE.md) |
| `AGENTS.md` | Symlink to `CORE.md` — the filename Codex CLI and OpenCode read |
| `pi-executor.md` | Pi only. Pi executes plans it is handed, so it gets executor rules, not the reasoning-agent set. The one file that deliberately differs. |

The adapters used to be three hand-maintained copies of the same 162 lines. They are symlinks
now: edit `CORE.md`, every harness gets it.

## Install per harness

- **Claude Code** — already installed: this directory lives in `~/.claude/skills/`, so the
  skill auto-appears. It triggers on any coding task; you can also invoke it explicitly.
- **Codex CLI** — copy or symlink `AGENTS.md` into the project root (or `~/.codex/AGENTS.md`
  for global):
  `ln -s ~/.claude/skills/coding-excellence/AGENTS.md ./AGENTS.md`
- **OpenCode** — same file, project root: OpenCode reads `AGENTS.md` as standing context.
- **Pi** — `install.sh` links `pi-executor.md` to `~/.pi/agent/AGENTS.md`. Use `CORE.md`
  instead if pi is ever driving itself rather than executing a plan.
- **Any other harness / raw API** — prepend `CORE.md`'s "The Rules" to the system prompt;
  provide the full file as readable for deep mode.

## Editing the brain

Edit `CORE.md`. That is the whole procedure — `AGENTS.md` is a symlink to it, so every harness
that reads a single context file gets the change at once. There is nothing to re-sync.

`pi-executor.md` is the one file that deliberately differs, and it does not track CORE.md: pi
executes plans it is handed, so it carries executor rules only. Change it when pi's role
changes, not when the rules change.

## Design notes

- Written weak-model-first: short imperative sentences, numbered steps, hard rules, tables.
  Weak models follow structure; they drown in prose.
- Rules are front-loaded by leverage, not filed at the bottom. The highest-leverage rule —
  ask targeted questions and wait when a request is ambiguous, a file is missing, or two
  interpretations are valid, instead of guessing and proceeding — is rule 1 in Part 1 and the
  first thing named in every adapter's opening lines. Counters against strong-model priors
  only bind when they're the first thing read, not a checklist item found on page two.
- Root-cause discipline is explicit and early (Part 1 rules 3–4): grep every caller of shared
  code before editing it, and fix where all callers converge, not the path a bug report names.
- The failure-mode catalog (CORE.md Part 4) is the centerpiece: 16 concrete traps
  (ambiguity plowed-through, hallucinated APIs, giant rewrites, symptom-site fixes,
  done-without-run, …) each paired with one counter-move.
- When every capable model breaks a rule the same way, the rule was wrong, not the models —
  same-file duplicate-logic consolidation is sanctioned-with-disclosure (Part 1 rule 6), not a
  violation, because every tested model did it identically and flagging-only produced worse
  code than the model's instinct.
- Scope is the execution loop only — writing, debugging, reviewing, running. Product and
  architecture planning are deliberately out of scope.
- No harness-specific tool names anywhere in CORE.md, so every adapter stays a thin wrapper.
