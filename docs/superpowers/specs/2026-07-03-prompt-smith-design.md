# prompt-smith — Design Spec

Date: 2026-07-03
Status: approved (design), pending implementation

## Purpose

On-demand, cross-harness skill that turns any raw prompt into a professionally
engineered one. User invokes `/prompt-smith <raw prompt>`; skill scores the
prompt against a 10-point rubric, interviews the user if context is
insufficient, rewrites the prompt using established prompt-engineering
tactics, and returns a full breakdown.

Scope: any prompt type — coding-agent tasks, research, writing, image
generation, system prompts, chat prompts.

## Repo Layout

Follows the coding-excellence pattern in this repo:

```
skills/prompt-smith/
├── SKILL.md      ← the whole skill: rubric + tactics + interview + output template
└── README.md     ← human documentation
```

Single-file skill (approach A). No references/ directory, no scripts, no
AGENTS.md adapter — this is an invoked skill, not always-on rules.

## Harness Distribution

`install.sh` gains three symlinks:

| Harness     | Link path                              | Discovery |
|-------------|----------------------------------------|-----------|
| Claude Code | `~/.claude/skills/prompt-smith`        | auto-discovered skill, `/prompt-smith` |
| pi          | `~/.agents/skills/prompt-smith`        | skill directory |
| OpenCode    | `~/.config/opencode/skill/prompt-smith`| SKILL.md discovery |

## Rubric — 10 dimensions, 1 point each

1. Goal clarity
2. Audience / target model specified
3. Context sufficiency
4. Output format defined
5. Constraints stated
6. Examples present (when useful)
7. Success criteria
8. Role / persona (when useful)
9. Scope bounds
10. Ambiguity-free wording

Score ≥ 8 → refine directly, no interview.
Score < 8 → interview.

Dimensions 6 and 8 score a free point when genuinely not applicable to the
prompt type (e.g. examples add nothing to a one-line factual query).

## Interview Protocol — hybrid

1. If goal is unclear: ask ONE question first — "what should the result
   do/achieve?"
2. Then ONE batch of at most 5 questions, covering only rubric dimensions
   that scored 0.
3. Never re-interview after the batch. Anything still missing becomes a
   stated assumption in the output.

## Tactics Library

Skill first detects prompt type (coding task / research / writing / image
gen / system prompt / chat question), then applies matching tactics. Each
tactic documented in SKILL.md as one line with a when-to-use condition:

- Role prompting
- Structured sections (context → task → constraints → format)
- Chain-of-thought triggers
- Few-shot examples
- Output schemas
- Delimiter fencing
- Negative constraints
- Success-criteria anchoring

## Output Format — full breakdown

1. **Refined prompt** in a copy-ready fenced block
2. **Rubric table** — before/after score per dimension
3. **Tactics applied** — each with a one-line why
4. **Assumptions made** (if any; from unanswered interview gaps)
5. **One alternative version** — a different angle (terser, or more
   structured) than the primary refinement

## Out of Scope

- Saving refined prompts to files (display only; user copies)
- Prompt version history / library
- Automated scoring scripts
- Gemini CLI / Codex adapters (can be added later if wanted)

## Success Criteria

- `/prompt-smith` resolves and executes in all three harnesses via symlinks
- Vague one-liner prompt triggers hybrid interview; detailed prompt does not
- Output always contains all five breakdown sections
- SKILL.md stays a single portable markdown file (~250 lines)
