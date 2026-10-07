# Contributing to Super Orkestra

Thanks for helping! This guide covers the dev setup, the repository layout and the conventions the codebase follows. *(Türkçe özet aşağıda.)*

By participating you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Development setup

```bash
git clone https://github.com/cumabozkurt/super-orkestra.git && cd super-orkestra
npm install
npm run build       # core first, then CLI / VS Code extension / desktop frontend
npm run typecheck   # strict TypeScript for every package and the tests (run after build)
npm test            # vitest
npm run check       # all three in one go, the same as CI
```

- **Node.js ≥ 22.16.** The built-in `node:sqlite` needs FTS5, which first shipped in Node 22.16.0.
- **Desktop:** Rust stable (≥ 1.90 for the current lockfile) plus the [Tauri prerequisites](https://tauri.app/start/prerequisites/), then `npm run dev:desktop`.
- **VS Code extension:** `npm run package:vscode` produces a `.vsix`.
- **Real-agent smoke test (optional):** `npm run smoke` uses opencode's free model `opencode/big-pickle`. It needs opencode installed but no login.

## Repository layout

| Path | Content |
|---|---|
| `packages/core` | Conductor, router, workers (ACP / CLI / OpenRouter), worktrees, gates, memory, repo map, limits, MCP server |
| `packages/cli` | The `super-orkestra` / `orkestra` command and the Claude Code statusline hook |
| `packages/vscode` | Thin VS Code extension (chat participant, MCP registration, status bar) |
| `packages/desktop` | Tauri 2 + React desktop app |
| `tests/` | Unit and integration tests. `tests/fixtures/fake-agent.mjs` is a fake agent CLI that emits the real stream formats of Claude Code, Codex and Gemini, so no accounts are needed. |
| `scripts/` | `smoke.mjs` (real opencode run), `scenarios/` (limit hand-off and auto-resume with real opencode), `set-repo.mjs` |
| `docs/` | User documentation and `research/` reports |

See [docs/architecture.md](docs/architecture.md) for how the pieces fit together.

## Ground rules

- **Add a test for every behaviour change.** Tests must not need real accounts or network access; use the fake agent or in-process fakes as in `tests/conductor.test.ts`. Each test file gets a temporary `HOME` / `ORKESTRA_HOME` from `tests/setup.ts`, so tests never touch your real `~/.orkestra`.
- **Think about Windows.** Spawn processes with `execFile` / `spawn` and an argument array, never a shell string. Join paths with `path.join`. Do not depend on `sh`, `grep` or `printf` in tests. CI runs on Windows, macOS and Linux with Node 22 and 24.
- **Never pass user text through a shell.** Agents get prompts as argv elements (no shell). Frontends pass user text through stdin or `ORKESTRA_INPUT`.
- **Adding a new agent:** update `cliArgv` and `parseEvents` in `packages/core/src/workers/cli-stream.ts`, add limit messages to `packages/core/src/limits/detect.ts`, add the agent to `AgentKind` and the validator in `config.ts`, add an ACP command to `ACP_CMDS` if the agent speaks ACP, and add a stream sample to `tests/agents.test.ts` and `tests/fixtures/fake-agent.mjs`.
- **Keep the design.** The conductor stays tool-less and must not read files, and workers stay isolated in worktrees. Discuss larger changes in an issue first.
- **Docs:** if a change affects users, update the README (both `README.md` and `README.tr.md`), the relevant page in `docs/`, and `CHANGELOG.md` under *Unreleased*.

## Pull requests

1. Fork, then create a branch from `main`.
2. Keep commits focused, with short descriptive messages.
3. Run `npm run check` locally.
4. Open the PR and fill in the template checklist.

## Releasing (maintainers)

1. Update `CHANGELOG.md`. Bump the version in every `package.json` (root, core, cli, vscode, desktop), in the `super-orkestra-core` dependency of `packages/cli/package.json`, in `packages/desktop/src-tauri/Cargo.toml` and in `tauri.conf.json`.
   Move the `[Unreleased]` notes into a new `## [X.Y.Z] — YYYY-MM-DD` section: that section becomes the release notes.
2. Optional dry run: *Actions → release → Run workflow* on `main` builds every package and installer as workflow artifacts without creating a release.
3. `git tag vX.Y.Z && git push origin vX.Y.Z`. [`release.yml`](.github/workflows/release.yml) checks that every version field matches the tag and opens a draft GitHub Release with the CHANGELOG section as notes. It attaches the CLI tarballs, the `.vsix`, the desktop installers for all platforms and `SHA256SUMS.txt`, then publishes the release. npm (`NPM_TOKEN`), the VS Code Marketplace (`VSCE_PAT`) and Open VSX (`OVSX_PAT`) are published only when those secrets exist; without them the steps are skipped.

---

## Türkçe özet

- Kurulum: `npm install && npm run check` (derleme + tip denetimi + testler). Node.js ≥ 22.16 gerekir.
- Her davranış değişikliğine test ekleyin. Testler gerçek hesap ya da ağ gerektirmemeli; sahte ajanı (`tests/fixtures/fake-agent.mjs`) kullanın.
- Windows'u unutmayın: kabuk yerine `execFile`/`spawn`, yollar için `path.join`. Kullanıcı metni asla kabuktan geçmesin.
- Yeni ajan eklerken `cli-stream.ts`, `limits/detect.ts`, `config.ts` ve testleri güncelleyin.
- Kullanıcıyı etkileyen değişikliklerde `README.md`, `README.tr.md`, `docs/` ve `CHANGELOG.md` (*Unreleased*) güncellenmeli.
