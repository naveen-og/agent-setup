import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { qdir } from "./util.mjs";
import { loadBoard } from "./tasks.mjs";
import { getGoal } from "./goal.mjs";
import { readHeuristics, readPlaybook } from "./heuristics.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = path.join(HERE, "..", "prompts");
const Q = path.join(HERE, "..", "bin", "q.mjs");

function clip(s, max) {
  return s.length > max ? s.slice(0, max) + "\n…[truncated]" : s;
}

// Rebuild an agent's ENTIRE context from files. No hidden session state —
// this is what makes agents stateless, resumable, and model-agnostic.
export function composePrompt({ projectDir, role, events, turn, cfg }) {
  const rolePrompt = fs.readFileSync(path.join(PROMPTS_DIR, `${role}.md`), "utf8");
  const goal = getGoal(projectDir);
  const board = loadBoard(projectDir);
  const planFile = path.join(qdir(projectDir), "plan.md");
  const plan = fs.existsSync(planFile) ? fs.readFileSync(planFile, "utf8") : "(no plan yet)";
  const heuristics = readHeuristics(projectDir, role) || "(none yet)";
  const playbook = readPlaybook(projectDir) || "(empty)";
  const maxTurns = cfg.budgets.maxTurnsPerAgent;

  return `${rolePrompt}

---

# CURRENT STATE (rebuilt fresh from .quorum/ — you have no other memory)

## Protocol tool
All coordination goes through the q CLI. Invoke it exactly as:
    node ${Q} <subcommand ...>
Your role is preset via QUORUM_ROLE=${role}; never pass --as.
Run \`node ${Q} help\` output is already known to you from your role prompt.

## Goal
Status: ${goal?.status}
${clip(goal?.text || "(none)", 2000)}

## Acceptance criteria (${goal?.acceptance?.length || 0})
${clip(JSON.stringify(goal?.acceptance || [], null, 1), 2000)}

## Living plan (.quorum/plan.md)
${clip(plan, 4000)}

## Task board
${clip(JSON.stringify(board, null, 1), 4000)}

## Your learned heuristics (follow them)
${clip(heuristics, 2500)}

## Team playbook (shared lessons)
${clip(playbook, 2000)}

## New messages for you (already consumed — act on them now or they are lost)
${clip(JSON.stringify(events, null, 1), 6000)}

## Turn budget
This is your turn ${turn} of ${maxTurns}. Be decisive; do real work every turn.

# YOUR TURN — do the work now
1. Act on your role's duties given the state above (edit files, run commands, use q).
2. Communicate: send at least one bus message about what you did or decided.
3. Reflect: end by evaluating this turn — if you learned a durable lesson, save it:
   node ${Q} learn "<one-sentence heuristic>"
   (Skip if nothing genuinely new. If it reports full=true, consolidate: rewrite
   .quorum/memory/heuristics/${role}.md down to the best 15 lessons.)
`;
}
