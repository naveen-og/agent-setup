---
name: skill-smith
description: Use when a skill is being created, rewritten, reviewed, debugged, ported between agents, or when a skill fails to trigger or fires at the wrong time. Covers SKILL.md authoring for any harness (Claude Code, pi, Codex, Cursor, opencode, Gemini CLI) and any model. Triggers on "create a skill", "write a skill", "new SKILL.md", "improve this skill", "why isn't my skill firing", "make this skill portable", "turn this into a skill".
---

# skill-smith

Build skills that work on any agent, any model, any harness.

**The law:** a skill is the smallest set of instructions that converts an *observed,
repeated failure* into a *repeatable success* — and nothing else. No observed failure,
no skill. Everything past "the smallest set" is context tax paid on every session.

Two independent things must both be right, and they fail independently:

| Part | Job | Fails as |
|---|---|---|
| `description` | Routing. Decides whether the body ever loads. | Skill never fires, or fires on the wrong task |
| body | Execution. Changes what the agent does once loaded. | Skill fires, output still wrong |

Diagnose which one broke before touching either. Fixing the body when routing is
broken changes nothing, and it is the most common wasted edit in skill authoring.

---

## The gate — answer all four before writing a line

1. **What failure did you actually watch happen?** Quote it. A hypothesis is not a
   failure. If you cannot quote it, stop — you are writing documentation, not a skill.
2. **Does the model already know this?** If a competent agent does it right unprompted,
   the skill is dead weight. Test the bare prompt first.
3. **Capability or process?** Capability = the agent *can't* do X (wrap a tool).
   Process = the agent *does X badly* (encode a method). Different shapes; see step 4.
4. **Can code decide it instead?** Anything deterministic, repetitive, or where
   variation is a bug belongs in `scripts/`, not in prose. Prose is for judgment only.

If 1 fails → no skill. If 2 fails → no skill. If 4 says "code" → write the script and
let SKILL.md teach the invocation in ten lines.

---

## Step 1 — Capture the failure verbatim

Run the task **without** the skill. Record what the agent actually did, word for word:
the wrong choice, the excuse it gave, the step it skipped. Five runs beat one — a single
sample is noise, and you cannot tell a stable failure from a coin flip.

You are looking for two things:

- **The behaviour** — what went wrong.
- **The rationalisation** — the sentence the agent used to justify it. That sentence is
  the raw material for the counter you will write. Never paraphrase it; agents rebut
  their own exact words far better than your summary of them.

Skipping this step is the reason most skills do not work. You end up writing guidance
against the failure you *imagined*, which the agent was never going to make.

---

## Step 2 — Classify the failure, then pick the matching form

This table is the highest-leverage thing in this skill. **The form that fixes one
failure type measurably backfires on another.** Get this wrong and adding words makes
the skill worse.

| Observed failure | Form that works | Form that backfires |
|---|---|---|
| Knows the rule, breaks it under pressure (deadline, sunk cost, "just this once") | Hard prohibition + rationalisation table + red-flags list | Soft guidance: "prefer", "consider", "try to" |
| Complies, but the output has the wrong shape (bloated, buried verdict, restated spec) | Positive recipe: state what the output **is** — its parts, in order | Prohibition lists: "don't restate", "never narrate" |
| Omits a required element from something it already produces | Structural: a REQUIRED slot in the template it fills in | Prose reminders sitting near the template |
| Behaviour should depend on a condition | One conditional on an **observable** predicate: "if `X` exists, do Y" | Unconditional rule plus exemption clauses |
| Cannot do the thing at all | Command examples with real flags and real output | Prose describing the tool |

Why prohibitions backfire on shape problems: under a competing incentive the agent
negotiates with "don't X" and often produces *more* of the unwanted content than no
guidance at all. A recipe leaves nothing to negotiate — the output matches the stated
shape or it does not.

**Two rules for whichever form you pick:**

- **No nuance clauses.** "Don't X unless it matters" reopens the negotiation. A real
  exception becomes its own conditional on an observable predicate, never a trailing
  "unless".
- **Exemption clauses do not scope.** "This limit doesn't apply to code blocks" still
  suppresses code blocks. If part of the output must be exempt, restructure so the rule
  cannot reach it.

---

## Step 3 — Write the description first

The description is the whole routing contract. If the skill does not fire, it is the
description ~95% of the time, not the body.

**Formula:** `Use when <triggers and symptoms>. <Scope/what>. <Differentiator vs the
neighbouring skill>. Triggers on "<phrase>", "<phrase>".`

Four things go in:

1. **When** — concrete situations, symptoms, and error strings, not abstractions.
2. **What** — one phrase of scope, so the agent can rule it out.
3. **Differentiator** — the neighbouring skill it must not be confused with. Skip this
   and two skills fight over the same task forever.
4. **Trigger phrases** — the literal words a user says. Include synonyms and the
   misspelling they will actually type.

**Never summarise the workflow in the description.** This is the trap that looks like
good writing. An agent that can read the steps in the description will follow *those*
and skip loading the body — a description saying "reviews between tasks" produced one
review where the body's flowchart specified two. Describe *when* and *what*. Never *how*.

```yaml
# dead — abstract, no trigger, no scope
description: For async testing

# dead — summarises the process, so the body never gets read
description: Use for TDD — write test first, watch it fail, write minimal code, refactor

# alive — symptoms, scope, differentiator, literal phrases
description: Use when tests pass and fail inconsistently, hang, or depend on timing.
  Covers replacing sleeps with condition-based waits. Differentiator: flaky-test
  diagnosis, not test authoring. Triggers on "flaky test", "race condition", "test hangs".
```

Constraints that silently kill a skill:
- `name`: lowercase, hyphens, 1–64 chars, **exactly equal to the folder name**.
- Frontmatter total ≤ 1024 chars; only `name` and `description` are required by the spec.
- Invalid YAML does not warn — it just never loads.
- **A bare `: ` inside an unquoted description breaks strict YAML parsers** (pi's among
  them) while lenient ones (Claude Code) accept it. Single-quote the whole value and
  double any inner apostrophe: `description: 'Differentiator: finds gaps in Dave''s notes.'`
- No `<` or `>` in frontmatter — it can inject into the system prompt.

---

## Step 4 — Write the smallest body that closes the failure

**Shape by type:**

*Capability skill* (wraps a tool): runnable commands with real flags, real output shape,
and the failure modes of that tool. 30–80 lines, mostly code blocks. Defer the long tail
to `--help` rather than transcribing it.

*Process skill* (encodes a method): numbered steps, each with its own verification check.
No step without a check — an unverifiable step is a suggestion.

**Match strictness to blast radius (degrees of freedom):**

| Cost of a wrong move | Instruction rigidity |
|---|---|
| Low — many valid approaches (code review, naming) | Loose heuristics, principles |
| Medium — preferred pattern, variation tolerable (report format) | Template or pseudocode |
| High — fragile, order-dependent, consistency-critical (migrations, releases) | Exact scripts, strict numbered steps |

Over-constraining a low-cost task makes the skill ignored. Under-constraining a
high-cost one makes it dangerous.

**Progressive disclosure — the three levels:**

| Level | Loaded | Cost | Put here |
|---|---|---|---|
| 1 — frontmatter | Always, every session | ~100 tokens | Routing only |
| 2 — SKILL.md body | On match | Keep under ~500 lines | The method itself |
| 3 — `references/`, `scripts/`, `assets/` | Only when the body says to read/run it | Free until touched | Heavy reference, big tables, executables |

Bundled files cost nothing until opened, so push detail down aggressively — but **name
the exact trigger for each**: "for the pi/Codex install paths, read `references/portability.md`".
An unlabelled link is a file the agent never opens. Keep references **one level deep**;
chains (SKILL.md → advanced.md → detail.md) get partially previewed and silently missed.

**Build the verify → fix → re-verify loop into the body.** Single biggest quality lever
there is. State the literal command and what passing looks like. "Then check it works" is
not a loop; `npm test && tsc --noEmit`, both zero, is.

**State-check before acting.** Never assume setup exists: "run `X`; if it errors with
`Y`, do the setup in step 2 first."

---

## Step 5 — The portability pass

A skill is portable when nothing in it assumes *your* machine, *your* model, or *your*
agent. Run every line against these five:

1. **No absolute paths.** Relative, forward slashes, `$HOME` or a runtime placeholder —
   never `/Users/you/...`.
2. **No harness-specific tool names in the core.** Write the *intent* ("read the file",
   "run the tests"), not `Edit`/`str_replace`/`apply_patch`. If a step genuinely needs a
   specific tool, name the capability first and the tool second: "apply the patch (pi:
   `splice_edit`; Claude Code: `Edit`)".
3. **No model-specific claims.** "Use Fable 5 for subagents" rots in a month and is
   wrong on any harness that lacks it. Say the property you need: "use the strongest
   reasoning model available for the review pass".
4. **Harness-variable behaviour goes in a table, not in prose.** Invocation control,
   install paths, and hook names differ per client — see `references/portability.md`.
5. **Written for the weakest model you will run it on.** Strong models forgive vague
   skills; weak ones expose them. If the skill only works on your best model, it is a
   prompt, not a skill.

Explicit ambiguity check: every step must survive a reader with none of your context.
"Then deploy it" fails. "Run `npm run deploy:staging`, wait for HTTP 200 from `/healthz`,
then report" survives.

---

## Step 6 — Verify (do not skip; this is the part everyone skips)

Both halves, separately, because they fail separately.

**A. Routing test.** In a fresh session, ask something the skill *should* catch —
phrased the way a user would, never naming the skill. Did it fire? Then ask something
adjacent that it should *not* catch. Did it stay quiet? Failures here are description
bugs. Add the missing trigger phrase or sharpen the differentiator.

**B. Execution test.** Invoke it explicitly on a real task. Compare against the baseline
from step 1. Did the specific failure disappear? Anything else break?

**C. Weak-model test.** Re-run B on the weakest model in your rotation. Vagueness that a
frontier model papers over shows up immediately.

**D. Adversarial pass.** Ask a fresh agent: "what edge cases break this skill, and where
could you comply with the letter while violating the intent?" Patch what it finds.

**Rules for testing:** fresh context every run — a session that just watched you write
the skill is contaminated. Five reps minimum per variant, because single samples lie.
Always include a no-skill control; if the control does not fail, delete the skill. And
read every flagged result yourself — template echoes and quoted counter-examples look
like hits to automated scoring.

Full protocol, with and without subagents: `references/testing.md`.

**Report honestly.** A skill you wrote but did not run through A–D is **NOT VERIFIED**.
Say that word when you hand it over.

---

## Step 7 — Ship

- Folder name == frontmatter `name`. Uppercase `SKILL.md` (case-sensitive volumes care).
- No `README.md`, `CHANGELOG.md`, or install guides inside the skill folder — skills are
  for agents; human docs belong outside.
- No time-sensitive content ("as of Q3 2026", current prices, current model names). It
  rots and quietly poisons the skill. Fetch it live or leave it out.
- Install and symlink per `references/portability.md`.
- Version-control it. Skills are code: reviewed, diffed, revertible.

---

## Anti-patterns

| Anti-pattern | Why it kills the skill |
|---|---|
| Mega-skill doing design + build + test + deploy | That is a framework. Rigid, never fully loads, never composes. Split it. |
| Narrative ("in the 3 Aug session we found…") | Not reusable. Strip to the technique. |
| Re-teaching what the model knows (git basics, Python syntax) | Pure context tax. Challenge every paragraph: what does this add? |
| Same content in five languages | Five mediocre examples. One excellent, complete, runnable one wins. |
| Style-only skill ("be more concise") | Belongs in user preferences or the system prompt. |
| Happy-path only | Every step that can fail needs its failure mode and recovery. |
| Copy-pasted library source | Install the dependency. Don't vendor it into a skill. |
| Description that summarises the workflow | Agent follows the summary, never opens the body. |

---

## Red flags — stop and re-read this skill

- "I'll write it now and test it later" → later never comes; it ships broken.
- "I know the failure without running it" → you know a failure. Not the failure.
- "One more section can't hurt" → every section is loaded on every match. It can.
- "I'll just tell it not to do that" → check step 2; prohibition is wrong for shape bugs.
- "It works on Opus" → step 5.5. Run it on the weak model.
- "The description is fine, the body needs work" → run the routing test before believing that.
- "This skill is obviously clear" → clear to the author is not clear to a cold agent.

---

## Reviewing an existing skill

Same steps, in this order: routing test first (does it fire?), then read the description
against step 3, then classify the real failure per step 2 and check the body's form
matches, then the portability pass, then delete everything the model already knows.
Most skill rewrites are 60% deletion.

## Templates

`references/templates.md` — minimal capability skill, minimal process skill, and the
`scripts/` layout.

## Spec details

`references/spec.md` — frontmatter fields, directory layout, invocation-control fields
per client, security checklist for third-party skills.
