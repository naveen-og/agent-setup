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

echo
echo "Done. Codex CLI is per-project: ln -s $SKILL/AGENTS.md ./AGENTS.md"
