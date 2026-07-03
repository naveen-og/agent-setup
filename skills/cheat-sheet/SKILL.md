---
name: cheat-sheet
description: Use when the user wants to learn a topic as a cheat sheet — "make a cheat sheet for git rebase", "/cheatsheet: docker networking". Researches the topic from 5 fixed perspectives (Beginner, Practical, Pitfalls, Expert, Alternatives) and renders a minimal, document-style, single-file offline HTML page with a self-test quiz. Optional reference images override the default visual design.
---

# cheat-sheet — Topic → Minimal Document-Style Reference Page

Take a topic, research it from 5 perspectives, render one self-contained HTML
file that reads like a beautifully typeset lesson page — serif prose, generous
whitespace, code blocks with aligned comments, and a short retrieval quiz at
the end. PDF-like, not dashboard-like.

## Input

- **Topic string** (required) — e.g. `git rebase`, `docker networking`
- **Reference images** (optional) — screenshots/mockups of a desired look.
  If present, they are the design brief and override the default template.

## The 5 Perspectives

Every sheet covers exactly these, as flowing document sections (not labeled
cards — the section titles are written for the reader, per topic):

| # | Perspective | Section it becomes |
|---|-------------|--------------------|
| 1 | Beginner | "The one idea" — core mental model, prose + optional ASCII diagram |
| 2 | Practical | "The commands you actually need" — one commented code block + usage prose |
| 3 | Pitfalls | "Where people get burned" — 3–5 bold-lead paragraphs, each mistake → consequence → fix |
| 4 | Expert | "Power moves" — advanced block + prose |
| 5 | Alternatives | "When not to use [topic]" — honest judgment prose, no feature tables |

Plus a closing **"Check yourself"** section: 2–3 multiple-choice questions on
the page's most load-bearing facts, answers behind `<details>` (retrieval
practice — this is what makes it stick).

## Workflow

### 1. Slug + research
Kebab-case slug, max 5 words. Research with whatever the harness gives you —
web search tool if available, else model knowledge. The perspectives are how
you *present* the research, not 5 separate runs. State facts; don't hedge or
cite mid-page.

### 2. Design
**Reference images attached:** extract layout, palette, type treatment. Build
the CSS to match. Skip the default template.

**No images:** use `template.html` in this skill's directory — it is the exact
skeleton, read it and fill it. Design contract it implements:

- **Document, not dashboard.** Single ~700px column, warm paper background,
  serif body (`Charter/Georgia` stack) at 17px/1.65. Reads like a well-set
  book page or PDF.
- Small uppercase mono **eyebrow** line in muted red above the title
  (`Cheat Sheet · [Domain] · ~[N] minutes`), bold serif title, italic subtitle.
- One **callout** near the top: 3px red left border, the single most important
  rule/warning for the topic.
- **Code blocks**: light warm gray, small mono, `#` comments aligned in a
  straight column, 5–8 lines per block max.
- Body is **prose with bolded key terms**, inline `code` woven into sentences.
  No card grids, no bullet walls, no emoji, no gradients, no hero sections.
- Muted book-red accent (`#8f2c24`) used only for eyebrow + callout border.
  Green (`#2e6b3e`) only for quiz answers.
- Zero external requests — no CDN, no webfonts, no scripts. Dark variant via
  `prefers-color-scheme` (deep warm gray, not pure black), print styles included.

### 3. Fill + save
1. Write to `./cheatsheets/[slug].html` (create dir), unless told otherwise.
2. Verify zero external requests:
   `grep -E '<(link|script)[^>]*(href|src)=|@import|url\(' [file]` → no matches.
3. If a headless browser is available, screenshot and eyeball
   (`chromium --headless --screenshot=... [--force-dark-mode]`) before claiming done.

## Success criteria
- One HTML file, offline-ready, renders in light + dark + print
- Reads top-to-bottom like a lesson page: idea → commands → pitfalls → power → alternatives → quiz
- Prose-first; every code block earns its place and stays short
- Quiz questions test the page's own key facts, answers hidden until clicked
