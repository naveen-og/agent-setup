# Handoff — Core Behavior Spec

<!-- Canonical source of truth for the handoff skill. Harness adapters (SKILL.md, -->
<!-- AGENTS.md, GEMINI.md) are thin pointers to this file. Edit behavior HERE, then -->
<!-- re-sync adapters if their inlined trigger text changed. -->

## Purpose

Write a handoff document that lets a **fresh agent with zero context** continue the current
work. The document is the bridge across a context reset — everything the next session needs,
nothing it can find on its own.

## When to run

1. **Manual:** the user invokes the skill (with or without arguments).
2. **Proactive:** you detect the session is approaching its context limit or is about to be
   compacted. Write the handoff BEFORE compaction destroys detail. Tell the user you did it
   and where the file is.

## Arguments

If the user passed arguments, treat them as a description of the **next session's focus**.
Tailor the whole document to that focus: lead with the state relevant to it, trim sections
that don't serve it. No arguments → cover the whole session's active work.

## Output location

Save to the **OS temp directory** — never the current workspace, never the repo.

- Prefer a harness-provided scratchpad/temp directory if one is designated.
- Otherwise: `$TMPDIR` or `/tmp` (Linux/macOS), `%TEMP%` (Windows).
- Filename: `handoff-YYYY-MM-DD-<short-topic-slug>.md`
- After writing, print the absolute path so the user can pass it to the next session.

## Hard rules

1. **Redact secrets.** No API keys, passwords, tokens, connection strings, or PII in the
   document. If a secret was relevant, say where it lives (`.env` var name, secret manager
   path) — never its value.
2. **Reference, don't duplicate.** Existing artifacts — PRDs, plans, ADRs, issues, PRs,
   commits, diffs, logs — are cited by path, URL, or hash. Never paste their content into
   the handoff. The next agent can read them.
3. **Facts only from this session.** Do not speculate about code you didn't read or results
   you didn't see. Unknown → say unknown.
4. **Summarize, never dump.** Stack traces, test output, and command logs are condensed to
   the actionable line(s), not pasted raw.

## Audience detection (format-aware output)

Determine who consumes the handoff next:

- User's arguments or context say a **human** will read it (e.g. "for my teammate",
  "write it up for review") → **human-facing**: narrative prose, background context,
  explain terms, why before what.
- Otherwise, including any ambiguity → **agent-facing** (default): terse, imperative,
  fragments fine, `file:line` references, commands as code blocks, no pleasantries.

State the chosen mode in the document header so the next reader knows what they're holding.

## Document structure

Use these sections, in this order. Drop a section only if it is genuinely empty — then write
`None` under the heading rather than deleting it, so absence is provably deliberate.

```markdown
# Handoff — <topic> (<date>)
Mode: agent-facing | human-facing
Next focus: <from arguments, or "continue current work">

## Goal
What the overall work is trying to achieve. 1–3 sentences.

## Current state
Where things stand right now. What works, what's in flight, what's untouched.

## Open TODOs / task state
Pull from the harness task tracker (TaskList or equivalent) if one exists; otherwise
reconstruct from the conversation. Status per item: done / in-progress / blocked / not started.

## Test status
Last known state: which tests pass, which fail (name + one-line failure reason), which were
never run. Not full output. If nothing was run: say so explicitly.

## Unresolved errors
Errors or stack traces seen this session that were NOT fixed. Each: one-line summary,
where it occurs (file:line), suspected cause if known. Summarized — never raw paste.

## Git state
- Branch: <current branch>
- Uncommitted: summary of `git status --short` (grouped, not necessarily verbatim)
- Commits made this session: hash + subject line each
Skip this section only when not in a git repository (say so).

## Decisions made
Short bullets: decision + one-line why. No reasoning transcripts.

## Artifacts
Paths/URLs to plans, PRDs, ADRs, issues, PRs, diffs, logs produced or used this session.
Reference only — no content.

## Next steps
Ordered, concrete, imperative. The first item is what the next agent should do first.

## Suggested skills
Ranked by relevance to the REMAINING work (not a log of skills used this session).
Each: skill name + one-line reason it helps the next step. 3–5 max; none relevant → "None".

## Gotchas
Anything that will bite the next agent: env quirks, flaky commands, files that look wrong
but are correct, half-applied changes.
```

## Gathering the data

Before writing, actually collect — don't recall from memory alone:

- `git branch --show-current`, `git status --short`, `git log --oneline` bounded to this
  session's commits (compare against session start if known).
- The harness task list tool, if present.
- Scan the conversation for: errors that were never resolved, test runs and their outcomes,
  explicit decisions ("we'll use X because Y"), artifacts created.

## Quality bar

The test: could a fresh agent, given only this document and repo access, produce the next
meaningful change without asking the user anything the session already answered? If any
section fails that test, it's too thin.
