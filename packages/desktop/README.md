# super-orkestra-desktop

Tauri 2 + React 19 desktop app for [Super Orkestra](../../README.md). It provides Task, Usage, Limits, Memory and Models tabs on top of the `orkestra` CLI. This package is private and is not published to npm.

*Türkçe:* Görev · Kullanım · Limitler · Hafıza · Modeller sekmeleri olan masaüstü uygulaması. CLI'ı alt süreç olarak çağırır.

```bash
# from the repository root
npm install
npm run build -w super-orkestra-core -w super-orkestra && npm link -w super-orkestra   # the app needs the CLI
npm run dev:desktop                                   # dev mode (Rust + Tauri prerequisites required)
npm run tauri build -w super-orkestra-desktop         # installers for the current OS
```

| Path | Content |
|---|---|
| `src/main.tsx` | The whole UI. CLI calls go through `@tauri-apps/plugin-shell`. |
| `src-tauri/tauri.conf.json` | App identity (`dev.superorkestra.app`), window, bundle settings |
| `src-tauri/capabilities/default.json` | Shell permission limited to fixed `orkestra` subcommands |
| `src-tauri/src/main.rs` | Registers the shell and dialog plugins |

Full guide: [docs/desktop-app.md](../../docs/desktop-app.md)
