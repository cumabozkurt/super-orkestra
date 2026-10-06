# Multi-agent coding orchestrator — reference repos (data as of 2026-10-07, GitHub API)

| # | Repo | ★ | Latest release | License | Lang | Technique to steal |
|---|------|---|---|---|---|---|
| 1 | [anomalyco/opencode](https://github.com/anomalyco/opencode) (ex sst/opencode) | 212,035 | v1.18.35 · 2026-10-06 | MIT | TS | Provider-agnostic agent core (75+ providers via models.dev, incl. Claude/ChatGPT subscription auth) + primary/subagent split with per-agent model & tool perms |
| 2 | [OpenHands/OpenHands](https://github.com/OpenHands/OpenHands) | 90,119 | v1.25.0 · 2026-10-06 | MIT | TS/Py | New **Model Router** (cheap classifier LLM picks model per prompt, "Router Pro/Flash") + child conversations / delegation tools; event-stream with condenser |
| 3 | [ruvnet/ruflo](https://github.com/ruvnet/ruflo) (ex claude-flow) | 74,002 | v3.53.0 · 2026-10-06 | MIT | TS | Queen/worker "hive-mind" swarm topologies + shared memory over MCP |
| 4 | [code-yeongyu/oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent) (ex oh-my-opencode) | 69,845 | v5.1.21 · 2026-10-06 | custom (NOASSERTION) | TS | Orchestrator agent ("Sisyphus") delegating to specialist subagents each pinned to a different model/provider; background parallel agents; todo-continuation enforcer |
| 5 | [microsoft/autogen](https://github.com/microsoft/autogen) | 61,271 | not checked (last push 2026-04) | CC-BY-4.0 / MIT code | Py | Magentic-One: Orchestrator with Task Ledger + Progress Ledger, re-plans when stalled (stall counter) |
| 6 | [BerriAI/litellm](https://github.com/BerriAI/litellm) | 60,240 | v1.104.0 · 2026-10-04 | MIT core + enterprise (NOASSERTION) | Py | Unified OpenAI-format gateway: fallbacks, retries, budgets, cost tracking per key/model |
| 7 | [crewAIInc/crewAI](https://github.com/crewAIInc/crewAI) | 59,353 | 1.15.23 · 2026-09-28 | MIT | Py | Hierarchical process: manager LLM delegates & validates task outputs |
| 8 | [Aider-AI/aider](https://github.com/Aider-AI/aider) | 49,381 | v0.86.0 · 2025-08-09 (stale) | Apache-2.0 | Py | **Architect/editor split** (strong model plans, cheap model emits diffs) + tree-sitter **repo map** for minimal context |
| 9 | [langchain-ai/langgraph](https://github.com/langchain-ai/langgraph) | 42,731 | not checked (active, 2026-10-05) | MIT | Py | Supervisor graph w/ handoff tools, checkpointing, interrupt/human-in-loop |
| 10 | [wshobson/agents](https://github.com/wshobson/agents) | 40,248 | no releases | MIT | Py/MD | Library of specialist subagent prompts with per-agent model tier (opus/sonnet/haiku) assignment |
| 11 | [musistudio/claude-code-router](https://github.com/musistudio/claude-code-router) | 37,570 | v3.1.1 · 2026-09-16 | MIT | TS | Scenario routing proxy: default / background / think / longContext / webSearch → different provider+model; transformers per provider |
| 12 | [openai/openai-agents-python](https://github.com/openai/openai-agents-python) | 29,835 | v0.23.1 · 2026-10-02 | MIT | Py | Handoffs + agents-as-tools + guardrails (tripwire checks run in parallel with cheap model) |
| 13 | [SuperClaude-Org/SuperClaude_Framework](https://github.com/SuperClaude-Org/SuperClaude_Framework) | 23,909 | v4.3.0 · 2026-03-22 | MIT | Py | Token-efficiency mode (symbol-compressed comms) + persona/command presets |
| 14 | [BeehiveInnovations/pal-mcp-server](https://github.com/BeehiveInnovations/pal-mcp-server) (ex zen-mcp) | 11,770 | not checked (last push 2025-12) | custom (NOASSERTION) | Py | MCP tool letting the main agent consult/"consensus" other models with continuation_id context threading |
| 15 | [lm-sys/RouteLLM](https://github.com/lm-sys/RouteLLM) | 5,573 | none (inactive since 2024-08) | Apache-2.0 | Py | Trained strong/weak router (matrix-factorization / BERT classifier) with cost threshold — ~same quality at large cost cut |

Also checked: smtg-ai/claude-squad 8,573★ AGPL-3.0 Go (tmux + git-worktree isolation per agent); anthropics/claude-agent-sdk-python 8,218★ MIT, v0.2.163 · 2026-09-30 (programmatic subagents, hooks, uses Claude Code subscription auth); BloopAI/vibe-kanban 28,269★ Apache-2.0 Rust, v0.1.44 · 2026-04-24 — **README now carries a sunsetting notice**; OpenRouterTeam/typescript-sdk 259★ Apache-2.0, v1.4.25 · 2026-10-06 (low stars; use OpenRouter's OpenAI-compatible API via LiteLLM instead).

## Recommendation (router + 3 workers, lowest tokens)
1. Build on opencode's provider layer (or LiteLLM as the single gateway) so router and workers are just `provider/model` strings — covers Claude/ChatGPT subscriptions, OpenRouter, opencode providers.
2. Router = strongest model, but it only plans and reviews: Aider-style architect/editor split + Magentic-One Task/Progress ledgers; it never reads full files, only a repo map + worker diffs/test results.
3. Workers (3 configurable) run in isolated git worktrees (claude-squad pattern) with narrow, self-contained task briefs; cheap-classifier pre-routing (RouteLLM / OpenHands Model Router idea) picks which worker tier gets each task.
4. Monitoring is event-driven, not polling: tests/lint/typecheck as hard gates, router is woken only on failure, stall-counter, or diff-size anomaly (intervene = re-brief or reassign).
5. Token discipline: cached static system prompts, compressed handoff summaries instead of transcripts, context condensation per worker, and per-task budget caps enforced at the gateway.
