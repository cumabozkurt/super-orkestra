# Orchestrator research: desktop GUI + subscription limit tracking / auto-resume
Data pulled 2026-10-07 (~00:45 TRT). Stars/release: api.github.com (first 7 rows) and ungh.cc mirror of GitHub API (rest, GitHub anon rate limit hit). Tauri stable from crates.io API. License: LICENSE file fetched unless marked `?` (from memory, not verified). Lang marked `~` = from memory.

## A. Desktop frameworks + agent GUIs
| Repo | ★ | Latest release (date) | License | Lang | Key technique |
|---|---|---|---|---|---|
| [tauri-apps/tauri](https://github.com/tauri-apps/tauri) | 111.6k | **stable 2.12.1** (2026-09-30); v3.0.0-alpha.4 (2026-10-01) | Apache-2.0/MIT | Rust | OS webview + Rust core, ~5–10 MB bundles; sidecar/shell plugin to spawn `claude`/`codex` CLIs |
| [electron/electron](https://github.com/electron/electron) | 123.4k | v44.5.1 (2026-09-30) | MIT | C++ | Bundled Chromium+Node; `node-pty` + xterm.js for real PTY CLIs (most mature on Windows) |
| [getAsterisk/opcode](https://github.com/getAsterisk/opcode) (ex-Claudia; now winfunc/opcode) | 22.4k | v0.2.0 (2025-08-31) | AGPL-3.0 | TS+Rust~ | Tauri 2 GUI that reads `~/.claude/projects/**/*.jsonl` for session browser, usage dashboard, checkpoints |
| [steipete/CodexBar](https://github.com/steipete/CodexBar) | 22.2k | no GH release obj | MIT | Swift~ | macOS menubar: Codex+Claude 5h/weekly % and reset timers, no login (reads local CLI state/OAuth usage) |
| [BloopAI/vibe-kanban](https://github.com/BloopAI/vibe-kanban) | 28.3k | v0.1.44 (2026-04-24) | Apache-2.0 | Rust | Kanban; each task = agent run (Claude/Codex/Gemini…) in its own git worktree, served as local web UI (`npx vibe-kanban`) |
| [siteboon/claudecodeui](https://github.com/siteboon/claudecodeui) | 14.0k | v1.37.3 (2026-09-08) | AGPL-3.0 | TS | Node server + web/mobile UI wrapping Claude Code/Codex CLI; session list from `~/.claude/projects` |
| [smtg-ai/claude-squad](https://github.com/smtg-ai/claude-squad) | 8.6k | v1.0.20 (2026-08-20) | AGPL-3.0? | Go~ | TUI: tmux session + git worktree per agent, pause/resume |
| [Dimillian/CodexMonitor](https://github.com/Dimillian/CodexMonitor) | 4.3k | v0.7.67 (2026-03-24) | MIT | TS+Rust~ (Tauri) | Drives `codex app-server` (JSON-RPC) per workspace; shows threads + rate limits from `account/rateLimits` |
| [stravu/crystal](https://github.com/stravu/crystal) | 3.1k | v0.3.5 (2026-02-27) — stale, successor Nimbalyst | MIT | TS (Electron) | Parallel Claude/Codex sessions in worktrees, diff/commit UI |
| [nimbalyst/nimbalyst](https://github.com/nimbalyst/nimbalyst) | 1.8k | v0.79.1 (2026-09-30) | MIT | TS (Electron) | Crystal successor: visual workspace + agent sessions |
Conductor (conductor.build) is closed-source (macOS only) → not a repo option.

## B. Usage / limit / failover tooling
| Repo | ★ | Latest release (date) | License | Lang | Key technique |
|---|---|---|---|---|---|
| [musistudio/claude-code-router](https://github.com/musistudio/claude-code-router) | 37.6k | v3.1.1 (2026-09-16) | MIT | TS~ | Local proxy (`ANTHROPIC_BASE_URL`) routing Claude Code to other providers/models by rule (fallback) |
| [ryoppippi/ccusage](https://github.com/ryoppippi/ccusage) | 18.9k | v20.0.26 (2026-09-27) | MIT? | TS | Parse `~/.claude/projects/**/*.jsonl` (+`@ccusage/codex` for `~/.codex/sessions`); daily/monthly/**5h blocks** reports, statusline cmd |
| [sirmalloc/ccstatusline](https://github.com/sirmalloc/ccstatusline) | 13.2k | v2.2.30 (2026-09-17) | MIT | TS~ | Statusline reading stdin JSON incl. `rate_limits.five_hour/seven_day` |
| [Wei-Shaw/claude-relay-service](https://github.com/Wei-Shaw/claude-relay-service) | 12.7k | — | MIT | JS~ | Self-hosted relay pooling multiple Claude/Codex/Gemini OAuth accounts, auto-switch on 429/limit |
| [Maciek-roboblog/Claude-Code-Usage-Monitor](https://github.com/Maciek-roboblog/Claude-Code-Usage-Monitor) | 8.7k | — (PyPI releases) | MIT | Python~ | Real-time TUI: JSONL tokens vs plan limit, burn rate, P90 limit estimate, predicted exhaustion before reset |
| [1rgs/claude-code-proxy](https://github.com/1rgs/claude-code-proxy) | 3.8k | — | none found | Python~ | LiteLLM proxy translating Anthropic API → OpenAI/Gemini |
| [Haleclipse/CCometixLine](https://github.com/Haleclipse/CCometixLine) | 3.5k | v1.1.2 (2026-03-14) | ? | Rust~ | Fast Rust statusline (git, model, usage) |
| [snipeship/ccflare](https://github.com/snipeship/ccflare) → [tombii/better-ccflare](https://github.com/tombii/better-ccflare) | 1.05k / 271 | — / v3.5.92 (2026-10-06) | MIT | TS~ | Proxy with N Claude accounts, load-balance + failover when one is rate-limited; dashboard tracks per-account reset |
| [terryso/claude-auto-resume](https://github.com/terryso/claude-auto-resume) | 822 | — | MIT | Shell | Run `claude -p check`, regex `Claude AI usage limit reached\|<epoch>`, sleep with countdown, then `claude -c --dangerously-skip-permissions -p "<prompt>"`; .ps1 for Windows |
Codex-specific extras: xiangz19/codex-ratelimit, m4fn3/Codex-Usage-Tracker (read last `token_count.rate_limits` from rollout JSONL).

## C. How CLIs report limits & resume
**Claude Code**
- Limits: statusline stdin JSON (since v2.1.80) `rate_limits.five_hour|seven_day.{used_percentage, resets_at(epoch s)}` (+`spend_limit` behind gateway) — https://code.claude.com/docs/en/statusline. Absent on API-key auth and before first response; occasional regressions (issue #45133). `/usage` shows session/week. Undocumented: `GET /api/oauth/usage`, `~/.claude.json cachedUsageUtilization`. Error text historically `Claude AI usage limit reached|<epoch>`; newer TUIs show "limit reached ∙ resets <time>" — parse both.
- Resume: `claude -c/--continue` (latest in cwd; with `-p` includes -p/SDK sessions), `claude -r/--resume <id|name|path.jsonl> "prompt"`, `--session-id <uuid>` (pin ID up front), `--fork-session`, `-n/--name`, `-p --output-format stream-json` for headless; `claude --bg` + `claude respawn <id>` for background sessions — https://code.claude.com/docs/en/cli-reference. Transcripts: `~/.claude/projects/<cwd-slug>/<session>.jsonl`.

**Codex CLI**
- Limits: rollout `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`, `event_msg` `token_count.rate_limits.{primary(300 min), secondary(10080 min)}.{used_percent, window_minutes, resets_at|resets_in_seconds}`, `plan_type`. Often `null` in `codex exec` (issues #14728, #14880). Reliable: app-server JSON-RPC `account/rateLimits/read` (`usedPercent, windowDurationMins, resetsAt`, credits), HTTP headers `x-codex-primary-used-percent/-window-minutes/-reset-at`, backend `/api/codex/usage` (`/wham/usage`) with `~/.codex/auth.json` token. Classify window by duration, not slot. `/status`, `/usage` in TUI.
- Resume: `codex resume [<id>] | --last | --all`; headless `codex exec resume --last|<id> "prompt"`; `codex exec --json` streams events — https://developers.openai.com/codex/cli/slash-commands.

## D. Recommendation
1. GUI: Tauri 2.12.x (stable; skip v3 alpha) + React/TS + xterm.js; Rust side owns PTYs (portable-pty) and worktrees — small, cross-platform; pick Electron only if Windows PTY/webview quirks bite.
2. Run agents headless with structured output: `claude -p --output-format stream-json --session-id <uuid>` and `codex app-server`/`codex exec --json`, so the orchestrator owns session IDs.
3. Limit tracking, layered: Claude statusline hook writes `rate_limits` to a file per session + Codex `account/rateLimits/read`; fallback = ccusage-style JSONL parsing (5h blocks) and rollout `token_count`.
4. On limit (≥95% or error regex/429): persist task state, schedule a job at `resets_at`+60 s, then `claude -r <uuid> -p "continue"` / `codex exec resume <id> "continue"`; survive app restart & sleep (persisted scheduler).
5. Optional failover per task: next account/provider (ccflare/relay-style pool or claude-code-router), with user opt-in and ToS caution on account pooling.
