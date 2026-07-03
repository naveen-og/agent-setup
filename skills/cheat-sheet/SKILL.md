---
name: cheat-sheet
description: Use when the user wants to learn a topic as a cheat sheet — "make a cheat sheet for git rebase", "/cheatsheet: docker networking". Researches the topic from 5 fixed perspectives (Beginner, Practical, Pitfalls, Expert, Alternatives) and renders a dense, single-file, offline-ready HTML reference card. Optional reference images override the default visual design.
---

# cheat-sheet — Topic → Offline HTML Reference Card

Take a topic, research it from 5 perspectives, render one self-contained HTML
file that reads like a real reference card — dense, scannable, zero fluff.

## Input

- **Topic string** (required) — e.g. `git rebase`, `docker networking`
- **Reference images** (optional) — screenshots/mockups of a desired look.
  If present, they are the design brief and override the default template.

## The 5 Perspectives

Every cheat sheet has exactly these sections, in this order:

| # | Perspective | Contents |
|---|-------------|----------|
| 1 | Beginner | Core mental model — the 5–10 things you must know first |
| 2 | Practical | Commands / snippets / recipes for real daily tasks |
| 3 | Pitfalls | Common mistakes, footguns, "why is it broken" fixes |
| 4 | Expert | Advanced flags, internals, power techniques |
| 5 | Alternatives | Competing tools/approaches + when to pick which |

## Workflow

### 1. Slug + research
Kebab-case slug, max 5 words: "git rebase interactive" → `git-rebase-interactive`.

Research the topic with whatever the harness gives you — web search tool if
available, else model knowledge. The 5 perspectives are how you *present* the
research, not 5 separate runs. Thin perspective → fill from knowledge; a cheat
sheet states facts, it doesn't hedge or cite mid-card.

### 2. Design
**Reference images attached:** extract layout, 4–6 hex colors, type treatment,
density. Build the CSS to match. Skip the default template.

**No images:** use the default template below, with one required customization —
**derive the accent color from the topic's own world** (git → `#f05133`,
docker → `#1d63ed`, python → `#ffd343`, rust → `#ce422b`). Say which color you
picked and why. Never ship a generic purple/teal/acid-green accent.

**Anti-slop contract (both paths):**
- Single HTML file, all CSS in one `<style>` block, **zero external requests** —
  no CDN, no webfonts, no remote images, no Tailwind script. Tailwind's *tokens*
  (spacing scale, slate palette) hand-written as CSS custom properties are the
  design system.
- Density is the aesthetic: 3-column card grid on desktop, 1 on mobile. No hero
  section, no marketing copy, no "Welcome to your guide!"
- Every entry short: term/command in `<code>`, ≤2 lines of explanation. Needs a
  paragraph → split it or cut it.
- One accent color total. Perspectives get a thin left border rail + small
  uppercase label — not five loud colors.
- No emoji in headings. No gradients. Shadows ≤ `0 1px 3px`. Radius ≤ 8px.
- Dark default via `prefers-color-scheme`, light theme + print stylesheet included.
- System font stack for text, `ui-monospace` stack for code. Personality from
  weight contrast and letter-spacing, not fonts that can't load offline.

### 3. Default template
Start from this verbatim (swap accent + content):

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>[Topic] — Cheat Sheet</title>
<style>
:root {
  --bg: #0e1116; --surface: #161b22; --border: #262d36;
  --text: #dce3ea; --muted: #8b96a3;
  --accent: /* topic-derived */;
  --mono: ui-monospace, 'Cascadia Code', 'JetBrains Mono', Menlo, monospace;
  --sans: system-ui, -apple-system, 'Segoe UI', sans-serif;
}
@media (prefers-color-scheme: light) {
  :root { --bg:#f8f9fa; --surface:#fff; --border:#dde2e8; --text:#1a2027; --muted:#5b6672; }
}
* { margin:0; box-sizing:border-box; }
body { background:var(--bg); color:var(--text); font:15px/1.5 var(--sans); padding:2rem 1rem; }
.sheet { max-width:1100px; margin:0 auto; }
header { border-bottom:2px solid var(--accent); padding-bottom:1rem; margin-bottom:1.5rem; }
header h1 { font-size:1.6rem; font-weight:700; letter-spacing:-0.02em; }
header p { color:var(--muted); margin-top:.25rem; }
nav { display:flex; flex-wrap:wrap; gap:.5rem 1.25rem; margin:.75rem 0 0; font-size:.78rem;
      text-transform:uppercase; letter-spacing:.08em; }
nav a { color:var(--muted); text-decoration:none; }
nav a:hover, nav a:focus-visible { color:var(--accent); }
section { margin-bottom:2rem; }
section > h2 { font-size:.78rem; text-transform:uppercase; letter-spacing:.1em;
  color:var(--accent); border-left:3px solid var(--accent); padding-left:.6rem; margin-bottom:.75rem; }
.grid { column-count:3; column-gap:1rem; }
@media (max-width:900px){ .grid{column-count:2} }
@media (max-width:600px){ .grid{column-count:1} body{padding:1rem .5rem} }
.card { break-inside:avoid; background:var(--surface); border:1px solid var(--border);
  border-radius:6px; padding:.75rem .9rem; margin-bottom:1rem; }
.card h3 { font-size:.95rem; font-weight:600; margin-bottom:.4rem; }
.card p { font-size:.85rem; color:var(--muted); }
code { font:.82rem var(--mono); background:color-mix(in srgb, var(--accent) 8%, var(--surface));
  border:1px solid var(--border); border-radius:4px; padding:.1em .35em; }
pre { background:var(--bg); border:1px solid var(--border); border-radius:6px;
  padding:.6rem .75rem; overflow-x:auto; margin:.5rem 0 0; }
pre code { background:none; border:none; padding:0; display:block; }
kbd { font:.78rem var(--mono); border:1px solid var(--border); border-bottom-width:2px;
  border-radius:4px; padding:.05em .4em; }
footer { color:var(--muted); font-size:.75rem; border-top:1px solid var(--border);
  padding-top:.75rem; margin-top:1rem; }
@media print { :root{--bg:#fff;--surface:#fff;--border:#ccc;--text:#000;--muted:#444}
  .card{border:1px solid #ccc} nav{display:none} }
</style>
</head>
<body>
<div class="sheet">
  <header>
    <h1>[Topic]</h1>
    <p>[One sentence: what it is + why you'd use it. No fluff.]</p>
    <nav>
      <a href="#beginner">Beginner</a><a href="#practical">Practical</a>
      <a href="#pitfalls">Pitfalls</a><a href="#expert">Expert</a>
      <a href="#alternatives">Alternatives</a>
    </nav>
  </header>
  <section id="beginner"><h2>Beginner — the mental model</h2>
    <div class="grid"> <!-- .card per concept --> </div>
  </section>
  <!-- practical / pitfalls / expert / alternatives: same structure -->
  <footer>Generated YYYY-MM-DD · cheat-sheet skill</footer>
</div>
</body>
</html>
```

Card patterns:
- Command: `<h3><code>git rebase -i HEAD~3</code></h3><p>Rewrite last 3 commits interactively.</p>`
- Concept: `<h3>Fast-forward</h3><p>Branch pointer moves; no merge commit created.</p>`
- Pitfall: problem in `<h3>`, consequence + fix in `<p>`, `<pre>` with the fix command when one exists.

### 4. Save + verify
1. Write to `./cheatsheets/[slug].html` (create dir), unless the user or the
   project's conventions say otherwise.
2. Verify zero external requests:
   `grep -E '<(link|script)[^>]*(href|src)=|@import|url\(' [file]` must match nothing.
3. If a headless browser is available, screenshot dark + light
   (`chromium --headless --screenshot=... [--force-dark-mode]`) and eyeball the
   render before claiming done.

## Success criteria
- One HTML file, offline-ready, renders in dark + light + print
- All 5 perspective sections present, populated with short scannable entries
- Accent color justified by the topic (or matched to reference images)
