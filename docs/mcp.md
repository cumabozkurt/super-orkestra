# MCP server

`super-orkestra mcp` runs a [Model Context Protocol](https://modelcontextprotocol.io) server over **stdio**. Any MCP client, such as Claude Code, Codex, VS Code agent mode or Cline, can then hand whole goals to Super Orkestra or use its memory and repo map.

The server uses the directory it is started in as the project, so start it in your project root. The VS Code extension sets this up for you.

## Tools

| Tool | Input | Returns |
|---|---|---|
| `orkestra_delegate` | `{ goal: string }` | Runs the full conductor loop for the goal and returns the per-task result map as JSON, e.g. `{"t1":"done"}` |
| `memory_recall` | `{ query: string, maxTokens?: number }` | Relevant project memory (conventions plus matching facts), 1500 tokens by default |
| `memory_remember` | `{ text: string, tags?: string[] }` | Stores a persistent fact |
| `repo_map` | `{}` | The ranked, signature-level repo map (1500 tokens) |
| `limits_status` | `{}` | Current subscription limit windows as JSON |

`orkestra_delegate` is a long-running call: it lasts as long as the agents need.

## Registering the server

**Claude Code**

```bash
claude mcp add super-orkestra -- super-orkestra mcp
```

**Codex CLI**

```bash
codex mcp add super-orkestra -- super-orkestra mcp
```

**VS Code:** install the [extension](vscode-extension.md). It registers the server automatically through `mcpServerDefinitionProviders` and starts it in the first workspace folder.

**Other clients:** add a stdio server whose command is `super-orkestra` with args `["mcp"]`, and whose working directory is your project. For example, in the common `mcpServers` JSON format:

```json
{
  "mcpServers": {
    "super-orkestra": { "command": "super-orkestra", "args": ["mcp"] }
  }
}
```

## Notes

- The server does not print progress output on stdout, since stdout is reserved for the protocol. Results arrive when the tool call finishes.
- `node:sqlite` experimental warnings are filtered so they cannot corrupt the stdio stream.
- Paused tasks (all workers limited) go into the global resume queue as usual. Once that happens, the MCP server process also checks the queue every 30 seconds while it is running. Run `super-orkestra resume-daemon` if resumes should continue after the MCP client has closed.
