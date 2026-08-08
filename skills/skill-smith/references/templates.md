# Templates

Copy, then delete every line you cannot justify. A template you filled in completely is
usually a skill that is twice as long as it should be.

## Capability skill (wraps a tool)

Logic lives in the tool. The body teaches invocation and failure modes. 30–80 lines.

```markdown
---
name: <folder-name>
description: Use when <situation>. <One phrase of scope>. Differentiator: <vs the
  neighbouring skill>. Triggers on "<phrase>", "<phrase>".
---

# <name>

<One sentence: what capability this adds, and the one thing that goes wrong without it.>

## State check

    <command that proves the tool is installed and authenticated>

Errors with `<exact error>` → setup below. Otherwise continue.

## Common operations

    <command>              # what it does
    <command with flags>   # the 80% case

Full flag list: `<tool> --help`.

## Output shape

    <literal example of what the tool returns, so downstream parsing is reliable>

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `<exact error string>` | <cause> | <exact recovery command> |

## Setup

1. <step> → verify: `<command>` prints `<expected>`
```

## Process skill (encodes a method)

No scripts. Every step carries its own verification. Ordering matters, so numbered
steps, not bullets.

```markdown
---
name: <folder-name>
description: Use when <symptom the agent exhibits>. Differentiator: <vs neighbour>.
  Triggers on "<phrase>", "<phrase>".
---

# <name>

**Core principle:** <one sentence a tired agent can hold in its head.>

## When NOT to use

- <case where this method is overkill or wrong>

## Steps

1. **<Action>** — <what and why in one line>
   → verify: <observable check>
2. **<Action>**
   → verify: <observable check>

## Rationalisation table
<Only for discipline skills. Every row comes from an observed test run, verbatim.>

| Excuse | Reality |
|---|---|
| "<exact sentence the agent produced>" | <the counter> |

## Red flags — stop

- <thought that means the agent is about to violate this>

**All of these mean: <the corrective action>.**
```

## Folder layout

```
<skill-name>/
  SKILL.md              # required; name == folder name
  references/*.md       # heavy detail, loaded only when the body names it
  scripts/*             # executables; run without their source entering context
  assets/*              # templates, fixtures, static files
  agents/openai.yaml    # only for manual-only skills that must also cover Codex
```

Rules: references stay one level deep (no chains). Scripts are executable and
self-contained. No `README.md` inside the folder — that is a human doc, and it costs
tokens without ever being the thing the agent needs.
