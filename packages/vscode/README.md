# Super Orkestra for VS Code

Your strongest model conducts and up to three worker models write the code, each in its own git worktree, with test gates and automatic resume after subscription limits. This extension brings [Super Orkestra](https://github.com/cumabozkurt/super-orkestra) into VS Code.

*Türkçe:* Şef model + işçi modeller: en az token ve limitle en kaliteli kod. Sohbette `@orkestra <görev>`.

## Features

- **`@orkestra` chat participant.** Give it a goal, and the plan, assignments, gate results and reviews stream into the chat. Slash commands: `/limits`, `/usage`, `/recall <query>`.
- **MCP server, registered automatically.** Super Orkestra's tools (`orkestra_delegate`, `memory_recall`, `memory_remember`, `repo_map`, `limits_status`) become available to VS Code agent mode, started in your workspace folder.
- **Status bar.** Live limit percentages per agent. Click for details.
- **Commands.** *Super Orkestra: Şefe iş ver* (run a goal with progress and cancellation) and *Super Orkestra: Limit durumu* (show limits).

## Requirements

1. VS Code 1.140+ with a chat provider (e.g. GitHub Copilot Chat) for the chat participant.
2. The Super Orkestra CLI on your `PATH`. It is not on npm yet, so install from source: `git clone https://github.com/cumabozkurt/super-orkestra.git && cd super-orkestra && npm install && npm run build && npm link -w super-orkestra`

## Settings

| Setting | Default | Description |
|---|---|---|
| `orkestra.command` | `orkestra` | CLI command or full path |

## More

[Documentation](https://github.com/cumabozkurt/super-orkestra/blob/main/docs/vscode-extension.md) · [Issues](https://github.com/cumabozkurt/super-orkestra/issues) · MIT © Cuma Bozkurt
