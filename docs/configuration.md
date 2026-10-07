# Configuration

Super Orkestra reads `orkestra.config.json` from the directory where you run it (the project root). The file is optional. Any field you leave out falls back to the defaults below. The merged result is validated, and errors are reported together before anything runs.

## Full example

```json
{
  "conductor": { "agent": "claude-code", "model": "opus" },
  "workers": [
    { "id": "w1", "agent": "claude-code", "model": "sonnet", "strengths": ["refactor", "feature", "multi-file"] },
    { "id": "w2", "agent": "codex", "model": "", "strengths": ["bugfix", "tests"] },
    { "id": "w3", "agent": "opencode", "model": "opencode/big-pickle", "strengths": ["docs", "small-edit", "boilerplate"] }
  ],
  "providers": { "openrouter": { "apiKeyEnv": "OPENROUTER_API_KEY" } },
  "gates": ["npm test --silent"],
  "budget": { "maxTokensPerTask": 60000, "maxRetries": 2 },
  "limits": { "pauseAtPercent": 95, "resumeDelaySec": 60, "allowAccountFailover": false },
  "memory": { "dir": ".orkestra/memory", "maxInjectTokens": 1200 }
}
```

This is exactly [`orkestra.config.example.json`](../orkestra.config.example.json). Apart from `gates`, it also equals the built-in defaults: when `gates` is omitted, it is detected from the project.

## Merge rules

| Field | How your value is combined with the default |
|---|---|
| `conductor`, `budget`, `limits`, `memory`, `providers` | Shallow merge: your keys override, missing keys keep the default |
| `workers` | **Replaced** as a whole if present |
| `gates` | Replaced if present; if absent, **auto-detected** (see below) |

## `conductor`

| Key | Type | Default | Notes |
|---|---|---|---|
| `agent` | string | `"claude-code"` | One of `claude-code`, `codex`, `gemini`, `opencode`. The conductor is called through the agent's headless CLI, so `openrouter` and `acp` are rejected here. |
| `model` | string | `"opus"` | Passed to the CLI's model flag. `""` means the CLI's own default. |

The conductor never edits files. It is called once to plan the goal (and asked once more if the plan is not valid JSON), then once for each attempt that needs a review. Every call has a 10-minute timeout.

## `workers[]`

| Key | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | Unique. Used in logs, the usage ledger and branch names. |
| `agent` | string | yes | `claude-code`, `codex`, `gemini`, `opencode`, `openrouter` or `acp` |
| `model` | string | no (default `""`) | Model name for that agent, e.g. `sonnet`, `opencode/big-pickle`. For `openrouter`, any value starting with `auto:` picks the cheapest coding-capable model with a context window of at least 64k. |
| `strengths` | string[] | no (default `[]`) | Tags the router matches against task tags, e.g. `refactor`, `bugfix`, `tests`, `docs`, `feature`, `small-edit`. Each match adds 2 points. |
| `transport` | `"auto"` \| `"acp"` \| `"cli"` | no | How to talk to the agent (see below). |

**Order matters.** The router treats earlier workers as stronger and later ones as cheaper. `hard` tasks lean toward the start of the list, `trivial` ones toward the end. See [Architecture → Routing](architecture.md#routing).

### Agents

| `agent` | Headless CLI invocation | ACP command |
|---|---|---|
| `claude-code` | `claude -p <prompt> --output-format stream-json --verbose --permission-mode acceptEdits --add-dir <worktree> [--model M] (--session-id ID \| --resume ID)` | `npx -y @agentclientprotocol/claude-agent-acp@latest` |
| `codex` | `codex exec --json --skip-git-repo-check -C <worktree> -s workspace-write [-m M] <prompt>`; resume: `codex exec resume --json --skip-git-repo-check -c sandbox_mode="workspace-write" [-m M] <id> <prompt>` | `npx -y @agentclientprotocol/codex-acp@latest` |
| `gemini` | `gemini -p <prompt> -o stream-json --approval-mode auto_edit [-m M] [-r latest]` | `gemini --acp` |
| `opencode` | `opencode run --format json --auto --dir <worktree> [-m M] [-s ID] <prompt>` | `opencode acp` |
| `acp` | — | `opencode acp` (generic ACP worker) |
| `openrouter` | HTTPS call to OpenRouter's chat completions API. The model returns a unified diff, which is applied with `git apply`. | — |

### Transports

| Value | Behaviour |
|---|---|
| `cli` | Headless CLI with JSON event streams |
| `acp` | Agent Client Protocol over stdio. File reads and writes requested by the agent are confined to the worktree, and permissions are granted one at a time. |
| `auto` | Try ACP first. If it fails without producing output and without hitting a limit, rerun the same task over the CLI. |

Default: `auto` for `opencode` and `gemini` (native ACP), `cli` for `claude-code` and `codex` (their ACP adapters run through `npx`). The `ORKESTRA_TRANSPORT` environment variable changes the default for workers that do not set `transport`.

## `providers`

| Key | Default | Notes |
|---|---|---|
| `openrouter.apiKeyEnv` | `"OPENROUTER_API_KEY"` | The **name** of the environment variable that holds your OpenRouter key. Keys are never stored in the config file. |

## `gates`

An array of shell commands run in the task's worktree after a worker finishes. Every command must exit with code 0 for the gates to pass. Each command:

- runs through your shell, so pipes and `&&` work (gates come from your own config, which is why a shell is acceptable here);
- gets `CI=1` unless `CI` is already set, so watch-mode test runners exit;
- times out after 10 minutes (`ORKESTRA_GATE_TIMEOUT_MS`).

If `gates` is **omitted**, it is detected from the project root, using the first match:

| Detected file | Gate |
|---|---|
| `package.json` with a `test` script (other than npm's "no test specified" placeholder) | `npm test --silent` |
| `Cargo.toml` | `cargo test -q` |
| `go.mod` | `go test ./...` |
| `pyproject.toml` or `pytest.ini` | `python -m pytest -q` |
| none of the above | no gates: every task goes to conductor review |

Set `"gates": []` to disable gates explicitly.

Worktrees share the main repository's `node_modules`, `.venv` and `venv` through symlinks (junctions on Windows), so gates can run without reinstalling dependencies.

## `budget`

| Key | Default | Notes |
|---|---|---|
| `maxTokensPerTask` | `60000` | Non-cached input + output tokens summed over all attempts of a task. Once reached, no new attempt is started. `0` disables the cap. |
| `maxRetries` | `2` | Extra attempts after the first one, for fix, reassign or merge-conflict retries. Must be ≥ 0. |

## `limits`

| Key | Default | Notes |
|---|---|---|
| `pauseAtPercent` | `95` | A worker counts as blocked when any of its tracked windows is at or above this percentage and has not reset yet. Range 1–100. |
| `resumeDelaySec` | `60` | Extra wait after the reset time before resuming. |
| `allowAccountFailover` | `false` | Reserved. Switching between several subscription accounts is **not implemented** (it may conflict with providers' terms), so this flag has no effect today. |

## `memory`

| Key | Default | Notes |
|---|---|---|
| `dir` | `".orkestra/memory"` | Relative to the project. Holds the markdown memory bank and `facts.db`. `.orkestra/` is added to `.git/info/exclude`, so to version the memory bank, point `dir` somewhere outside `.orkestra/`. |
| `maxInjectTokens` | `1200` | Budget for memory injected into the conductor's plan prompt (about 4 characters per token). |

## Validation errors

Examples of errors reported by `loadConfig`:

```text
orkestra.config.json hatalı:
- conductor.agent geçersiz: openrouter; şef için geçerliler: claude-code, codex, gemini, opencode
- w2: agent geçersiz (kodcu); geçerliler: claude-code, codex, gemini, opencode, openrouter, acp
- yinelenen işçi id'si: w1
- w3: transport geçersiz (ssh); geçerliler: auto, acp, cli
- limits.pauseAtPercent 1-100 arası olmalı
```

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `ORKESTRA_HOME` | `~/.orkestra` | User-level data: resume queue, Claude limits file, worktrees |
| `CODEX_HOME` | `~/.codex` | Where Codex rollout logs are read from (`$CODEX_HOME/sessions`) |
| `ORKESTRA_BIN_CLAUDE_CODE`, `ORKESTRA_BIN_CODEX`, `ORKESTRA_BIN_GEMINI`, `ORKESTRA_BIN_OPENCODE` | `claude`, `codex`, `gemini`, `opencode` | Override the binary for an agent. `ORKESTRA_BIN_OPENCODE` also applies to the `acp` agent and to `models`. |
| `ORKESTRA_TRANSPORT` | per agent | Default transport for workers that do not set `transport` |
| `ORKESTRA_TASK_TIMEOUT_MS` | `1200000` (20 min) | Timeout for a worker run (CLI, ACP and OpenRouter) |
| `ORKESTRA_GATE_TIMEOUT_MS` | `600000` (10 min) | Timeout per gate command |
| `ORKESTRA_TICK_MS` | `30000` | How often `run` checks the resume queue while waiting for a limit reset |
| `ORKESTRA_INPUT` | — | Text for a `-` argument (`run -`, `remember -`, `recall -`). Used by the desktop app and handy for scripts. |
| `OPENROUTER_API_KEY` | — | OpenRouter key (or whatever `providers.openrouter.apiKeyEnv` names) |

Agent processes always get `127.0.0.1`, `localhost` and `::1` appended to `NO_PROXY` / `no_proxy`. This keeps an `HTTP(S)_PROXY` from intercepting an agent's own local server calls (this broke opencode's ACP `session/new`).

## Project files Super Orkestra writes

| Path | Content |
|---|---|
| `.orkestra/usage.jsonl` | Append-only ledger: `plan`, `work`, `review`, `budget`, `paused` events with token usage |
| `.orkestra/memory/*.md` | `project.md`, `decisions.md`, `progress.md`, `conventions.md` |
| `.orkestra/memory/facts.db` | SQLite FTS5 fact store |
| `~/.orkestra/worktrees/<repo>-<hash>/…` | Per-task worktrees (removed after accept or reject) |
| `~/.orkestra/resume-queue.json` | Persistent resume queue (with a `.lock` directory used as a cross-process lock) |
| `~/.orkestra/claude-limits.json` | Last `rate_limits` seen by the Claude statusline hook |
