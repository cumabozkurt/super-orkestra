# Katkı rehberi

Super Orkestra'ya katkın için teşekkürler!

## Geliştirme ortamı
```bash
git clone https://github.com/cumabozkurt/super-orkestra.git && cd super-orkestra
npm install
npm run build      # önce çekirdek, sonra CLI / VS Code / masaüstü
npm test           # vitest
```
- Node.js ≥ 22.13 (yerleşik `node:sqlite` için).
- Masaüstü için Rust ve [Tauri önkoşulları](https://tauri.app/start/prerequisites/): `npm run dev:desktop`.
- VS Code eklentisi: `npm run package:vscode` ile `.vsix` üretilir.

## Depo yapısı
| Klasör | İçerik |
|---|---|
| `packages/core` | Şef, yönlendirici, işçiler (ACP/CLI/OpenRouter), worktree, kapılar, hafıza, repo haritası, limitler, MCP |
| `packages/cli` | `super-orkestra` komutu ve Claude statusline kancası |
| `packages/vscode` | İnce VS Code eklentisi (sohbet katılımcısı + MCP kaydı) |
| `packages/desktop` | Tauri 2 + React masaüstü uygulaması |
| `tests/` | Birim ve entegrasyon testleri; `tests/fixtures/fake-agent.mjs` gerçek hesap gerektirmeyen sahte ajan CLI'ı |
| `scripts/scenarios/` | Gerçek opencode ile limit senaryoları |
| `docs/` | Araştırma raporları |

## Kurallar
- Her davranış değişikliğine test ekle. Testler gerçek hesap ya da ağ gerektirmemeli (sahte ajanı kullan).
- Windows'u unutma: kabuk komutu yerine `execFile`/`spawn`, yol birleştirmede `path.join`.
- Yeni bir ajan eklerken `packages/core/src/workers/cli-stream.ts` (argv + akış ayrıştırma) ve `limits/detect.ts` (limit metinleri) dosyalarını güncelle, `tests/agents.test.ts` içine akış örneği ekle.
- Commit mesajları kısa ve açıklayıcı olsun; PR şablonundaki listeyi doldur.

## Sürüm yayınlama (bakımcılar)
1. `CHANGELOG.md` dosyasını güncelle, tüm `package.json` dosyalarında, `Cargo.toml` ve `tauri.conf.json` içinde sürümü artır.
2. `git tag vX.Y.Z && git push --tags`. `release.yml` npm paketlerini (sır `NPM_TOKEN`), VS Code eklentisini (isteğe bağlı `VSCE_PAT` / `OVSX_PAT`) ve masaüstü paketlerini taslak bir GitHub Release'te toplar.
