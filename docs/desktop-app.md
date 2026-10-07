# Desktop app

`packages/desktop` is a [Tauri 2](https://tauri.app) app with a React 19 + Vite frontend. Like the VS Code extension, it is a shell around the CLI: every action spawns `orkestra <subcommand>`.

## Features

| Tab | What it shows | CLI call |
|---|---|---|
| **Görev** (Task) | Pick a project folder, type a goal, and watch the live log | `orkestra run -` (goal in `ORKESTRA_INPUT`) |
| **Kullanım** (Usage) | Input, output and cache tokens, cache hit ratio, and a per-worker table | `orkestra usage` |
| **Limitler** (Limits) | 5-hour and weekly bars with reset times, refreshed every 60 s | `orkestra limits` |
| **Hafıza** (Memory) | Search project memory | `orkestra recall -` |
| **Modeller** (Models) | Discover opencode and OpenRouter models (first 300 shown) | `orkestra models` |

The selected project folder is remembered between sessions. If the CLI cannot be started, the app shows an install hint instead of hanging.

## Requirements

- The Super Orkestra CLI installed so that the `orkestra` command is on `PATH` (see [Getting started](getting-started.md)).
- To develop or build: Rust (stable, **1.90 or newer** for the current Tauri 2.12 dependency tree) and the [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS. On Debian/Ubuntu:
  ```bash
  sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
  ```

## Develop

```bash
npm install
npm run build -w super-orkestra-core -w super-orkestra   # the app shells out to the CLI
npm link -w super-orkestra                                # make `orkestra` available
npm run dev:desktop                                       # vite on :1420 + tauri dev
```

Frontend-only changes can be checked quickly with `npm run build -w super-orkestra-desktop` (Vite) and `npx tsc -p packages/desktop` (type check). Run `cargo check` in `packages/desktop/src-tauri` to validate the Rust side; CI does the same.

## Build installers

```bash
npm run tauri build -w super-orkestra-desktop
```

`bundle.targets` is `"all"`, so you get the native formats for the OS you build on: `.msi`/`.exe` on Windows, `.dmg`/`.app` on macOS, and `.AppImage`/`.deb`/`.rpm` on Linux. `release.yml` builds all of them (macOS for both Apple Silicon and Intel) into a **draft** GitHub Release when a `v*` tag is pushed. The builds are not code-signed.

## Permission model

The app uses `tauri-plugin-shell` with a tightly scoped capability ([`src-tauri/capabilities/default.json`](../packages/desktop/src-tauri/capabilities/default.json)):

| Scope name | Program | Allowed arguments |
|---|---|---|
| `orkestra` | `orkestra` | exactly one of `limits`, `usage`, `models` |
| `orkestra-input` | `orkestra` | one of `run`, `recall`, `remember`, followed by `-` |
| `orkestra-win` | `cmd` | `/d /c orkestra` + one of `limits`, `usage`, `models` |
| `orkestra-win-input` | `cmd` | `/d /c orkestra` + one of `run`, `recall`, `remember` + `-` |

User text is **never** an argument. It travels in the `ORKESTRA_INPUT` environment variable, so `cmd.exe` quoting or injection cannot happen on Windows, where npm installs `orkestra.cmd` and Rust's process API does not resolve `.cmd` through `PATHEXT`. Apart from the shell scope, the app only has `core:default` and `dialog:allow-open` (the folder picker).

## Identity

| Field | Value |
|---|---|
| Product name | Super Orkestra |
| Identifier | `dev.superorkestra.app` |
| Window | 1100 × 780 |
| Icons | `src-tauri/icons/` (`.ico`, `.icns`, PNG sizes) |
