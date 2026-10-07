# FAQ and troubleshooting

## General

**Does Super Orkestra need API keys?**
No. Claude Code, Codex, Gemini CLI and opencode workers use the logins those CLIs already have, including subscription plans. Only `openrouter` workers need a key, read from the environment variable named in `providers.openrouter.apiKeyEnv` (default `OPENROUTER_API_KEY`).

**How does it save tokens?**
- The conductor has no tools and reads no files. It sees a 1500-token repo map, budgeted memory, and at most 4000 characters of diff and 3000 of gate log during reviews.
- If the gates pass and nothing looks suspicious, the conductor is not called again for that task.
- Workers get a short brief instead of a transcript.
- Fixes go back to the same worker.
- Resuming after a limit reuses the same session (warm cache) instead of starting over.
- `budget.maxTokensPerTask` caps runaway retries.

**Will it touch my working tree?**
Only through merges. Each task runs in a separate worktree under `~/.orkestra/worktrees/`, and accepted changes are merged into your current branch with `--no-ff`. Commit or stash your own work before a run, because a merge into a dirty tree can conflict. Exceptions: when the folder is not a git repository, or has no commits, workers run directly in it.

**Can I undo what it did?**
Each accepted task is a merge commit (`orkestra: <task id>: <goal>`), so `git revert -m 1 <commit>` or `git reset` work as usual.

**Can workers run in parallel?**
Not yet. The tasks of a plan run one after another. Plans are small (at most 3 tasks) by design.

**Which languages does the repo map support?**
tree-sitter definitions for TypeScript, TSX, JavaScript, Python, Go, Rust, Java, C#, Ruby, PHP, C and C++. Kotlin, Swift and anything whose grammar fails to load use a regex fallback.

**Why is the output in Turkish?**
The project started in Turkish. An English output option is on the [roadmap](../README.md#roadmap), and contributions are welcome.

## Troubleshooting

**`no such module: fts5` or "Bu Node.js sürümünün … FTS5 yok"**
Your Node.js is older than 22.16. Node 22.13–22.15 ship `node:sqlite` without FTS5. Upgrade to Node 22.16+ or 24.

**`Şef geçerli JSON döndürmedi` (the conductor did not return valid JSON)**
The conductor CLI failed or replied with prose twice in a row. Check that the conductor CLI is installed and logged in (run `claude -p "hi"`, `codex exec "hi"` and so on by hand). The message includes the first 300 characters of the reply, which usually shows the real error, such as `[spawn error] spawn claude ENOENT`.

**`spawn … ENOENT` / the agent is not found**
The CLI is not on `PATH` for the process that runs Super Orkestra. GUI apps often get a shorter `PATH` than your terminal. Point to the binary explicitly, for example `ORKESTRA_BIN_CLAUDE_CODE=/opt/homebrew/bin/claude`. For VS Code, set `orkestra.command`.

**Every task goes to conductor review**
No gates are configured or detected (`gates: []`). Add `gates` to `orkestra.config.json`. Also check that your gate passes on a clean checkout.

**`worktree açılamadı` (could not open a worktree)**
The repository has no commits yet, or git refused the worktree. Make an initial commit. Until then, workers run without isolation.

**Gates fail in the worktree but pass in my checkout**
Worktrees contain only tracked files, plus symlinked `node_modules`, `.venv` and `venv`. Untracked local files (such as `.env`) or build outputs your tests depend on are not there. Make gates self-contained, or commit what they need.

**Limits always show `{}`**
Claude needs the statusline hook (`"command": "super-orkestra statusline"` in `~/.claude/settings.json`), and the hook only writes after Claude Code has rendered a statusline. Codex limits appear after you have used Codex at least once (`~/.codex/sessions`).

**A task is `paused`. When will it continue?**
`run` prints `⏸ … otomatik devam <time>` (automatic resume at that time). That is the reset time plus `limits.resumeDelaySec`; when the reset time is unknown, it is one hour from now. Keep `run` open, or run `super-orkestra resume-daemon`. The queue is in `~/.orkestra/resume-queue.json`.

**`devam kuyruğu kilitli` (the resume queue is locked)**
Another Super Orkestra process held `~/.orkestra/resume-queue.json.lock` for more than 2 seconds. A lock older than 60 seconds is taken over automatically. If a crashed process left a fresh lock behind, delete that directory.

**opencode ACP fails with `service failure (directory)` behind a proxy**
This was caused by `HTTP(S)_PROXY` intercepting opencode's calls to its own local server. Super Orkestra now adds loopback addresses to `NO_PROXY` for agent processes automatically. If it still fails, set `"transport": "cli"` for that worker.

**The desktop app says the CLI cannot be started**
Install the CLI (`npm link -w super-orkestra` from a source checkout) and make sure `orkestra` works in a new terminal. On macOS, apps launched from Finder may not see shell `PATH` changes. Start the app from a terminal, or install the CLI into a standard location.
