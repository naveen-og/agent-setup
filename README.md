# agent-setup

My portable AI-agent configuration. One repo, one `install.sh`, and every coding
agent on the machine — Claude Code, pi, OpenCode, Gemini CLI, Codex CLI — gets
the same skills and the same senior-engineer discipline. Everything is symlinked,
so `git pull` updates every harness at once.

## Install

```bash
git clone https://github.com/naveen-og/agent-setup ~/agent-setup
bash ~/agent-setup/install.sh
```

Idempotent — safe to re-run after every pull.

## What's inside

```
agent-setup/
├── install.sh              # recreates all harness symlinks
└── skills/
    ├── coding-excellence/  # always-on coding discipline (CORE.md + per-harness adapters)
    ├── prompt-smith/       # on-demand prompt refinement
    ├── handoff/            # on-demand session handoff
    └── cheat-sheet/        # on-demand topic → offline HTML reference card
```

## The skills

### coding-excellence

Raises the coding quality of **any model in any harness** — frontier models down
to small free ones. It targets where models actually lose: not knowledge,
discipline.

- **12 always-on rules** — read before touching, smallest diff, verify APIs
  exist, never claim done without command output, no debris
- **Project orientation** — map the repo before building anything
- **7-phase execution loop** — orient → pin intent → locate → plan → change
  surgically → debug systematically → verify by running
- **14-trap failure catalog** — hallucinated APIs, giant rewrites,
  done-without-run… each with one hard rule
- **Deep mode** + **code review mode** + **code quality standard**

Measured on an identical feature-build task (2026-07-03, independently
verified): pi + gpt-oss-120b **10/10**, pi + qwen3-coder-480b **10/10**,
OpenCode + deepseek-v4-flash **10/10**, Claude Code + Haiku 4.5 **~9/10**.

One brain, many mouths: `CORE.md` is canonical; `SKILL.md` (Claude Code),
`AGENTS.md` (Codex/OpenCode/pi), `GEMINI.md` and `pi-prompt.md` are adapters.
Edit `AGENTS.md` or `CORE.md`, then re-run the sync recipe in its README.

### prompt-smith

Takes a raw prompt — any target: coding agent, chat LLM, research, image gen,
system prompt — scores it against a 10-point rubric, interviews you if context
is missing, and hands back a professionally engineered version with the full
breakdown: scores, tactics applied, assumptions, alternative version.

### handoff

Packages the current session's state — what was done, decisions, open threads,
gotchas — so a fresh agent (any harness) can pick up exactly where the last one
stopped. Use before context runs out, not after.

### cheat-sheet

Name a topic ("make a cheat sheet for git rebase") and get one self-contained
HTML file that reads like a typeset lesson page: serif prose in a single
column, commented command blocks, a red-rail callout for the one rule that
matters, and a "Check yourself" quiz at the end. Covers 5 angles — Beginner,
Practical, Pitfalls, Expert, Alternatives. The exact template ships with the
skill (`template.html`), zero external requests, light/dark/print all handled.
Attach reference images and they become the design brief. Deliberately does
*not* look like AI slop — it's a minimal PDF-style document, not a dashboard.

## Hard-won prompt-engineering lessons baked in

1. **Front-load counters against strong priors.** qwen3-coder ignored "don't
   convert tests to unittest" as rule 6, as a dedicated section, and as a
   closing checklist — it only complied when the counter moved into the
   prompt's opening lines.
2. **If every capable model breaks a rule identically, the rule is wrong.** All
   test models consolidated same-file duplicate logic into an imported utility —
   that's senior judgment, so the rule became a sanctioned-with-disclosure
   exception instead of a prohibition.
3. **Weak models follow structure, drown in prose.** Numbered rules, tables,
   concrete cases.
4. **Ship the template, don't describe it.** cheat-sheet includes its exact
   HTML skeleton (`template.html`) — deterministic output beats re-inventing
   the design every run.
