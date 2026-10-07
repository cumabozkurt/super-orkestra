# Security Policy

*(Türkçe metin aşağıda.)*

## Supported versions

| Version | Supported |
|---|---|
| 1.x (latest) | ✅ |
| < 1.0 | ❌ |

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Instead:

- use GitHub's [private vulnerability reporting](https://github.com/cumabozkurt/super-orkestra/security/advisories/new), or
- email **info@cumabozkurt.tr**.

You will get a reply within 72 hours. Please include steps to reproduce, the affected version (`super-orkestra --version`) and your OS.

## Threat model in short

Super Orkestra runs AI coding agents that **edit code and run commands on your machine** with your logins. Treat it like any other tool that runs code in your repository:

- Only run it on repositories you trust. A malicious repository can contain gate scripts (`npm test`, …) or agent instructions that execute code.
- `gates` in `orkestra.config.json` are run **through your shell** by design. Review a project's `orkestra.config.json` before running it, just as you would review its `package.json` scripts.
- Agents themselves run with the permissions their CLIs are given: `--permission-mode acceptEdits` (Claude Code), `-s workspace-write` (Codex), `--approval-mode auto_edit` (Gemini), `--auto` (opencode). These flags are part of what you accept when you use Super Orkestra.

## Built-in safeguards

- **Isolation:** each task runs in its own git worktree outside the repository (`~/.orkestra/worktrees/`). Work is merged only after gates and/or a conductor review. When the folder is not a git repository, or has no commits yet, this isolation is **not** available.
- **ACP file sandbox:** file reads and writes requested over ACP are confined to the worktree. Paths are resolved **including symlinks**, so a link inside the worktree cannot be used to reach outside it. Permissions are granted one at a time (`allow_once`) and cancelled when no such option exists.
- **No shell for agents:** agent processes are spawned without a shell. On Windows, `.cmd` shims are resolved to `node <script>`, so prompts cannot inject commands.
- **Frontends:** the VS Code extension and the desktop app never put user text on a command line; it goes through stdin or the `ORKESTRA_INPUT` environment variable. The desktop app's shell permission is limited to fixed `orkestra` subcommands.
- **Secrets:** API keys are not written to configuration files. They are read from the environment variable named in `providers.openrouter.apiKeyEnv`.
- **Test-tampering guard:** diffs that delete or weaken existing test assertions always go to conductor review.
- **Accounts:** automatic switching between several subscription accounts is not implemented.
- **Timeouts:** worker runs (20 min), conductor calls (10 min) and gates (10 min) are time-limited.

---

## Türkçe

**Açık bildirme:** Güvenlik açıklarını **herkese açık issue olarak açmayın**. GitHub'daki [özel güvenlik bildirimi](https://github.com/cumabozkurt/super-orkestra/security/advisories/new) özelliğini ya da **info@cumabozkurt.tr** adresini kullanın. 72 saat içinde dönüş yapılır. En son `1.x` sürümü güvenlik düzeltmesi alır.

**Tasarım gereği önlemler:**

- İşçi ajanlar izole git worktree'lerde çalışır. ACP üzerinden dosya erişimi, sembolik bağlantılar çözülerek worktree köküyle sınırlanır. İzinler yalnızca tek seferlik verilir.
- Ajan süreçleri kabuk (shell) olmadan başlatılır. VS Code eklentisi ve masaüstü uygulaması kullanıcı metnini argüman olarak değil stdin ya da ortam değişkeniyle iletir.
- API anahtarları yapılandırma dosyasına yazılmaz, ortam değişkeninden okunur (`apiKeyEnv`).
- `gates` komutları tasarım gereği kabukta çalışır; güvenmediğiniz projelerin `orkestra.config.json` dosyasını çalıştırmadan önce inceleyin.
- Birden çok abonelik hesabı arasında otomatik geçiş uygulanmamıştır.
