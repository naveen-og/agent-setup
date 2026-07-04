// Quorum pi extension — thin wrapper over the harness-agnostic quorum CLI.
// Commands: /goal /fleet-status /say /fleet-stop /fleet-report
// All real logic lives in bin/quorum.mjs so the identical workflow runs from
// any harness (or a bare shell) without pi.
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const QUORUM = path.join(HERE, "..", "bin", "quorum.mjs");

export default function (pi: any) {
  if (process.env.QUORUM_DEBUG) console.error("[quorum] extension loaded");
  const run = async (args: string[], cwd: string) => {
    const res = await pi.exec("node", [QUORUM, ...args], { timeout: 30000, cwd });
    return (res.stdout + (res.stderr ? `\n${res.stderr}` : "")).trim();
  };

  pi.registerCommand("goal", {
    description: "Quorum: launch 5-agent fleet on a goal — /goal <natural language goal>",
    handler: async (args: string, ctx: any) => {
      const text = (args || "").trim();
      if (!text) {
        ctx.ui.notify("usage: /goal <goal text>", "error");
        return;
      }
      const out = await run(["goal", text], process.cwd());
      pi.sendMessage(
        { customType: "quorum", content: `Quorum fleet launched.\n${out}`, display: true },
        { deliverAs: "followUp" },
      );
    },
  });

  pi.registerCommand("fleet-status", {
    description: "Quorum: fleet/goal/task snapshot",
    handler: async (_args: string, ctx: any) => {
      const out = await run(["status"], process.cwd());
      pi.sendMessage({ customType: "quorum", content: out, display: true }, { deliverAs: "followUp" });
    },
  });

  pi.registerCommand("say", {
    description: "Quorum: message the orchestrator mid-run — /say <message>",
    handler: async (args: string, ctx: any) => {
      const out = await run(["say", (args || "").trim()], process.cwd());
      ctx.ui.notify(out, "info");
    },
  });

  pi.registerCommand("fleet-stop", {
    description: "Quorum: stop the fleet and mark goal stopped",
    handler: async (_args: string, ctx: any) => {
      const out = await run(["stop"], process.cwd());
      ctx.ui.notify(out, "info");
    },
  });

  pi.registerCommand("fleet-report", {
    description: "Quorum: print the final report",
    handler: async (_args: string, ctx: any) => {
      const out = await run(["report"], process.cwd());
      pi.sendMessage({ customType: "quorum", content: out, display: true }, { deliverAs: "followUp" });
    },
  });
}
