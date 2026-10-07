# Coding-orchestrator integration research (as of 2026-10-07)

Sources: api.github.com/repos/* (stars, license, latest release), registry.npmjs.org/* (versions), code.visualstudio.com/updates (VS Code 1.140), modelcontextprotocol.io/specification/latest.
Stars fetched 2026-10-07 ~00:40 +03. Dates are UTC release/publish dates.

| # | Project | Repo | Stars | Latest (date) | License | ONE integration technique |
|---|---|---|---|---|---|---|
| 1 | opencode | github.com/anomalyco/opencode (was sst/opencode) | 212,035 | v1.18.35 (2026-10-06); npm `opencode-ai` 1.18.35 | MIT | `opencode serve` HTTP API + JS SDK (also `opencode acp`) |
| 2 | VS Code | github.com/microsoft/vscode | 193,608 | 1.140.0 (2026-09-30); `@types/vscode` 1.140.0 → `engines.vscode: "^1.140.0"` | MIT | Chat Participant + Language Model API (`vscode.chat`, `vscode.lm`) + LM Tools; VS Code 1.140 also runs Claude/Codex/Copilot "harnesses" in an Agent Host process (Agent Host Protocol) |
| 3 | Claude Code | github.com/anthropics/claude-code | 149,622 | v2.1.292 (2026-10-06); npm `@anthropic-ai/claude-code` 2.1.292 | Proprietary (no SPDX) | Claude Agent SDK `query()` (= headless `claude -p --output-format stream-json`); hooks + subagents via settings/`.claude/agents` |
| 4 | OpenAI Codex CLI | github.com/openai/codex | 128,045 | rust-v0.160.1 (2026-10-05); npm `@openai/codex` + `@openai/codex-sdk` 0.160.1 | Apache-2.0 | `@openai/codex-sdk` (wraps `codex exec --json` JSONL) |
| 5 | Gemini CLI | github.com/google-gemini/gemini-cli | 107,244 | v0.63.0 (2026-10-06); npm `@google/gemini-cli` 0.63.0 | Apache-2.0 | Native ACP mode (Zed's reference agent); fallback `gemini -p --output-format stream-json` |
| 6 | Cline | github.com/cline/cline | 69,945 | desktop-v0.0.43 (2026-10-02); npm `cline` CLI 3.0.68 (2026-10-02) | Apache-2.0 | Expose orchestrator as MCP server (Cline is an MCP client); reference for VS Code webview agent UX |
| 7 | Continue | github.com/continuedev/continue | 36,134 | v2.0.0-vscode (2026-06-19); `@continuedev/cli` 1.5.47 | Apache-2.0 | MCP server + config.yaml model/agent blocks |
| 8 | Void (Cursor-like fork) | github.com/voideditor/void | 28,774 | no GitHub releases; last push 2026-06-02 | Apache-2.0 | Avoid forking; extension-only is cheaper (fork = VS Code rebase tax) |
| 9 | Kilo Code | github.com/Kilo-Org/kilocode | 27,510 | v7.8.3 (2026-10-01); npm `@kilocode/cli` 7.8.3 | MIT | MCP server; its CLI is an opencode fork → same `serve`/ACP path |
| 10 | Roo Code | github.com/RooCodeInc/Roo-Code | 24,283 | v3.54.0 (2026-05-15); no push since 2026-05-15 (looks stalled) | Apache-2.0 | MCP server (custom modes); don't depend on it |
| 11 | MCP TypeScript SDK | github.com/modelcontextprotocol/typescript-sdk | 13,527 | npm `@modelcontextprotocol/sdk` 1.32.1 (2026-10-05) | MIT/Apache mix (GitHub: NOASSERTION) | Build the orchestrator's tool surface once as an MCP server (stdio + Streamable HTTP) |
| 12 | MCP spec | github.com/modelcontextprotocol/modelcontextprotocol | 9,396 | Spec **2026-07-28** (latest); extensions: Tasks, MCP Apps, Skills over MCP | NOASSERTION | Target 2026-07-28; use Tasks extension for long-running sub-agent jobs |
| 13 | Agent Client Protocol (ACP) | github.com/agentclientprotocol/agent-client-protocol (was zed-industries/…) | 4,381 | schema-v1.24.1 (2026-09-30); npm `@agentclientprotocol/sdk` 1.7.0 (2026-10-02) | Apache-2.0 | Speak ACP client-side to drive every agent uniformly (JSON-RPC over stdio) |
| 14 | claude-agent-acp | github.com/agentclientprotocol/claude-agent-acp | (not fetched – rate limit) | npm `@agentclientprotocol/claude-agent-acp` 0.86.0 (2026-10-05) | (not checked) | ACP adapter for Claude Code (old `@zed-industries/claude-code-acp` frozen at 0.16.2) |
| 15 | codex-acp | github.com/agentclientprotocol/codex-acp | (not fetched) | npm `@agentclientprotocol/codex-acp` 2.1.1 (2026-10-01) | (not checked) | ACP adapter for Codex (old `@zed-industries/codex-acp` frozen at 0.16.0) |
| + | Claude Agent SDK (TS) | github.com/anthropics/claude-agent-sdk-typescript | 1,784 | npm `@anthropic-ai/claude-agent-sdk` 0.3.292 (2026-10-06) | none on GitHub (Anthropic terms) | In-process hooks, subagents, permission callbacks, custom MCP tools |
| + | Qwen Code (Gemini CLI fork) | github.com/QwenLM/qwen-code | (not fetched) | npm `@qwen-code/qwen-code` 0.25.0 (2026-10-05) | (not checked) | Same as Gemini CLI (ACP) |

## Recommendation (5 lines)
1. Build one headless TypeScript core whose only agent interface is an **ACP client** (`@agentclientprotocol/sdk` 1.7.0): Gemini CLI/Qwen and opencode/Kilo speak ACP natively, Claude Code and Codex via the official `claude-agent-acp` / `codex-acp` adapters.
2. Expose the orchestrator itself as an **MCP server** (`@modelcontextprotocol/sdk` 1.32.x, spec 2026-07-28, Tasks extension) so Claude Code, Codex, Gemini, Cline, Continue, Kilo and VS Code Copilot can all call it as tools, with no per-tool plugin.
3. The **VS Code extension** (`engines.vscode ^1.140.0`) is a thin shell: a Chat Participant + `vscode.lm` for model access, register the MCP server via the MCP server definition provider, and render ACP session updates (diffs, permissions, plans) in chat/webview.
4. Keep a **stream-json fallback** adapter only where ACP lags (`claude -p --output-format stream-json`, `codex exec --json`, `gemini -p --output-format stream-json`); use the Claude Agent SDK directly only if you need in-process hooks/subagents.
5. Don't fork VS Code (Void went quiet; Roo Code stalled since May 2026); watch VS Code's Agent Host Protocol (1.140 runs Claude/Codex harnesses) as a possible future second integration point.

## Caveats
- GitHub unauthenticated rate limit hit mid-run; stars for claude-agent-acp, codex-acp, qwen-code not fetched.
- The exact CLI flags (stream-json, `codex exec --json`, `opencode serve/acp`, Gemini ACP mode) come from pre-May-2026 knowledge and package names; I did not re-open their docs this run. Check `--help` on current versions before relying on them.
- VS Code LM/Chat Participant APIs are stable (finalized 2024); the 1.140 notes add no changes to them. Agent Host Protocol is new and its public extension API status was not verified.
