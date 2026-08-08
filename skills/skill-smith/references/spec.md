# SKILL.md spec details

Source of truth for the open format: <https://agentskills.io/specification>. Fields
beyond `name` and `description` are client extensions — verify per client, assume nothing.

## Frontmatter

| Field | Required | Notes |
|---|---|---|
| `name` | yes | lowercase, letters/numbers/hyphens, 1–64 chars, **exactly** the folder name |
| `description` | yes | third person, "Use when…", triggers + scope + differentiator |
| `license` | no | free text |
| `disable-model-invocation` | no | Claude Code / VS Code Copilot only |
| `user-invocable` | no | client-specific |

- Whole frontmatter block ≤ 1024 characters.
- Invalid YAML fails **silently** — the skill simply never appears. When a brand-new
  skill does not show up at all, suspect YAML before anything else.
- `<` and `>` are unsafe in frontmatter; they can inject into the system prompt.
- `: ` (colon-space) inside an unquoted `description` is rejected by strict YAML parsers
  (pi) with "Nested mappings are not allowed in compact mappings", while lenient parsers
  (Claude Code) accept it. Single-quote the whole value and double inner apostrophes:

```yaml
description: 'Differentiator: this finds gaps; the teach skill fills them. Use when
  the user says "quiz me". Handles Dave''s notes.'
```

## Progressive disclosure budget

| Level | When loaded | Practical budget |
|---|---|---|
| 1 — `name` + `description` | every session, every skill installed | ~100 tokens |
| 2 — SKILL.md body | on routing match | under ~500 lines; under 200 if it loads often |
| 3 — `references/`, `scripts/`, `assets/` | only when the body names them | unbounded |

Level 1 is the only cost you pay unconditionally — which is why dozens of installed
skills are cheap and one bloated description is not. Scripts can execute without their
source ever entering context, so push deterministic logic into `scripts/` for token
reasons as well as reliability ones.

Check the body's weight before shipping:

```bash
wc -w <skill>/SKILL.md
```

## Composition

- One skill, one concern. Two concerns means two skills that compose at runtime.
- If skill A produces an artifact skill B consumes, document the artifact's shape in
  both. That is the interface.
- A shared repo-level file (`AGENTS.md`, `CLAUDE.md`, ADRs, a decision log) is how
  skills coordinate across sessions without explicit handoffs, and how agents get
  something resembling memory.

## Security checklist for third-party skills

A skill executes code and steers behaviour. Treat installing one as installing a
dependency with a shell.

- [ ] Read every file in the folder, not just SKILL.md
- [ ] Audit `scripts/` for outbound network calls, credential reads, writes outside the
      expected scope
- [ ] Grep references for injected instructions ("ignore previous instructions")
- [ ] Check the name is not typosquatting a popular skill
- [ ] Pin to a commit, not a moving branch
- [ ] First run in a sandbox or a throwaway repo

## Attribution

Distilled from Anthropic's superpowers `writing-skills` skill (TDD-for-documentation,
the failure/form matching table, rationalisation tables) and David Ondrej's
`effective-agent-skills` (progressive disclosure levels, description-as-routing-contract,
degrees-of-freedom, the pi YAML parser trap). Both MIT.
