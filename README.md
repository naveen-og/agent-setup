# agent-setup

My portable AI-agent configuration. One repo, one `install.sh`, and every coding agent on
the machine — Claude Code, pi, OpenCode, Gemini CLI, Codex CLI — gets the same
senior-engineer discipline.

## What's inside

```
agent-setup/
├── install.sh                    # recreates all harness symlinks (idempotent)
└── skills/
    └── coding-excellence/        # the skill — one brain, many mouths
        ├── CORE.md               # canonical instructions (harness-neutral)
        ├── SKILL.md              # Claude Code adapter
        ├── AGENTS.md             # Codex CLI + OpenCode + pi adapter (rules inlined)
        ├── GEMINI.md             # Gemini CLI adapter (generated from AGENTS.md)
        ├── pi-prompt.md          # pi system-prompt form (generated from AGENTS.md)
        └── README.md             # skill docs: design, install, adapter re-sync recipe
```

## coding-excellence

A portable execution-discipline skill that raises the coding quality of **any model in any
harness** — frontier models down to small free ones. It targets where models actually lose:
not knowledge, discipline.

- **12 always-on rules** — read before touching, smallest diff, verify APIs exist, never
  claim done without command output, no debris
- **Project orientation** — map the repo before building anything
- **7-phase execution loop** — orient → pin intent → locate → plan the change → change
  surgically → debug systematically → verify by running
- **14-trap failure catalog** — hallucinated APIs, giant rewrites, done-without-run … each
  with one hard rule
- **Deep mode** — pre/post-flight checklists for multi-file / irreversible changes
- **Code review mode** + **code quality standard**

### Measured results (2026-07-03, identical feature-build task, independently verified)

| Engine | Score |
|---|---|
| pi + gpt-oss-120b (Bedrock Mantle) | 10/10 |
| pi + qwen3-coder-480b (Bedrock Mantle) | 10/10 |
| OpenCode + deepseek-v4-flash (free) | 10/10 |
| Claude Code + Haiku 4.5 | ~9/10 |

## Install

```bash
git clone https://github.com/naveenanubh-cmyk/agent-setup ~/agent-setup
bash ~/agent-setup/install.sh
```

Everything is symlinked, so `git pull` updates every harness at once. If you edit the rules,
edit `AGENTS.md` (or `CORE.md`) and re-run the sync recipe in
`skills/coding-excellence/README.md` to regenerate `GEMINI.md` / `pi-prompt.md`.

## Hard-won prompt-engineering lessons baked in

1. **Front-load counters against strong priors.** qwen3-coder ignored "don't convert tests
   to unittest" as rule 6, as a dedicated section, and as a closing checklist — it only
   complied when the counter moved into the prompt's opening lines.
2. **If every capable model breaks a rule identically, the rule is wrong.** All test models
   consolidated same-file duplicate logic into an imported utility — that's senior judgment,
   so the rule became a sanctioned-with-disclosure exception instead of a prohibition.
3. **Weak models follow structure, drown in prose.** Numbered rules, tables, concrete cases.
