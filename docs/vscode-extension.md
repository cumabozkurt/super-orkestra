# VS Code extension

`packages/vscode` is a thin extension. All the logic stays in the CLI, so the extension only spawns `orkestra` and adds three things to VS Code:

1. **`@orkestra` chat participant** in the Chat view (Copilot Chat panel).
2. **MCP server registration**: Super Orkestra's MCP server shows up for VS Code agent mode and other MCP consumers, started in your workspace folder.
3. **Status bar item** showing limit percentages per agent, refreshed every 60 seconds. Click it to see the raw limit JSON.

## Requirements

- VS Code **1.140** or newer (`engines.vscode: ^1.140.0`) with chat enabled. The chat participant needs a chat provider such as GitHub Copilot Chat.
- The Super Orkestra CLI on your `PATH` (see [Getting started](getting-started.md)), or the full path set in `orkestra.command`.

## Install

The extension ID is `cumabozkurt.super-orkestra-vscode`.

- **VS Code:** install it from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=cumabozkurt.super-orkestra-vscode), search *Super Orkestra* in the Extensions view, or run:
  ```bash
  code --install-extension cumabozkurt.super-orkestra-vscode
  ```
- **VSCodium, Cursor, Windsurf and other Open VSX editors:** install it from [Open VSX](https://open-vsx.org/extension/cumabozkurt/super-orkestra-vscode).
- **Offline:** every [GitHub release](https://github.com/cumabozkurt/super-orkestra/releases/latest) carries `super-orkestra-vscode-<version>.vsix`: `code --install-extension super-orkestra-vscode-<version>.vsix`, or Extensions view → `…` → **Install from VSIX…**.

Or build the `.vsix` from source:

```bash
npm install
npm run build
npm run package:vscode      # -> packages/vscode/super-orkestra-vscode-<version>.vsix
code --install-extension packages/vscode/super-orkestra-vscode-*.vsix
```

You can also use the Extensions view → `…` → **Install from VSIX…**.

## Usage

| Where | What | Runs |
|---|---|---|
| Chat | `@orkestra <goal>` | `orkestra run -`, with the goal sent on stdin and output streamed into the chat |
| Chat | `@orkestra /limits` | `orkestra limits` |
| Chat | `@orkestra /usage` | `orkestra usage` |
| Chat | `@orkestra /recall <query>` | `orkestra recall -`, with the query sent on stdin |
| Command Palette | **Super Orkestra: Şefe iş ver** (`orkestra.run`) | Asks for a goal, runs it with progress and cancellation, and streams to the "Orkestra" output channel |
| Command Palette | **Super Orkestra: Limit durumu** (`orkestra.limits`) | Shows the limit JSON in a notification |

All commands run in the **first workspace folder**. Cancelling a chat request or the progress notification kills the CLI process.

## Settings

| Setting | Default | Description |
|---|---|---|
| `orkestra.command` | `"orkestra"` | CLI command or full path, e.g. `/usr/local/bin/super-orkestra` or `C:\Users\me\AppData\Roaming\npm\orkestra.cmd` |

## How text is passed safely

User text (goals, recall queries) is never placed on the command line. It is written to the CLI's **stdin** and the CLI is called with `-`. On Windows the CLI is a `.cmd` shim, so the extension starts it through the shell with fixed arguments only. A configured path that contains spaces is quoted.

## Development

```bash
npm run build -w super-orkestra-vscode   # tsc -> packages/vscode/dist/extension.js
```

Open the repository in VS Code and launch an **Extension Development Host** with `packages/vscode` as the extension folder (`code --extensionDevelopmentPath=packages/vscode`). The package has no runtime dependencies, which is why it is packaged with `vsce package --no-dependencies`.

## Publishing (maintainers)

`release.yml` builds the `.vsix` on every `v*` tag. It publishes to the Marketplace if the `VSCE_PAT` secret is set, and to Open VSX if `OVSX_PAT` is set. The extension ID is `cumabozkurt.super-orkestra-vscode`; it is published under the `cumabozkurt` publisher (Marketplace) and namespace (Open VSX).
