<p align="center"><img src="docs/logo.png" width="112" alt="Super Orkestra"></p>

<h1 align="center">Super Orkestra 🎼</h1>

<p align="center">
  <b>En güçlü model şef, altında seçtiğin 3 işçi model.</b><br>
  Claude / ChatGPT / Gemini aboneliklerinde <b>en az token ve limitle en kaliteli kod</b>.
</p>

<p align="center">
  <a href="https://github.com/cumabozkurt/super-orkestra/actions/workflows/ci.yml"><img src="https://github.com/cumabozkurt/super-orkestra/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/super-orkestra"><img src="https://img.shields.io/npm/v/super-orkestra" alt="npm"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/lisans-MIT-blue" alt="MIT"></a>
</p>

Super Orkestra açık kaynak bir AI kodlama orkestratörüdür. Şef model işi böler ve kime vereceğine karar verir. İşçi modeller her görevi **izole bir git worktree'de** yapar. Test/lint kapıları sonucu denetler; kapılar geçerse şef hiç uyanmaz. Bir şey ters giderse şef müdahale eder (düzelt / başkasına ver). Bir aboneliğin 5 saatlik ya da haftalık limiti dolarsa iş diğer işçiye devredilir; hepsi doluysa limit sıfırlandığında **aynı oturum kaldığı yerden kendiliğinden devam eder**.

## Özellikler
- **Her kodlama CLI'ı ile:** Claude Code, Codex, Gemini CLI, opencode (ACP + headless CLI), OpenRouter'daki tüm modeller.
- **Token tasarrufu:** Şef araçsız tek tur JSON üretir, dosya okumaz. İşçiye ≤120 kelimelik brif, token bütçeli hafıza ve odaklı repo haritası gider. Düzeltme aynı işçiye gider (önbellek sıcak kalır). `budget.maxTokensPerTask` sınırı uygulanır.
- **Limit takibi:** Claude statusline `rate_limits`, Codex rollout kayıtları, 429/“try again” algılama. Limitte devir ya da sıfırlanınca otomatik devam (kalıcı kuyruk). Yarım iş asla atılmaz.
- **Kalıcı hafıza:** git'te markdown bankası + SQLite FTS5 olgu deposu.
- **tree-sitter repo haritası:** 16 dil, referans grafiğinde PageRank, hedefe odaklı.
- **Her yerde:** CLI · MCP sunucusu (Claude Code, Codex, Copilot, Cline, Continue...) · VS Code eklentisi · Windows/macOS/Linux masaüstü uygulaması.

## Kurulum
```bash
# 1) Kullanmak istediğin ajan CLI'ları (en güncel sürümler)
npm i -g @anthropic-ai/claude-code@latest @openai/codex@latest @google/gemini-cli@latest opencode-ai@latest

# 2) Super Orkestra (Node.js ≥ 22.13)
npm i -g super-orkestra

# 3) Projende çalıştır
cd projen
super-orkestra run "login sayfasına 2FA ekle ve testlerini yaz"
```
Yapılandırma dosyası olmadan da çalışır (varsayılan: Claude şef + Claude/Codex/opencode işçiler; test kapısı projeden otomatik seçilir: npm, cargo, go, pytest). Şefi ve 3 işçiyi seçmek için [`orkestra.config.example.json`](orkestra.config.example.json) dosyasını projene `orkestra.config.json` olarak kopyala.
Giriş gerektirmeyen ücretsiz deneme: [`examples/free-opencode.config.json`](examples/free-opencode.config.json).

### Kaynaktan
```bash
git clone https://github.com/cumabozkurt/super-orkestra.git && cd super-orkestra
npm install && npm run build && npm link -w super-orkestra
```

## Komutlar
`orkestra` kısa adı da aynı komuttur.

| Komut | Ne yapar |
|---|---|
| `super-orkestra run <hedef>` | Şef planlar, dağıtır, denetler, birleştirir (`run -` hedefi stdin'den okur) |
| `super-orkestra mcp` | MCP sunucusu: `claude mcp add super-orkestra -- super-orkestra mcp` · `codex mcp add super-orkestra -- super-orkestra mcp` |
| `super-orkestra resume-daemon` | Limit sıfırlanınca bekleyen oturumları sürdürür |
| `super-orkestra limits` / `usage` | 5 saatlik/haftalık limitler · token ve önbellek kullanımı |
| `super-orkestra models [--free]` | opencode + OpenRouter modellerini keşfeder |
| `super-orkestra map` / `remember` / `recall` | Repo haritası · hafızaya yaz · hafızadan getir |
| `super-orkestra statusline` | Claude Code statusline kancası (limitleri kaydeder) |

**Claude limitlerini canlı okumak için** `~/.claude/settings.json`:
```json
{ "statusLine": { "type": "command", "command": "super-orkestra statusline" } }
```

**VS Code:** Marketplace'te “Super Orkestra” ya da [Releases](https://github.com/cumabozkurt/super-orkestra/releases) sayfasındaki `.vsix` → Uzantılar → “VSIX'ten yükle”. Sohbette `@orkestra <görev>`, `/limits`, `/usage`, `/recall`.

**Masaüstü:** [Releases](https://github.com/cumabozkurt/super-orkestra/releases) sayfasından Windows (.msi/.exe), macOS (.dmg) ve Linux (.AppImage/.deb/.rpm) paketlerini indir. Uygulama CLI'ı kullanır, bu yüzden önce `npm i -g super-orkestra` gerekir. Geliştirme için: `npm run dev:desktop` (Rust gerekir).

## Mimari
```
 Masaüstü (Tauri 2 + React 19) ─┐   VS Code (@orkestra sohbet + MCP kaydı + limit çubuğu)
                                 ▼   ▼
                   super-orkestra CLI ──── MCP sunucusu → Claude Code, Codex, Gemini, opencode, Copilot, Cline
                                 │
   ┌──────────────── super-orkestra-core ───────────────────────────────────────┐
   │ Şef: plan + denetim, ARAÇSIZ tek tur JSON. Dosya okumaz: repo haritası + diff │
   │ Yönlendirici: sıfır-token kural skoru (zorluk × uzmanlık × maliyet)           │
   │ İşçiler: izole git worktree · ACP · claude -p · codex exec · gemini · opencode│
   │          · OpenRouter                                                         │
   │ Kapılar: test/lint/typecheck; geçerse şef HİÇ uyanmaz                         │
   │ Hafıza: markdown bankası + SQLite FTS5 (token bütçeli)                        │
   │ Repo haritası: tree-sitter tanımları + referans grafiğinde PageRank           │
   │ Limit: statusline / rollout / 429 → devir → yoksa resets_at+60 sn'de devam    │
   └───────────────────────────────────────────────────────────────────────────────┘
```
Tasarım kararları 60'a yakın açık kaynak reponun incelenmesine dayanır; araştırma raporları [`docs/`](docs/) klasöründe.

## Doğrulama (v1.0.0)
- 65 birim/entegrasyon testi (UTC, İstanbul, Los Angeles, Tokyo saat dilimlerinde); CI Windows/macOS/Linux × Node 22/24.
- opencode ücretsiz modelleriyle gerçek uçtan uca koşular (ACP ve CLI): şef planladı → işçi worktree'de düzeltti → kapı geçti → ana dala birleşti. Limit devri ve hepsi-limitte otomatik devam senaryoları ([`scripts/scenarios/`](scripts/scenarios/)).
- Claude Code / Codex / Gemini **kod düzeyinde** test edildi (sahte CLI akışlarıyla); bayraklar gerçek `--help` çıktılarıyla doğrulandı. Gerçek hesapla canlı koşu yapılmadı.

## Bilinen sınırlar
- Gemini CLI `--resume` oturum kimliği yerine `latest` alır. Her görev kendi worktree'sinde koştuğu için pratikte doğru oturum seçilir.
- Codex `exec` modunda `rate_limits` bazen boş gelir; o durumda hata metni/429 algılaması devreye girer.
- Birden çok abonelik hesabı arasında otomatik geçiş, hizmet şartlarıyla çakışabileceği için kapalıdır.

## Katkı
[CONTRIBUTING.md](CONTRIBUTING.md) · [CHANGELOG.md](CHANGELOG.md) · Güvenlik: [SECURITY.md](SECURITY.md)

Lisans: [MIT](LICENSE) © 2026 Cuma Bozkurt
