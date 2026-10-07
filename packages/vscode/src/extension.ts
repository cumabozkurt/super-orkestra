import * as vscode from "vscode";
import { spawn } from "node:child_process";

/**
 * İnce eklenti: tüm zekâ çekirdekte (`super-orkestra` / `orkestra` CLI, npm i -g super-orkestra).
 *  - @orkestra sohbet katılımcısı (Copilot Chat paneli)
 *  - Orkestra MCP sunucusunu VS Code ajan moduna kaydeder
 *  - Durum çubuğunda 5 saatlik limit yüzdesi
 */
const bin = () => vscode.workspace.getConfiguration("orkestra").get<string>("command") || "orkestra";
const root = () => vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd();

/** Kullanıcı metni argüman olarak değil stdin'den gider: Windows'ta shell:true ile tırnak/yeni satır bozulmasın, enjeksiyon olmasın. */
function run(args: string[], onData?: (s: string) => void, token?: vscode.CancellationToken, input?: string, stdoutOnly = false) {
  return new Promise<string>(res => {
    // Windows'ta npm global komutları .cmd olduğundan kabuk gerekir; argümanlar sabittir (kullanıcı metni stdin'den gider).
    // Boşluk içeren tam yol (ör. "C:\Program Files\...") cmd.exe'de bölünmesin diye tırnaklanır.
    const win = process.platform === "win32"; const b = bin();
    const p = spawn(win && /\s/.test(b) && !/^".*"$/.test(b) ? `"${b}"` : b, args, { cwd: root(), shell: win, windowsHide: true });
    let out = ""; token?.onCancellationRequested(() => p.kill());
    p.stdin.on("error", () => { /* süreç başlamadıysa EPIPE; asıl hata 'error' olayında raporlanır */ });
    if (input !== undefined) p.stdin.end(input); else p.stdin.end();
    p.stdout.on("data", d => { out += d; onData?.(String(d)); });
    p.stderr.on("data", d => { if (!stdoutOnly) out += d; });
    p.on("error", e => res(`Super Orkestra çalıştırılamadı: ${e.message}. 'npm i -g super-orkestra' ile kurun veya orkestra.command ayarını düzenleyin.`));
    p.on("close", () => res(out));
  });
}

export function activate(ctx: vscode.ExtensionContext) {
  const participant = vscode.chat.createChatParticipant("orkestra.conductor", async (req, _c, stream, token) => {
    if (req.command === "limits") { stream.markdown("```json\n" + await run(["limits"], undefined, undefined, undefined, true) + "\n```"); return; }
    if (req.command === "usage") { stream.markdown("```json\n" + await run(["usage"], undefined, undefined, undefined, true) + "\n```"); return; }
    if (req.command === "recall") { stream.markdown(await run(["recall", "-"], undefined, undefined, req.prompt)); return; }
    stream.progress("Şef planlıyor…");
    await run(["run", "-"], s => stream.markdown(s.replace(/\n/g, "  \n")), token, req.prompt);
  });
  participant.iconPath = new vscode.ThemeIcon("organization");
  ctx.subscriptions.push(participant);

  ctx.subscriptions.push(vscode.lm.registerMcpServerDefinitionProvider("orkestra.mcp", {
    provideMcpServerDefinitions: async () => {
      // cwd verilmezse MCP sunucusu VS Code'un kendi dizininde açılır ve yanlış projenin hafızasını/repo haritasını kullanır.
      const d = new vscode.McpStdioServerDefinition("Orkestra", bin(), ["mcp"], {}, String(ctx.extension.packageJSON.version));
      const f = vscode.workspace.workspaceFolders?.[0]; if (f) d.cwd = f.uri; return [d];
    },
  }));

  const bar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  bar.command = "orkestra.limits"; bar.text = "$(pulse) Super Orkestra"; bar.show();
  const refresh = async () => {
    try { const j = JSON.parse(await run(["limits"], undefined, undefined, undefined, true)); const parts = Object.entries<any>(j).map(([k, w]) => `${k.split("-")[0]} %${Math.round(w[0]?.usedPct ?? 0)}`);
      bar.text = `$(pulse) ${parts.join(" · ") || "Orkestra"}`; } catch { /* veri yok */ }
  };
  refresh(); const t = setInterval(refresh, 60_000);
  ctx.subscriptions.push(bar, { dispose: () => clearInterval(t) },
    vscode.commands.registerCommand("orkestra.limits", async () => vscode.window.showInformationMessage((await run(["limits"], undefined, undefined, undefined, true)).slice(0, 800))),
    vscode.commands.registerCommand("orkestra.run", async () => {
      const goal = await vscode.window.showInputBox({ prompt: "Şefe hangi işi verelim?" }); if (!goal) return;
      const ch = vscode.window.createOutputChannel("Orkestra"); ch.show();
      await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: "Orkestra çalışıyor", cancellable: true },
        (_p, token) => run(["run", "-"], s => ch.append(s), token, goal));
    }));
}
export function deactivate() {}
