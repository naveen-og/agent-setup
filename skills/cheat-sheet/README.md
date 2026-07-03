# cheat-sheet

Name a topic, get back a single HTML file that works like a real reference card.
"Make a cheat sheet for git rebase" → `cheatsheets/git-rebase.html` — dense grid
of short cards covering the topic from 5 angles: Beginner, Practical, Pitfalls,
Expert, Alternatives.

## Why it doesn't look like AI slop

The template is embedded in the skill, so output quality is deterministic
instead of re-invented per run. The rules that make it work:

- **Zero external requests.** No CDN, no webfonts, no Tailwind script. Tailwind's
  design tokens hand-written as CSS variables — same clean look, opens offline,
  safe as an artifact.
- **Topic-derived accent.** Git sheet is git-orange, docker sheet is docker-blue.
  One accent total, never a generic purple gradient.
- **Density is the aesthetic.** Reference-card grid, no hero section, no
  "Welcome to your guide!" — every entry is a `<code>` term + ≤2 lines.
- **Dark default, light + print included.** `prefers-color-scheme` handles it;
  Ctrl+P gives a paper version.

Attach reference images and they become the design brief instead of the default
template.

## Install

`install.sh` at repo root symlinks this folder for Claude Code, pi, and
OpenCode. On demand — invoke by asking for a cheat sheet.

## Origin

Built in the Agentic OS vault (2026-07-03), where a vault-integrated variant
runs the research through `research.py` (multi-model pipeline) and wires outputs
into the Obsidian graph. This portable version uses whatever research the host
harness offers — web search tool if present, model knowledge otherwise.
