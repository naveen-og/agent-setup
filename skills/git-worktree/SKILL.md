---
name: git-worktree
description: Use when running two or more coding agents on one repo, when agents overwrite each other's changes, or when an agent fails inside a fresh worktree with missing env vars, missing dependencies, or a port already in use. Covers creating worktrees, bootstrapping them to match the primary checkout, merging back, and cleanup. Triggers on "worktree", "parallel agents", "one worktree per task", "agents keep clobbering each other".
---

# Git worktrees for parallel agents

## Where am I?

```bash
[ "$(git rev-parse --path-format=absolute --git-dir)" = "$(git rev-parse --path-format=absolute --git-common-dir)" ] \
  && echo "primary checkout" || echo "worktree"
```

- **Primary checkout** → do not start editing here. Create a worktree named for the
  task, bootstrap it, `cd` in, do all task work there.
- **Worktree** → proceed.

## The model

One repo, many folders. `git worktree add` makes another checkout of the same repository
in its own directory on its own branch. All worktrees share one `.git`; each has its own
files. Two agents in two worktrees physically cannot overwrite each other.

- **One task = one worktree = one agent session.** Never two agents in one directory.
- **The primary checkout is the integration point.** It stays on the main branch and is
  used to review, merge, and push. It is not a scratchpad.
- **Nothing auto-merges.** A human reviews each diff, merges or discards, then removes
  the worktree.
- Worktree branches are local and short-lived. Do not push them unless asked.
- Merge one at a time. Rebase onto main first if main moved.

## Commands

```bash
git worktree add ../repo-task-x           # new worktree + branch "repo-task-x"
git worktree add ../fix-y -b fix-y main   # explicit branch off main
git worktree list
git worktree remove ../repo-task-x
git worktree prune                        # clear stale registrations
```

A branch can be checked out in only one worktree at a time, including main.

## Bootstrapping — the #1 failure

A fresh worktree contains **only tracked files**. Everything gitignored is absent, and an
agent dropped into a bare worktree fails in confusing ways that look like code bugs.
Replicate before the agent starts:

1. **Env / secret files** — copy `.env`, `.env.local`, and friends from the primary
   checkout. **Copy, never symlink** — an agent editing a symlinked env file corrupts the
   original.
2. **Dependencies** — run the real install (`npm ci`, `pnpm install`, `uv sync`,
   `pip install -e .`). Never symlink `node_modules`; it breaks builds in both checkouts.
3. **Local databases and services** — shared server (one Postgres container): pin the
   identity so worktrees do not each spawn a duplicate fighting for the port. For Docker
   Compose set a top-level `name:`, otherwise the project name comes from the folder name.
   Per-worktree state (SQLite): copy or re-seed it.
4. **Ports** — dev servers, test servers, and debuggers bind fixed ports. Either run one
   worktree at a time, or make the port configurable per worktree.
5. **Generated files and caches** — rebuild (`npm run build`, codegen). Build output is
   gitignored and will not be there.
6. **Git hooks** — `core.hooksPath` and `.git/config` are shared automatically; check the
   hook scripts do not assume the primary checkout's path.

Codify this as `scripts/setup-worktree.sh` in the repo and make it the first command run
in any new worktree. From inside a worktree, the primary checkout's path is:

```bash
dirname "$(git rev-parse --path-format=absolute --git-common-dir)"
```

## Under an orchestrator

When an orchestrator allocates worktrees for you (silicorism does, with an
`allocated → active → quarantined | cleaned` GC state machine), you do not create or
remove them by hand — but the bootstrap checklist above still applies. An orchestrated
worker node that fails immediately with a missing module, a missing env var, or a bound
port is almost always an un-bootstrapped worktree, not a broken task.

Reclaim finished worktrees through the orchestrator's own GC rather than
`git worktree remove`, so its state table does not drift from the filesystem.

## Merging back

```bash
# from the primary checkout, after reviewing the diff:
git merge --no-ff task-branch      # or --squash
git worktree remove ../repo-task-x
git branch -d task-branch
```

## Gotchas

- Missing gitignored files is the top failure. Always bootstrap first.
- Disk: each worktree duplicates working files plus its own `node_modules`. Delete merged
  ones; do not hoard.
- Long-lived worktrees rot. Stalled for days → rebase onto main or restart.
- Uncommitted work in a removed worktree is gone. Commit early; commits survive in the
  shared repo even after the folder is deleted.
- One shared stash list, one shared config, one shared refs namespace. Worktrees isolate
  files, not git state.
