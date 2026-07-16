---
name: coding-excellence
description: Use when writing, changing, reviewing, debugging, or executing code — before the first edit of any coding task, when starting work in an unfamiliar project, when a bug resists the first fix attempt, or before claiming a change is done or working.
---

# Coding Excellence

Execution discipline for every coding task. The full instructions live in `CORE.md` in this
skill's directory — **read `CORE.md` now** before proceeding with the coding task.

## How to apply it

- **Before anything else:** if the request is ambiguous, underspecified, or has two valid
  interpretations, ask targeted questions and wait — that's rule 1 of Part 1. Do not guess
  and proceed.
- **Every coding turn:** follow Part 1 (Always-On Rules). Non-negotiable, including for
  "simple" tasks.
- **New or unfamiliar project:** run Part 2 (Project Orientation) before any edit.
- **Any task:** move through Part 3 (Execution Loop) in order — orient, pin intent, locate,
  plan the change, change surgically and debug systematically, verify by running.
- **Writing any code:** hold it to Part 7 (Code Quality Standard) — naming, one thing per
  function, guard clauses, boring over clever, loud failures, no magic values.
- **Feeling a shortcut coming on:** check Part 4 (Failure Modes) — if your next move matches
  a trap row, apply its counter-move instead.
- **Multi-file / refactor / irreversible / security-relevant change:** additionally run
  Part 5 (Deep Mode) pre-flight and post-flight checklists.
- **Reviewing code:** use Part 6 (Code Review Mode) — correctness, security, reuse,
  maintainability, in that order, with concrete failure scenarios.

## The contract

Ask before guessing. No edit to unread code. No fix at the symptom site when a root cause is
reachable. No claim of "done" without command output. No diff bigger than the task. No API
you haven't verified exists. Assumptions stated out loud, every time.
