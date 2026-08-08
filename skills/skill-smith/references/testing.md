# Testing protocol

A skill you have not tested is a hypothesis. Test in this order — cheapest first.

## Ground rules

- **Fresh context every run.** A session that just watched you write the skill already
  knows the answer. That is not a test.
- **Always run a no-skill control.** If the control does not exhibit the failure, there
  is nothing to fix. Delete the skill.
- **Five reps per variant, minimum.** One sample cannot distinguish a fixed behaviour
  from a coin flip.
- **Read every result yourself.** Automated scoring counts template echoes and quoted
  counter-examples as hits, overstating both failure and success.
- **Variance is a metric.** When guidance lands, reps converge on the same shape. Five
  different interpretations across five reps means the wording is not binding — tighten
  the form before adding words.

## Tier 1 — Wording micro-test (fast, do this first)

Cheapest way to compare two phrasings before committing to full scenarios.

1. One fresh sample per call. Raw API call, or a single-shot session.
2. System prompt = the realistic context the guidance will live in (the whole skill, not
   the sentence in isolation).
3. User message = a task that tempts the failure.
4. Arms: no-guidance control, variant A, variant B. Five reps each.
5. Read all fifteen outputs. Pick the arm with the tightest distribution, not the one
   with the best single output.

Micro-tests verify *wording*. They do not replace scenario tests for discipline skills.

## Tier 2 — Routing test (no subagents needed)

In a fresh session, phrase a request the way a user actually would, never naming the
skill.

- **Positives** (3+): should fire. If it does not → the description is missing the
  trigger phrase or the symptom.
- **Negatives** (2+): adjacent tasks that should *not* fire it. If it fires → the
  differentiator is missing or the scope phrase is too broad.

Ask the agent afterwards: "which skills did you load?" Fastest routing diagnostic there is.

## Tier 3 — Execution test

Invoke explicitly on a real task. Compare against the step-1 baseline:

- Did the specific captured failure disappear?
- Did anything else regress? Over-constrained skills break adjacent behaviour.
- Repeat on the weakest model in your rotation. Vagueness a frontier model papers over
  is fatal on a small one.

## Tier 4 — Pressure scenarios (discipline skills only)

Required for skills whose failure mode is "knows the rule, breaks it under pressure".

Build a scenario stacking **three or more** pressures at once:

| Pressure | Injected as |
|---|---|
| Time | "we ship in twenty minutes" |
| Sunk cost | "this took four hours already" |
| Authority | "the lead said just merge it" |
| Exhaustion | a long transcript of prior failed attempts |
| Plausibility | a genuinely reasonable-sounding shortcut |

Run it without the skill first. **Write down the exact rationalisation sentence the
agent produces.** That sentence goes verbatim into the skill's rationalisation table —
agents rebut their own words far better than your paraphrase of them.

Then run it with the skill. New rationalisation appears? Add the counter, re-run. Repeat
until the agent complies under maximum pressure.

## Tier 5 — Adversarial review

Hand the skill to a fresh agent and ask, in one message:

> Where could an agent comply with the letter of this skill while violating its intent?
> What edge cases does it not cover? Which instruction is ambiguous without prior context?

Patch what comes back. Re-run tier 2 afterwards — patches often bloat the description.

## Reporting

State plainly which tiers ran. A skill that passed tier 2 only is "routing verified,
execution NOT VERIFIED". Never call a skill done on the strength of having read it.
