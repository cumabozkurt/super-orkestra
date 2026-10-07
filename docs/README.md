# Super Orkestra documentation

| Page | What you will find |
|---|---|
| [Getting started](getting-started.md) | Install from the v1.0.0 release or from source, the first run, a free no-login trial, and what to expect on screen |
| [Configuration](configuration.md) | Every `orkestra.config.json` field, worker transports, gates, and environment variables |
| [Architecture](architecture.md) | Conductor/worker loop, routing, review triggers, limits and resume, memory, repo map, on-disk layout |
| [CLI reference](cli.md) | All `super-orkestra` commands with options and examples |
| [MCP server](mcp.md) | Using Super Orkestra from Claude Code, Codex, VS Code and other MCP clients |
| [VS Code extension](vscode-extension.md) | `@orkestra` chat participant, MCP registration, status bar, building the `.vsix` |
| [Desktop app](desktop-app.md) | The Tauri 2 app: features, development, building installers, permission model |
| [FAQ and troubleshooting](faq.md) | Common questions and fixes |

Also see the repository-level [CONTRIBUTING](../CONTRIBUTING.md), [SECURITY](../SECURITY.md) and [CHANGELOG](../CHANGELOG.md).

## Research reports

The design draws on a survey of nearly 60 open-source projects. The raw reports are kept for reference. They are snapshots from 2026-10-07, so star counts and versions change over time.

- [Multi-agent coding orchestrators: reference repos](research/orchestrator-repo-research.md)
- [Integration techniques (MCP, ACP, VS Code, agent CLIs)](research/orchestrator-integration-research-2026-10.md)
- [Desktop GUI and subscription-limit tracking / auto-resume](research/orchestrator-gui-limits-research.md)
- [Memory and token-minimization stack](research/memory-token-stack-research-2026-10-07.md)
