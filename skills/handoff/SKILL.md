---
name: handoff
description: Use when the user asks for a handoff, session summary for a fresh agent, or to "save state for next session" — and proactively when the conversation is approaching its context limit or about to be compacted, so work state is preserved before detail is lost.
argument-hint: [next session's focus, e.g. "finish the auth refactor"]
---

# Handoff

Write a handoff document so a fresh agent can continue this work. The full behavior spec
lives in `CORE.md` in this skill's directory — **read `CORE.md` now** and follow it exactly.

Quick contract (details in CORE.md):

- Save to the OS temp directory (use the session scratchpad if one is designated) — never
  the workspace. Print the absolute path when done.
- Redact secrets; reference artifacts by path/URL, never duplicate their content.
- Capture: goal, current state, open TODOs (use TaskList if populated), test status,
  unresolved errors (summarized), git state (branch, `git status --short` summary, session
  commits), decisions + why, next steps, ranked skill suggestions for the remaining work,
  gotchas.
- Arguments = the next session's focus; tailor the document to it.
- Audience: agent-facing (terse, imperative, file:line) by default; human-facing narrative
  only when the user says a human will read it.
- Invoked proactively near the context limit: write the handoff first, then tell the user
  where it is.
