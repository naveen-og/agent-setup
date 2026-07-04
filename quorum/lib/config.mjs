import path from "node:path";
import fs from "node:fs";
import { readJson, ROLES } from "./util.mjs";

// Default: claude-bridge first, free mantle fallback. Removing claude-bridge
// from pi just makes the fallback column active — no quorum change needed.
export const DEFAULT_CONFIG = {
  llm: {
    // {model} and {promptFile} are substituted; prompt content is passed via file
    // to dodge argv length limits.
    cmd: "pi",
    args: [
      // NOTE: extensions must stay enabled — claude-bridge is a pi extension;
      // --no-extensions removes the provider and every claude-* model with it.
      "-p", "--no-session", "--no-skills",
      "--no-prompt-templates", "--no-context-files", "--mode", "text",
      "--model", "{model}", "@{promptFile}",
    ],
    models: {
      orchestrator: ["claude-bridge/claude-fable-5", "mantle/zai.glm-4.7"],
      planner: ["claude-bridge/claude-fable-5", "mantle/moonshotai.kimi-k2-thinking"],
      reviewer: ["claude-bridge/claude-opus-4-8", "mantle/zai.glm-4.7"],
      coder: ["claude-bridge/claude-sonnet-5", "mantle/qwen.qwen3-coder-480b-a35b-instruct"],
      researcher: ["claude-bridge/claude-sonnet-5", "mantle/moonshotai.kimi-k2.5"],
    },
  },
  budgets: {
    maxTurnsPerAgent: 40,
    turnTimeoutSec: 420,
    maxWallClockMin: 240,
    idleSleepMinSec: 5,
    idleSleepMaxSec: 60,
    stallMin: 15,
  },
};

const PROFILES = {
  // all roles on one free fast model — live testing without claude tokens
  test: (cfg) => {
    for (const r of ROLES) cfg.llm.models[r] = ["mantle/zai.glm-4.7-flash"];
    return cfg;
  },
  // scripted executor — fully offline deterministic integration tests
  fake: (cfg) => {
    cfg.llm.cmd = process.env.QUORUM_FAKE_CMD || "node";
    cfg.llm.args = [
      path.join(path.dirname(new URL(import.meta.url).pathname), "fake-llm.mjs"),
      "{role}", "{promptFile}",
    ];
    for (const r of ROLES) cfg.llm.models[r] = ["fake"];
    return cfg;
  },
};

export function loadConfig(projectDir, { profile } = {}) {
  const cfg = structuredClone(DEFAULT_CONFIG);
  for (const f of [
    path.join(projectDir, "quorum.config.json"),
    path.join(projectDir, ".quorum", "config.json"),
  ]) {
    if (fs.existsSync(f)) {
      deepMerge(cfg, readJson(f, {}));
      break;
    }
  }
  const prof = profile || process.env.QUORUM_PROFILE;
  if (prof) {
    if (!PROFILES[prof]) throw new Error(`unknown profile '${prof}' (valid: ${Object.keys(PROFILES).join(",")})`);
    PROFILES[prof](cfg);
  }
  return cfg;
}

function deepMerge(target, src) {
  for (const [k, v] of Object.entries(src)) {
    if (v && typeof v === "object" && !Array.isArray(v) && typeof target[k] === "object" && !Array.isArray(target[k])) {
      deepMerge(target[k], v);
    } else {
      target[k] = v;
    }
  }
  return target;
}
