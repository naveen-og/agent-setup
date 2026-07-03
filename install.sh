#!/usr/bin/env bash
# agent-setup installer — recreates all harness symlinks on a fresh machine.
# Idempotent: safe to re-run after every git pull.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL="$REPO_DIR/skills/coding-excellence"

link() { # link <target> <linkpath>
  mkdir -p "$(dirname "$2")"
  ln -sfn "$1" "$2"
  echo "linked: $2 -> $1"
}

# Claude Code — skill auto-discovered from ~/.claude/skills/
link "$SKILL" "$HOME/.claude/skills/coding-excellence"

# pi — always-on rules (global context file) + on-demand skill (deep mode)
link "$SKILL/AGENTS.md" "$HOME/.pi/agent/AGENTS.md"
link "$SKILL"           "$HOME/.agents/skills/coding-excellence"

# OpenCode — global rules
link "$SKILL/AGENTS.md" "$HOME/.config/opencode/AGENTS.md"

# Gemini CLI — global rules (harmless if gemini not installed)
link "$SKILL/GEMINI.md" "$HOME/.gemini/GEMINI.md"

# prompt-smith — on-demand prompt refinement skill (all harnesses)
PROMPT_SMITH="$REPO_DIR/skills/prompt-smith"
link "$PROMPT_SMITH" "$HOME/.claude/skills/prompt-smith"
link "$PROMPT_SMITH" "$HOME/.agents/skills/prompt-smith"
link "$PROMPT_SMITH" "$HOME/.config/opencode/skill/prompt-smith"

# handoff — on-demand session-handoff skill (all harnesses)
HANDOFF="$REPO_DIR/skills/handoff"
link "$HANDOFF" "$HOME/.claude/skills/handoff"
link "$HANDOFF" "$HOME/.agents/skills/handoff"
link "$HANDOFF" "$HOME/.config/opencode/skill/handoff"

# cheat-sheet — topic → offline HTML reference card (all harnesses)
CHEAT_SHEET="$REPO_DIR/skills/cheat-sheet"
link "$CHEAT_SHEET" "$HOME/.claude/skills/cheat-sheet"
link "$CHEAT_SHEET" "$HOME/.agents/skills/cheat-sheet"
link "$CHEAT_SHEET" "$HOME/.config/opencode/skill/cheat-sheet"

echo
echo "Done. Codex CLI is per-project: ln -s $SKILL/AGENTS.md ./AGENTS.md"
