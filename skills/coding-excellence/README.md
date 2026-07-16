# coding-excellence

One brain, many mouths: a portable execution-discipline package that raises the coding
quality of **any model in any harness** — from frontier models down to the smallest local
ones. It works by enforcing the discipline strong engineers use (read before touching,
verify before claiming, smallest diff, evidence always), which is where weak models actually
lose — not knowledge, discipline.

## Files

| File | Role |
|------|------|
| `CORE.md` | **Canonical instructions.** Always-on rules, project orientation, execution loop, failure-mode catalog, deep-mode checklists, review mode. Harness-neutral. |
| `SKILL.md` | Claude Code adapter (auto-discovered skill; defers to CORE.md) |
| `AGENTS.md` | Codex CLI + OpenCode adapter (rules inlined + CORE.md pointer) |
| `GEMINI.md` | Gemini CLI adapter (same rules, Gemini's context filename) |
| `pi-prompt.md` | Pi adapter (same rules, for Pi's rules/system prompt) |

## Install per harness

- **Claude Code** — already installed: this directory lives in `~/.claude/skills/`, so the
  skill auto-appears. It triggers on any coding task; you can also invoke it explicitly.
- **Codex CLI** — copy or symlink `AGENTS.md` into the project root (or `~/.codex/AGENTS.md`
  for global):
  `ln -s ~/.claude/skills/coding-excellence/AGENTS.md ./AGENTS.md`
- **OpenCode** — same file, project root: OpenCode reads `AGENTS.md` as standing context.
- **Gemini CLI** — copy or symlink `GEMINI.md` into the project root (or `~/.gemini/GEMINI.md`
  for global).
- **Pi** — add `pi-prompt.md`'s contents to Pi's rules/extensions (or reference the file if
  your Pi setup supports file includes).
- **Any other harness / raw API** — prepend `CORE.md` Part 1 (Always-On Rules) to the system
  prompt; provide full `CORE.md` as a readable file for deep mode.

## Two-layer activation

- **Always-on layer** — the 13 rules (Part 1) load every coding turn. Cheap (~600 tokens),
  covers the failure modes that matter on every edit.
- **Deep mode** (CORE.md Part 5) — pre-flight/post-flight checklists, pulled in only for
  multi-file / refactor / irreversible / security-relevant changes.

## Editing the brain

`CORE.md` is the single source of truth. The inline adapters (`AGENTS.md`, `GEMINI.md`,
`pi-prompt.md`) duplicate the always-on rules so they load without extra steps in harnesses
that read a single context file. **If you edit the rules in CORE.md, re-sync the adapters** —
GEMINI.md and pi-prompt.md are generated from AGENTS.md with only the top 3 header lines
differing:

```bash
cd ~/.claude/skills/coding-excellence
sed '1s/.*/# Coding Excellence — Gemini CLI Rules/; 3s|.*|<!-- Adapter for Gemini CLI (reads GEMINI.md as standing context). -->|' AGENTS.md > GEMINI.md
sed '1s/.*/# Coding Excellence — Pi Rules/; 3s|.*|<!-- Adapter for Pi (add to Pi rules\/system prompt). -->|' AGENTS.md > pi-prompt.md
```

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
- The failure-mode catalog (CORE.md Part 4) is the centerpiece: 14 concrete traps
  (ambiguity plowed-through, hallucinated APIs, giant rewrites, symptom-site fixes,
  done-without-run, …) each paired with one counter-move.
- When every capable model breaks a rule the same way, the rule was wrong, not the models —
  same-file duplicate-logic consolidation is sanctioned-with-disclosure (Part 1 rule 6), not a
  violation, because every tested model did it identically and flagging-only produced worse
  code than the model's instinct.
- Scope is the execution loop only — writing, debugging, reviewing, running. Product and
  architecture planning are deliberately out of scope.
- No harness-specific tool names anywhere in CORE.md, so every adapter stays a thin wrapper.
