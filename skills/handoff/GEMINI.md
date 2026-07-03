# Handoff — Gemini CLI Rules

<!-- Adapter for Gemini CLI (reads GEMINI.md as standing context). -->
<!-- Canonical source: ~/.claude/skills/handoff/CORE.md — full section template, gathering -->
<!-- steps, and quality bar live there. If CORE.md changes, re-sync this file. -->

When the user asks for a handoff / session summary for a fresh agent, or when you detect the
session is nearing its context limit or about to be compacted, write a handoff document by
the rules below. Read `~/.claude/skills/handoff/CORE.md` for the full spec before writing.

## Contract

1. **Location:** OS temp directory (`$TMPDIR` or `/tmp`), never the workspace. Filename
   `handoff-YYYY-MM-DD-<topic>.md`. Print the absolute path when done.
2. **Redact secrets:** no API keys, passwords, tokens, or PII — name where a secret lives,
   never its value.
3. **Reference, don't duplicate:** cite PRDs, plans, ADRs, issues, commits, diffs by
   path/URL/hash. Never paste their content.
4. **Arguments = next session's focus.** Tailor the document to it; no arguments → cover all
   active work.
5. **Audience:** agent-facing by default (terse, imperative, file:line refs). Human-facing
   narrative only when the user says a human reads it. State the mode in the header.

## Required sections (order fixed; empty section → write "None", don't delete)

Goal · Current state · Open TODOs/task state · Test status (last known, not full output) ·
Unresolved errors (one-line summaries + file:line, never raw traces) · Git state (branch,
`git status --short` summary, session commits) · Decisions made + one-line why · Artifacts
(paths/URLs only) · Next steps (ordered, imperative) · Suggested skills (ranked by relevance
to REMAINING work, one-line reason each, max 5) · Gotchas.

## Gather before writing

Run `git branch --show-current`, `git status --short`, `git log --oneline` (session commits);
read the harness task list if one exists; scan the conversation for unresolved errors, test
outcomes, and explicit decisions. Facts from this session only — unknown → say unknown.

**Quality bar:** a fresh agent with only this document and repo access can make the next
meaningful change without re-asking anything the session already answered.
