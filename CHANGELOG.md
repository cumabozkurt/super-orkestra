# Değişiklik günlüğü

Biçim [Keep a Changelog](https://keepachangelog.com/tr/1.1.0/), sürümleme [SemVer](https://semver.org/lang/tr/).

## [Unreleased]

### Düzeltildi
- **Node sürümü:** `engines` alanı `>=22.13` yerine `>=22.16`. Node 22.13–22.15'in yerleşik SQLite'ında FTS5 yok, bu sürümlerde hafıza katmanı `no such module: fts5` ile çöküyordu. Artık net bir hata mesajı veriliyor.
- **ACP işçisi süreci çökertiyordu:** ajan ikilisi yoksa ya da başlatılamıyorsa (`opencode`/`gemini` için varsayılan taşıma `auto` = önce ACP) dinlenmeyen `error` olayı tüm CLI'ı düşürüyordu. Artık başarısız sonuç dönüyor ve CLI taşımasına geçiliyor.
- **ACP dosya kum havuzu:** yol denetimi sembolik bağlantıları da çözüyor. Worktree içindeki bir bağlantı (ör. paylaşılan `node_modules` ya da repoya işlenmiş `x -> /etc`) üzerinden dışarı okuma/yazma engellendi.
- **`reassign` tek işçide görevi duraklatıyordu:** başka müsait işçi yokken şefin "başkasına ver" kararı "hepsi limitte" sanılıp görev 1 saatliğine duraklatılıyordu. Artık aynı işçiyle düzeltmeye dönülüyor.
- **Devam kuyruğu işi sessizce kaybedebiliyordu:** kilit doluyken 50 deneme beklemeden art arda yapılıyordu. Artık kısa aralıklarla ~2 sn bekleniyor, yine alınamazsa hata veriliyor.
- **`ORKESTRA_TICK_MS` etkisizdi:** `schedule()` zamanlayıcıyı varsayılan 30 sn ile kurduğundan `run` komutunun istediği aralık uygulanmıyordu.
- **Geçersiz git dal adı izolasyonu kapatıyordu:** şeften gelen `t1..2` gibi kimlikler `git worktree add`'i düşürüyor ve işçi ana çalışma ağacında koşuyordu. Kimlikler artık geçerli dal adına çevriliyor (`refSafe`).
- **`providers.openrouter.apiKeyEnv` yok sayılıyordu:** belgelenmiş olmasına rağmen her zaman `OPENROUTER_API_KEY` okunuyordu.
- **Yapılandırma doğrulaması:** şef olarak desteklenmeyen `openrouter`/`acp` ve geçersiz `transport` değerleri artık yüklemede reddediliyor (önceden ilk çağrıda belirsiz bir hatayla düşüyordu).
- **OpenRouter istekleri zaman aşımsızdı:** `/models` için 30 sn, sohbet isteği için `ORKESTRA_TASK_TIMEOUT_MS` süre sınırı eklendi. Ağ hataları artık başarısız sonuç olarak dönüyor.
- **Test kurcalama koruması:** alt klasördeki `test_*.py` ve `.test.mjs/.cjs` dosyaları da tanınıyor.
- **Masaüstü:** CLI kurulu değilse "Çalışıyor…" düğmesi takılı kalıyordu ve Modeller sekmesi hata nesnesinde çöküyordu (`models.slice`). Artık kurulum ipucu gösteriliyor.
- **VS Code:** boşluk içeren `orkestra.command` yolu Windows'ta bölünüyordu. Süreç başlamadığında stdin `EPIPE` hatası yakalanmıyordu.
- **CLI:** `usage` kayıt yokken de aynı biçimi döndürüyor. `map --tokens` doğrulanıyor. `resume-daemon` başka projelerin şeflerini önbelleğe alıyor.
- Windows CI'da çalışmayacak `printf` kullanan test düzeltildi. Testlerdeki tip hataları giderildi.

### Eklendi
- 10 yeni regresyon testi (toplam 75). `npm run typecheck` (tüm paketler + testler), `npm run check` ve `npm run smoke` betikleri.
- CI: tip denetimi adımı ve masaüstü için `cargo check` işi.
- İngilizce `README.md` (+ `README.tr.md`), `docs/` altında ayrıntılı belgeler (başlangıç, yapılandırma, mimari, CLI, MCP, VS Code, masaüstü, SSS), `CODE_OF_CONDUCT.md`, masaüstü paketi README'si. Araştırma raporları `docs/research/` altına taşındı.

## [1.0.0] — 2026-10-07
İlk kararlı sürüm. Proje adı **Orkestra → Super Orkestra** oldu.

### Değişti
- npm paketleri: `super-orkestra` (CLI) ve `super-orkestra-core`. Eski belgelerdeki `npm i -g orkestra` başka birine ait bir paketi kuruyordu; artık doğru ad kullanılıyor.
- CLI hem `super-orkestra` hem kısa ad `orkestra` olarak kuruluyor. Yapılandırma dosyası (`orkestra.config.json`), `.orkestra/` klasörü, `ORKESTRA_*` ortam değişkenleri ve VS Code ayar/komut kimlikleri geriye uyumluluk için aynı kaldı.
- Claude statusline kancası CLI paketine taşındı: `"command": "super-orkestra statusline"`.
- Masaüstü uygulaması: "Super Orkestra", kimlik `dev.superorkestra.app`, tüm platformlar için simgeler (.ico/.icns/.png).
- VS Code eklentisi: `super-orkestra.super-orkestra-vscode`, simgeli.

### Eklendi
- GitHub'a hazırlık: CI (Windows/macOS/Linux × Node 22/24, paket kuru çalıştırması, .vsix), tek etiketle npm + VS Code + masaüstü yayını yapan `release.yml`, Dependabot, hata/özellik şablonları, PR şablonu, CONTRIBUTING, SECURITY, `.editorconfig`, `.gitattributes`.
- `npm run set-repo -- <kullanıcı>`: belgelerdeki GitHub adresi yer tutucusunu doldurur.
- npm paketlerinde `files`, `types`, `repository`, `engines` alanları (önceden `dist/` .gitignore yüzünden yayından düşecekti).

## [0.3.5] — 2026-10-07
**ACP çalışıyor:** opencode `session/new` hatasının kökü `HTTP(S)_PROXY` idi (opencode yerel 127.0.0.1 çağrılarını vekile yolluyordu); ajan ortamına NO_PROXY eklendi. Gerçek opencode 1.18.35 ile ACP yeni oturum + `loadSession` devamı doğrulandı; opencode/gemini için varsayılan taşıma `auto` (ACP, düşerse CLI). **tree-sitter repo haritası:** `@vscode/tree-sitter-wasm` ile 16 dil (TS/TSX/JS/Python/Go/Rust/Java/C#/Ruby/PHP/C/C++), yorum ve dizgelerdeki sözde tanımlar artık sayılmıyor; yüklenemezse regex'e düşer. **Yarım iş korunuyor:** limitte başka işçiye devirde ya da oturum kimliği dönmeyen devamda worktree atılmıyor, yeni işçiye mevcut diff ile "kaldığın yerden tamamla" brifi gidiyor. **Boş worktree klasörleri** temizleniyor (`git worktree prune` + boş kök silme). **Masaüstü Windows:** `orkestra.cmd` için `cmd /d /c orkestra <alt komut>`; kullanıcı metni argüman değil `ORKESTRA_INPUT` ortam değişkeniyle gidiyor, izin kapsamı sabit alt komutlara daraltıldı. Ayrıca: `package.json`'daki var olmayan `claude-agent-sdk@^0.3.492` sürümü `npm ci`'ı (dolayısıyla CI'ı) kırıyordu; kullanılmayan iki SDK kaldırıldı. Kapılara 10 dk zaman aşımı + `CI=1` (izleme modunda takılma yok). Şef planı normalize ediliyor (yinelenen id, geçersiz alanlar, boş plan, bozuk JSON'da bir kez yeniden sorma); geçersiz denetim kararı "fix" sayılıyor

## [0.3.4] — 2026-10-07
`budget.maxTokensPerTask` artık uygulanıyor (önceden yok sayılıyordu); yapılandırma varsayılanlarla birleşip doğrulanıyor, npm ile kurulumda dosyasız da çalışıyor, kapılar projeden otomatik çıkarılıyor (npm/cargo/go/pytest); ACP ajanının dosya erişimi worktree'ye hapsedildi, izinler tek seferlik, 20 dk zaman aşımı; statusline kancası bozuk girdide çökmüyor ve atomik yazıyor; tüm kullanıcı dosyaları `ORKESTRA_HOME` (Codex için `CODEX_HOME`) altında; testler Windows CI'da da koşacak biçimde `sh`/`grep` bağımlılığından arındırıldı

## [0.3.3] — 2026-10-07
Codex devam oturumu artık yazma izniyle (`-c sandbox_mode="workspace-write"`) ve aynı modelle açılıyor (önceden salt-okunurdu); çıktıdan yakalanan limit, statusline/rollout yenilemesiyle silinmiyor; Claude "resets 3pm (Europe/Istanbul)" saat dilimine göre çözülüyor (yaz saati dahil); Windows'ta CLI'lar kabuksuz çalışıyor (çok satırlı istem bozulmuyor, kabuk enjeksiyonu yok); OpenRouter işçisinin diff'i gerçekten uygulanıyor; şef token toplamı çoklu koşuda doğru; `--version` ve MCP sürümü doğru; VS Code MCP sunucusu proje klasöründe açılıyor ve hedefi stdin'den (`orkestra run -`) iletiyor

## [0.3.2] — 2026-10-07
limitte duraklayan iş artık **aynı işçi + aynı oturum + korunmuş yarım worktree** ile sürer (önceden başka işçiye yabancı oturum kimliği gidiyor, yarım iş siliniyordu); başarılı koşuda çıktıda geçen "429" limit sanılmıyor; tüm test dosyasını silmek kurcalama sayılıyor; hepsi limitteyken en erken açılan pencere bekleniyor (sabit 1 saat değil); devam kuyruğu süreçler arası kilitli + atomik yazım; temiz klonda `npm run build` sırası düzeltildi; devir mesajı gerçek seçilen işçiyi gösteriyor. S4 gerçek opencode ile yeniden geçti

## [0.3.1] ve öncesi
Claude Code / Codex / Gemini için kod düzeyinde ajan testleri, opencode ücretsiz modelleriyle gerçek uçtan uca koşu, MCP sunucusu, VS Code eklentisi, Tauri masaüstü, limit devri ve otomatik devam senaryoları (S3/S4).
