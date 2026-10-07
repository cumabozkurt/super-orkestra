# CLI reference

The `super-orkestra` package installs two identical binaries, `super-orkestra` and the short alias `orkestra`. Run commands from your project root. `orkestra.config.json` and `.orkestra/` are resolved relative to the current directory.

```text
super-orkestra [command] [options]
  -V, --version   print the version
  -h, --help      show help (also: super-orkestra help <command>)
```

CLI messages are currently in Turkish. Exit codes: `0` on success, `1` on an unexpected error (printed as `orkestra: <message>`), `2` for invalid input such as an empty goal or a bad option value.

## `run <goal...>`

Plan, dispatch, gate, review and merge.

```bash
super-orkestra run "add input validation to the signup form and test it"
super-orkestra run fix flaky date tests in utils          # words are joined with spaces
printf 'multi-line\ngoal with "quotes"\n' | super-orkestra run -
ORKESTRA_INPUT="goal text" super-orkestra run -
```

- `-` as the only argument reads the goal from `ORKESTRA_INPUT` if it is set, otherwise from stdin. This avoids shell quoting problems; the VS Code extension and the desktop app use it.
- When it finishes, it prints `Sonuç:` (result) with a status per task (`done`, `failed`, `paused`) and `Token:` with the usage summary.
- If any task is `paused`, the process keeps running and resumes when the limit resets (checked every `ORKESTRA_TICK_MS`, 30 s by default). It exits once no jobs for this project are pending. You can press Ctrl+C and use `resume-daemon` instead.

## `mcp`

Start the MCP server on stdio in the current directory. See [MCP server](mcp.md).

```bash
claude mcp add super-orkestra -- super-orkestra mcp
```

## `resume-daemon`

Print the number of pending resume jobs, then keep running and resume jobs as their limits reset. It handles jobs from **every project**: for each job it builds a conductor using that project's configuration.

```bash
super-orkestra resume-daemon
```

Run it in a terminal multiplexer or as a user service if you often hit limits overnight.

## `limits`

Print tracked limit windows as JSON. Keys are agents (`claude-code`, `codex`) or `agent:model` for opencode and OpenRouter. Example output:

```bash
$ super-orkestra limits
{
  "claude-code": [
    { "usedPct": 41, "resetsAt": 1791230400, "windowMin": 0 },
    { "usedPct": 12, "resetsAt": 1791676800, "windowMin": 0 }
  ],
  "codex": [
    { "usedPct": 18, "resetsAt": 1791228000, "windowMin": 300 },
    { "usedPct": 6, "resetsAt": 1791800000, "windowMin": 10080 }
  ]
}
```

`resetsAt` is a Unix epoch in seconds. An empty object means no data yet. Install the Claude statusline hook, or run Codex once.

## `usage`

Aggregate `.orkestra/usage.jsonl` of the current project. Example output:

```json
{
  "byWorker": { "w1": { "runs": 3, "input": 5400, "output": 1200, "cacheRead": 48000 } },
  "conductor": { "input": 3100, "output": 420, "cacheRead": 9000, "cacheWrite": 300 }
}
```

## `models [--free]`

Discover models from `opencode models` and OpenRouter's public `/models` endpoint. Either source is skipped silently if it is unavailable.

```bash
super-orkestra models --free    # opencode models matching "free" or "big-pickle", and zero-price OpenRouter models
```

Output: `[{ "provider": "opencode" | "openrouter", "id": "…", "free": true | false }, …]`

## `map [-t <tokens>] [-f <focus>]`

Print the ranked repo map ([how it is built](architecture.md#repo-map)).

| Option | Default | Meaning |
|---|---|---|
| `-t, --tokens <n>` | `1500` | Token budget (must be a positive number) |
| `-f, --focus <text>` | `""` | Words that personalize the ranking (file paths and symbol names) |

```bash
super-orkestra map -t 800 -f "payment refund"
```

## `remember <text...>`

Store a fact in the project memory (`.orkestra/memory/facts.db`). `-` reads from `ORKESTRA_INPUT` or stdin.

```bash
super-orkestra remember "Integration tests need docker compose up -d first"
```

## `recall <query...>`

Print `conventions.md` plus the stored facts that best match the query (BM25), within a 1500-token budget.

```bash
super-orkestra recall integration tests
```

## `statusline`

The Claude Code statusline hook. Claude Code pipes its statusline JSON to the command. The hook saves `rate_limits` to `~/.orkestra/claude-limits.json` and prints a short status such as `5s: %41 · sıfırlanma 15:00` (5-hour usage and reset time), or `orkestra` when no limit data is present.

```json
{ "statusLine": { "type": "command", "command": "super-orkestra statusline" } }
```

The hook never crashes on malformed input and writes atomically. It also exists as a standalone script at `packages/cli/hooks/claude-statusline.mjs`.

## Scripts in this repository

| Command | Purpose |
|---|---|
| `npm run smoke [-- <model>]` | Real end-to-end check with opencode (default model `opencode/big-pickle`, no login needed). Creates a temp repo with a bug and asks a worker to fix it. |
| `scripts/scenarios/` | Limit hand-off (S3) and all-limited auto-resume (S4) scenarios driven by a mock opencode wrapper. See its [README](../scripts/scenarios/README.md). |
| `npm run set-repo -- <owner>` | Replaces an `OWNER` placeholder in package metadata and docs (useful for forks) |
