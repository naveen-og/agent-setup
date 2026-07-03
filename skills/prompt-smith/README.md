# prompt-smith

Cross-harness prompt-refinement skill. Give it a raw prompt; it scores the
prompt against a 10-point rubric, interviews you if context is missing
(one goal question, then one batch of ≤5), and returns a professionally
engineered version with a full breakdown: refined prompt, before/after
rubric scores, tactics applied, assumptions, and one alternative version.

## Invocation

- Claude Code: `/prompt-smith <raw prompt>`
- pi: skill discovered from `~/.agents/skills/prompt-smith`
- OpenCode: skill discovered from `~/.config/opencode/skill/prompt-smith`

Handles any prompt type: coding-agent tasks, research, writing, image
generation, system prompts, chat questions.

## Install

Symlinks are created by the repo installer:

```bash
cd ~/agent-setup && bash install.sh
```

## Design

Spec: `docs/superpowers/specs/2026-07-03-prompt-smith-design.md`
Single-file skill — all logic lives in `SKILL.md`.
