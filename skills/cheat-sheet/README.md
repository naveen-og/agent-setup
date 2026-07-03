# cheat-sheet

Name a topic, get back a single HTML file that reads like a beautifully typeset
lesson page. "Make a cheat sheet for git rebase" → `cheatsheets/git-rebase.html`
— serif prose, one idea at a time, commented command blocks, and a short
"Check yourself" quiz at the end so it actually sticks.

Covers every topic from 5 angles: Beginner (the one idea), Practical (the
commands you actually need), Pitfalls (where people get burned), Expert (power
moves), Alternatives (when not to use it).

## Why it doesn't look like AI slop

The exact template ships with the skill (`template.html`), so output is
deterministic instead of re-invented per run. The look is a minimal PDF-style
document, not a dashboard:

- **Single 700px column, warm paper background, serif body.** Reads like a book
  page. No card grids, no hero sections, no gradients, no emoji.
- **Zero external requests.** No CDN, no webfonts, no scripts. Opens offline,
  prints clean.
- **One muted book-red accent** for the eyebrow label and the callout border.
  That's the whole palette.
- **Retrieval quiz built in** — 2–3 multiple-choice questions with answers
  behind a click, because rereading isn't learning.

Attach reference images and they become the design brief instead of the default
template.

## Files

- `SKILL.md` — the skill
- `template.html` — the exact skeleton, previewable in a browser
- `examples/git-rebase.html` — real output from a run; open it to see what you get

## Install

`install.sh` at repo root symlinks this folder for Claude Code, pi, and
OpenCode. On demand — invoke by asking for a cheat sheet.

## Origin

Built in the Agentic OS vault (2026-07-03). Design brief came from Naveen's
reference screenshots: a typeset git lesson page with serif headings, red
eyebrow labels, aligned-comment code blocks, and an interactive self-quiz.
A vault-integrated variant runs research through `research.py` and wires
outputs into the Obsidian graph; this portable version uses whatever research
the host harness offers.
