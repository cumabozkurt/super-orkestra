# Getting started

This guide takes you from zero to your first orchestrated change.

> [!NOTE]
> Super Orkestra **v1.0.0** is on [GitHub Releases](https://github.com/cumabozkurt/super-orkestra/releases/latest). It is not on the npm registry yet, so step 2 installs the CLI from the release tarballs (or from source).

## 1. Prerequisites

| Requirement | Why |
|---|---|
| **Node.js ≥ 22.16** | The memory layer uses the built-in `node:sqlite` with **FTS5**. FTS5 first shipped in Node 22.16.0, so Node 22.13–22.15 fail with `no such module: fts5`. |
| **git** | Each task runs in its own git worktree. Merging, diffs and the repo map rely on git. |
| **At least one agent CLI**, logged in | Workers and the conductor drive these CLIs headlessly with your existing subscription login. |

Install the agent CLIs you plan to use:

```bash
npm i -g @anthropic-ai/claude-code   # Claude Code  -> agent "claude-code"
npm i -g @openai/codex               # Codex CLI    -> agent "codex"
npm i -g @google/gemini-cli          # Gemini CLI   -> agent "gemini"
npm i -g opencode-ai                 # opencode     -> agent "opencode" (has free models)
```

Run each CLI once interactively to log in.

## 2. Install Super Orkestra

### From the v1.0.0 release (recommended)

The CLI tarball depends on the core tarball, so pass **both URLs in one command**:

```bash
npm i -g https://github.com/cumabozkurt/super-orkestra/releases/download/v1.0.0/super-orkestra-core-1.0.0.tgz \
         https://github.com/cumabozkurt/super-orkestra/releases/download/v1.0.0/super-orkestra-1.0.0.tgz
super-orkestra --version   # 1.0.0
```

The release also has the VS Code extension (`.vsix`) and desktop installers. See [VS Code extension](vscode-extension.md) and [Desktop app](desktop-app.md).

### From source

```bash
git clone https://github.com/cumabozkurt/super-orkestra.git
cd super-orkestra
npm install
npm run build              # builds core first, then the CLI, VS Code extension and desktop frontend
npm link -w super-orkestra # exposes `super-orkestra` and the short alias `orkestra`
super-orkestra --version
```

## 3. Your first run

Super Orkestra works inside a **git repository with at least one commit**. Without one, workers run in the folder directly and are not isolated.

```bash
cd ~/code/my-project
super-orkestra run "the add() helper in src/math.js subtracts; make it add and cover it with a test"
```

Typical output (the CLI prints in Turkish):

```text
📋 Plan: 1 görev
   t1 [small] Fix add() in src/math.js and add a test
→ t1 → w2 ()
🧪 t1 kapılar: geçti
✅ t1 (w2)
Sonuç: {"t1":"done"}
Token: {"byWorker":{"w2":{"runs":1,"input":2000,"output":80,"cacheRead":1500}},"conductor":{...}}
```

| Symbol | Meaning |
|---|---|
| 📋 | The conductor's plan (at most 3 tasks) |
| → | A task assigned to a worker (`deneme N` = attempt N) |
| 🧪 | Gate result (`geçti` = passed, `KALDI` = failed) |
| 🔎 | Conductor review verdict (only when needed) |
| ↪ | Hand-off to another worker because of a limit |
| ⏸ | Paused until a limit resets. Resumes automatically |
| ✅ / ❌ | Task done / failed |

Accepted work is merged into the branch you have checked out, as a `--no-ff` merge commit (`orkestra: <task id>: <goal>`). Review the result with `git log` / `git diff HEAD~1` as usual.

## 4. Pick your conductor and workers

Copy the example configuration into your project and edit it:

```bash
cp /path/to/super-orkestra/orkestra.config.example.json ./orkestra.config.json
```

Put workers in order from **strongest to cheapest**. The router sends hard tasks to the front of the list and trivial ones to the back. See [Configuration](configuration.md) for every field.

> `orkestra.config.json` and `.orkestra/` are in this repository's `.gitignore`. In *your* project, Super Orkestra adds `.orkestra/` to `.git/info/exclude` automatically. Commit `orkestra.config.json` if you want to share it with your team.

## 5. Free trial without any login

opencode offers free models that need no account. [`examples/free-opencode.config.json`](../examples/free-opencode.config.json) uses them for the conductor and all workers:

```bash
cp /path/to/super-orkestra/examples/free-opencode.config.json ./orkestra.config.json
super-orkestra models --free      # see which free models opencode offers right now
super-orkestra run "..."
```

The example sets `"gates": ["node --test"]`. Change it to your project's test command.

## 6. Make limits visible (optional but recommended)

- **Claude Code:** add the statusline hook to `~/.claude/settings.json` so Super Orkestra can read your 5-hour and weekly usage:
  ```json
  { "statusLine": { "type": "command", "command": "super-orkestra statusline" } }
  ```
- **Codex:** nothing to do. Limits are read from `~/.codex/sessions/**/rollout-*.jsonl` (or `$CODEX_HOME/sessions`).

Check the result with `super-orkestra limits`.

## 7. Long-running work and limits

If every worker hits its limit, `run` keeps the process alive and resumes when the earliest limit resets. You can also press Ctrl+C and keep a resume daemon running instead:

```bash
super-orkestra resume-daemon   # resumes queued tasks from all projects
```

## Next steps

- Use it from your editor or another agent via [MCP](mcp.md) or the [VS Code extension](vscode-extension.md).
- Learn how the loop works in [Architecture](architecture.md).
- Something off? See the [FAQ](faq.md).
