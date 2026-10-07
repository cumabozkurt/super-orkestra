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
2. The Super Orkestra CLI on your `PATH`: `npm i -g super-orkestra` (Node.js ≥ 22.16). Or set `orkestra.command` to its full path.

The extension is on the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=cumabozkurt.super-orkestra-vscode) and [Open VSX](https://open-vsx.org/extension/cumabozkurt/super-orkestra-vscode) as `cumabozkurt.super-orkestra-vscode`. Each [GitHub release](https://github.com/cumabozkurt/super-orkestra/releases/latest) also carries the `.vsix` for offline installs.

## Settings

| Setting | Default | Description |
|---|---|---|
| `orkestra.command` | `orkestra` | CLI command or full path |

## More

[Documentation](https://github.com/cumabozkurt/super-orkestra/blob/main/docs/vscode-extension.md) · [Issues](https://github.com/cumabozkurt/super-orkestra/issues) · MIT © Cuma Bozkurt
