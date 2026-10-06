import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, extname } from "node:path";
import { execFileSync } from "node:child_process";
import type { TaskBrief, Worker, WorkerConfig, WorkResult } from "../types.js";
import { detectLimit } from "../limits/detect.js";

export function briefToPrompt(b: TaskBrief) {
  return [`GÖREV: ${b.goal}`, `DOSYALAR: ${b.files.join(", ") || "(gerekirse bul)"}`,
    `KABUL KRİTERLERİ:\n${b.acceptance.map(a => "- " + a).join("\n")}`, `BAĞLAM:\n${b.context}`,
    `Değişikliği doğrudan dosyalara uygula. Gereksiz dosya okuma, açıklama yazma. Sonunda en fazla 3 satır özet ver.`].join("\n\n");
}

/** Bayraklar 2026-10-07'de gerçek --help çıktılarıyla doğrulandı:
 *  claude 2.1.292 · codex-cli 0.160.1 · gemini 0.63.0 · opencode 1.18.35 */
export function cliArgv(agent: string, model: string, prompt: string, sessionId: string, resume?: string, cwd = process.cwd()): [string, string[]] {
  switch (agent) {
    case "claude-code":
      return ["claude", ["-p", prompt, "--output-format", "stream-json", "--verbose", "--permission-mode", "acceptEdits", "--add-dir", cwd,
        ...(model ? ["--model", model] : []), ...(resume ? ["--resume", resume] : ["--session-id", sessionId])]];
    case "codex":
      return ["codex", resume
        // `exec resume` -s/-C kabul etmez (codex 0.160.1 --help); yazma izni -c ile verilmezse devam oturumu salt-okunur kalır
        ? ["exec", "resume", "--json", "--skip-git-repo-check", "-c", 'sandbox_mode="workspace-write"', ...(model ? ["-m", model] : []), resume, prompt]
        : ["exec", "--json", "--skip-git-repo-check", "-C", cwd, "-s", "workspace-write", ...(model ? ["-m", model] : []), prompt]];
    case "gemini": // gemini --resume oturum kimliği değil "latest"/indeks alır
      return ["gemini", ["-p", prompt, "-o", "stream-json", "--approval-mode", "auto_edit", ...(model ? ["-m", model] : []), ...(resume ? ["-r", "latest"] : [])]];
    case "opencode":
      return ["opencode", ["run", "--format", "json", "--auto", "--dir", cwd, ...(model ? ["-m", model] : []), ...(resume ? ["-s", resume] : []), prompt]];
    default: throw new Error(`CLI işçisi desteklemiyor: ${agent}`);
  }
}

export interface ParsedStream { text: string; sessionId?: string; usage: WorkResult["usage"]; isError?: boolean }

/** Dört CLI'nın JSON olay akışlarını tek biçime indirger. */
export function parseEvents(raw: string, prev?: ParsedStream): ParsedStream {
  const out: ParsedStream = prev ?? { text: "", usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } };
  for (const line of raw.split("\n")) {
    const l = line.trim(); if (!l.startsWith("{")) continue;
    let ev: any; try { ev = JSON.parse(l); } catch { continue; }
    out.sessionId = ev.session_id ?? ev.sessionID ?? ev.thread_id ?? out.sessionId;
    if (ev.is_error === true || ev.type === "error" || ev.type === "turn.failed" || (ev.type === "result" && ev.status === "error")) out.isError = true;
    // claude: {type:"result", result, usage}  | assistant mesajları
    if (ev.type === "result" && typeof ev.result === "string") out.text = ev.result;
    // opencode: {type:"text", part:{text}} ve step_finish.part.tokens
    if (ev.type === "text" && ev.part?.text) out.text += ev.part.text;
    if (ev.part?.tokens) { const t = ev.part.tokens; out.usage.input += t.input ?? 0; out.usage.output += (t.output ?? 0) + (t.reasoning ?? 0);
      out.usage.cacheRead += t.cache?.read ?? 0; out.usage.cacheWrite += t.cache?.write ?? 0; }
    // codex: item.completed agent_message, turn.completed usage
    if (ev.type === "item.completed" && ev.item?.type === "agent_message") out.text = ev.item.text ?? out.text;
    if (ev.type === "turn.completed" && ev.usage) { out.usage.input += ev.usage.input_tokens ?? 0; out.usage.output += ev.usage.output_tokens ?? 0; out.usage.cacheRead += ev.usage.cached_input_tokens ?? 0; }
    // gemini stream-json: {type:"message", role:"assistant", content} / {type:"result", stats}
    if (ev.type === "message" && ev.role === "assistant" && typeof ev.content === "string") out.text += ev.content;
    if (ev.type === "result" && ev.stats) { out.usage.input += ev.stats.input_tokens ?? 0; out.usage.output += ev.stats.output_tokens ?? 0; out.usage.cacheRead += ev.stats.cached ?? 0; }
    // claude usage (result olayında toplam)
    if (ev.type === "result" && ev.usage) { const u = ev.usage; out.usage.input += u.input_tokens ?? 0; out.usage.output += u.output_tokens ?? 0;
      out.usage.cacheRead += u.cache_read_input_tokens ?? 0; out.usage.cacheWrite += u.cache_creation_input_tokens ?? 0; }
  }
  return out;
}

/**
 * Windows: npm CLI'ları .cmd sarmalayıcısıdır; shell:true ile çok satırlı/tırnaklı istem cmd.exe'de bozulur (ve kabuk enjeksiyonuna açıktır).
 * .exe ise doğrudan, .cmd ise içindeki JS betiği `node betik.js` olarak KABUKSUZ çalıştırılır.
 */
export function resolveSpawn(bin: string, args: string[], platform = process.platform, where = (b: string) => execFileSync("where", [b], { encoding: "utf8" })): [string, string[]] {
  if (platform !== "win32") return [bin, args];
  let p = bin;
  if (!/[\\/]/.test(bin)) { try { const hits = where(bin).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    p = hits.find(h => /\.exe$/i.test(h)) ?? hits.find(h => /\.cmd$/i.test(h)) ?? bin; } catch { return [bin, args]; } }
  if (/\.exe$/i.test(p) || extname(p) === "") return [p, args];
  if (/\.(m?js|cjs)$/i.test(p)) return [process.execPath, [p, ...args]];
  if (/\.cmd$/i.test(p) && existsSync(p)) {
    const m = readFileSync(p, "utf8").match(/"%(?:~dp0|dp0)%\\?([^"]+?\.(?:m?js|cjs|exe))"/i);
    if (m) { const target = join(dirname(p), m[1].replace(/^\\/, "")); return /\.exe$/i.test(target) ? [target, args] : [process.execPath, [target, ...args]]; }
  }
  return [p, args];
}

/**
 * Ajan süreçlerinin ortamı. HTTP(S)_PROXY tanımlıyken opencode kendi yerel sunucusuna (127.0.0.1) yaptığı çağrıları da
 * vekil sunucuya yolluyor ve ACP `session/new` "OpenCode service failure {service: directory}" ile düşüyordu
 * (anomalyco/opencode#31091, zed#60519). Geri döngü adresleri NO_PROXY'ye eklenir.
 */
export function agentEnv(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const loop = ["127.0.0.1", "localhost", "::1"];
  const cur = (base.NO_PROXY ?? base.no_proxy ?? "").split(",").map(s => s.trim()).filter(Boolean);
  const merged = [...new Set([...cur, ...loop])].join(",");
  return { ...base, NO_PROXY: merged, no_proxy: merged };
}

export function runCli(agent: string, model: string, prompt: string, cwd: string, opts: { resume?: string; signal?: AbortSignal; timeoutMs?: number } = {}) {
  const sessionId = crypto.randomUUID();
  const [cmd, args] = cliArgv(agent, model, prompt, sessionId, opts.resume, cwd);
  const [bin, argv] = resolveSpawn(process.env[`ORKESTRA_BIN_${agent.replace("-", "_").toUpperCase()}`] ?? cmd, args);
  return new Promise<{ code: number | null; raw: string; parsed: ParsedStream }>(resolve => {
    const p = spawn(bin, argv, { cwd, signal: opts.signal, windowsHide: true, stdio: ["ignore", "pipe", "pipe"], env: agentEnv() });
    let raw = "";
    const t = setTimeout(() => p.kill(), opts.timeoutMs ?? Number(process.env.ORKESTRA_TASK_TIMEOUT_MS ?? 20 * 60_000));
    p.stdout.on("data", d => (raw += d)); p.stderr.on("data", d => (raw += d));
    p.on("error", e => (raw += `\n[spawn error] ${e.message}`));
    p.on("close", code => { clearTimeout(t); const parsed = parseEvents(raw); parsed.sessionId ??= agent === "claude-code" ? sessionId : undefined; resolve({ code, raw, parsed }); });
  });
}

/** Claude Code / Codex / Gemini / opencode CLI'larını headless sarar (kullanıcının abonelik girişini kullanır). */
export class CliWorker implements Worker {
  constructor(public config: WorkerConfig) {}
  async run(brief: TaskBrief, opts: { cwd: string; resumeSessionId?: string; signal?: AbortSignal }): Promise<WorkResult> {
    const prompt = opts.resumeSessionId ? "Limit nedeniyle yarıda kaldın. Kaldığın yerden devam et ve görevi bitir." : briefToPrompt(brief);
    const { code, raw, parsed } = await runCli(this.config.agent, this.config.model, prompt, opts.cwd, { resume: opts.resumeSessionId, signal: opts.signal });
    // Limit metni yalnızca koşu başarısızsa aranır: işçinin kendi çıktısında geçen "429" vb. yanlış alarm vermesin.
    const limitHit = code !== 0 || parsed.isError ? detectLimit(raw.slice(-4000), this.config.agent) : undefined;
    return { taskId: brief.id, workerId: this.config.id, sessionId: parsed.sessionId, ok: code === 0 && !limitHit,
      summary: (parsed.text || raw).slice(-1500), usage: parsed.usage, limitHit };
  }
}
