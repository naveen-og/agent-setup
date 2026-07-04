# Running Quorum outside pi

The workflow is the `.quorum/` protocol + role prompts + the supervisor loop. The only pluggable part is the **turn executor** — the command that turns a prompt file into actions. Configure it per project in `quorum.config.json`.

## pi (default)

```json
{
  "llm": {
    "cmd": "pi",
    "args": ["-p", "--no-session", "--no-extensions", "--no-skills",
             "--no-prompt-templates", "--no-context-files", "--mode", "text",
             "--model", "{model}", "@{promptFile}"]
  }
}
```

## Claude Code CLI

```json
{
  "llm": {
    "cmd": "bash",
    "args": ["-c", "claude -p \"$(cat {promptFile})\" --model {model} --permission-mode acceptEdits"],
    "models": { "coder": ["claude-sonnet-5"], "planner": ["claude-fable-5"],
                "reviewer": ["claude-opus-4-8"], "researcher": ["claude-sonnet-5"],
                "orchestrator": ["claude-fable-5"] }
  }
}
```

## OpenCode

```json
{
  "llm": {
    "cmd": "opencode",
    "args": ["run", "--model", "{model}", "@{promptFile}"]
  }
}
```

(Adjust to the harness's non-interactive syntax; the contract is only: read prompt, act with file/shell tools in cwd, exit 0 on success.)

## Any future harness

Requirements for an executor:

1. Non-interactive mode that accepts a prompt (file or stdin).
2. File edit + shell tools available to the model.
3. Exit code reflects turn success.

That's it. Agents keep state in `.quorum/`, communicate via `node bin/q.mjs`, and every prompt is composed fresh from files — so there is no session, no memory, and no feature of any specific model or harness that the coordination depends on. Mixed fleets work too: run the coder on one harness and the reviewer on another by pointing different `cmd` values per role (wrap in a dispatch script if needed).

## Human interface everywhere

`bin/quorum.mjs` is plain Node — `goal`, `status`, `log`, `say`, `report`, `stop` work from any shell, cron job, or other agent. The pi extension is 90 lines of wrapper; writing the same wrapper for another harness is trivial because it only shells out.
