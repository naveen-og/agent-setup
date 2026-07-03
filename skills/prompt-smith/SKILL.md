---
name: prompt-smith
description: Use when the user wants a prompt refined, improved, or engineered — takes a raw prompt for any target (coding agent, chat LLM, research, writing, image gen, system prompt), scores it against a 10-point rubric, interviews the user if context is missing, and returns a professionally engineered version with a full breakdown.
---

# prompt-smith — Prompt Refinement Skill

Turn a raw prompt into a professionally engineered one. Follow this workflow
exactly, in order. Do not skip the scoring step even for prompts that look
good.

## Workflow

1. **Detect prompt type** (silently)
2. **Score** the raw prompt against the rubric (silently)
3. **Interview** if score < 8 (hybrid protocol below)
4. **Refine** using the tactics library
5. **Output** the full breakdown (all 5 sections, always)

## Step 1 — Detect Prompt Type

Classify the raw prompt as one of:

| Type | Signals |
|------|---------|
| coding-task | mentions code, files, bugs, features, repos, CLIs |
| research | asks to find, compare, survey, investigate |
| writing | asks for prose: article, email, docs, copy, story |
| image-gen | describes a visual to generate |
| system-prompt | defines an assistant's persistent behavior/persona |
| chat-question | one-shot question to an LLM |

Type drives which tactics apply and which rubric dimensions are N/A.

## Step 2 — Score Against Rubric

10 dimensions, 1 point each. Score honestly; a vague dimension scores 0.

1. **Goal clarity** — is the desired end result unambiguous?
2. **Audience/model** — is the target (model, harness, reader) specified?
3. **Context sufficiency** — does the executor have the background it needs?
4. **Output format** — is the shape of the answer defined (structure, length, medium)?
5. **Constraints** — are the hard boundaries stated (stack, tone, budget, do-nots)?
6. **Examples** — are examples given where they would disambiguate? *
7. **Success criteria** — can you tell when the result is right?
8. **Role/persona** — is a role assigned where it would improve output? *
9. **Scope bounds** — is it clear what is out of scope?
10. **Ambiguity-free wording** — no terms with two readings, no dangling pronouns

\* Dimensions 6 and 8 score a free point when genuinely not applicable
(e.g. examples add nothing to a one-line factual query). "Not applicable"
means the tactic would not improve the prompt — not that the user omitted it.

**Score ≥ 8:** skip to Step 4. **Score < 8:** interview.

## Step 3 — Interview (hybrid protocol)

1. **Goal first.** If dimension 1 scored 0, ask ONE question only:
   what should the result do or achieve? Wait for the answer.
2. **One batch.** Ask at most 5 questions in a single message, covering only
   the dimensions that scored 0 (skip dimension 1 if already asked). Prefer
   multiple-choice with a recommended option. Number the questions.
3. **Never re-interview.** After the batch, anything still unknown becomes a
   stated assumption in the output — pick the most likely reading and say so.

Do not interview about dimensions that scored 1. Do not pad the batch to 5.

## Step 4 — Refine Using Tactics

Rewrite the prompt applying every tactic whose condition holds:

| Tactic | Apply when |
|--------|-----------|
| Role prompting | expertise framing would change output quality ("You are a senior DBA…") |
| Structured sections | prompt has >2 concerns — order as context → task → constraints → format |
| Chain-of-thought trigger | task needs multi-step reasoning ("think step by step before answering") |
| Few-shot examples | desired output style/format is easier shown than described (1–3 examples) |
| Output schema | consumer needs machine-parseable or strictly shaped output (JSON, table, template) |
| Delimiter fencing | prompt embeds data/code/quotes that must not be confused with instructions |
| Negative constraints | common failure modes exist ("do not include X", "avoid Y") |
| Success-criteria anchoring | quality is judgeable ("the answer is correct if…") |

Rules for the rewrite:
- Preserve the user's intent exactly — refine, never redirect
- Every fact in the refined prompt must come from the raw prompt, the
  interview answers, or a stated assumption — invent nothing
- Match register to target: terse imperative for coding agents, natural
  language for chat, comma-separated descriptors for image gen
- Shorter is better when it loses nothing

## Step 5 — Output (all 5 sections, every time)

### 1. Refined prompt
Copy-ready fenced block. Nothing inside the fence except the prompt itself.

### 2. Rubric scores
| # | Dimension | Before | After |
with a total row. After-scores reflect the refined prompt.

### 3. Tactics applied
Bullet list — tactic name + one line why it was used here.

### 4. Assumptions
Bullet list of assumptions made for unanswered gaps. Write "None" if none.

### 5. Alternative version
One alternative refined prompt in its own fenced block, taking a different
angle than the primary (terser if primary is structured; more structured if
primary is terse). One line stating when to prefer it.
