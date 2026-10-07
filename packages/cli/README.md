# super-orkestra

The **Super Orkestra** CLI. Your strongest model becomes the conductor: it plans the work and reviews the results. Up to three worker models of your choice (Claude Code, Codex, Gemini CLI, opencode, OpenRouter) do the coding, each in its own git worktree. Test gates decide when the conductor needs to look. When a subscription limit is hit, work is handed off, or resumed in the same session after the reset.

*Türkçe:* En güçlü model şef olur (plan + denetim), altında seçtiğin işçi modeller kendi git worktree'lerinde çalışır. En az token ve abonelik limiti harcayarak en kaliteli sonucu hedefler. → [README.tr.md](https://github.com/cumabozkurt/super-orkestra/blob/main/README.tr.md)

Requires **Node.js ≥ 22.16**, git, and at least one logged-in agent CLI.

## Install

The package is not on npm yet. Install it from source:

```bash
git clone https://github.com/cumabozkurt/super-orkestra.git && cd super-orkestra
npm install && npm run build && npm link -w super-orkestra
```

Once published, `npm i -g super-orkestra` will do the same.

## Use

```bash
cd my-project
super-orkestra run "add 2FA to the login page and write tests for it"
super-orkestra limits      # 5-hour / weekly limits
super-orkestra usage       # token + cache usage
super-orkestra mcp         # MCP server: claude mcp add super-orkestra -- super-orkestra mcp
```

`orkestra` is a short alias for the same command. Live Claude limits: set `"statusLine": { "type": "command", "command": "super-orkestra statusline" }` in `~/.claude/settings.json`.

## Documentation

- [Getting started](https://github.com/cumabozkurt/super-orkestra/blob/main/docs/getting-started.md)
- [CLI reference](https://github.com/cumabozkurt/super-orkestra/blob/main/docs/cli.md)
- [Configuration](https://github.com/cumabozkurt/super-orkestra/blob/main/docs/configuration.md)
- [MCP server](https://github.com/cumabozkurt/super-orkestra/blob/main/docs/mcp.md)

## License

MIT © Cuma Bozkurt
