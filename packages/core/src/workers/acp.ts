/**
 * ACP (Agent Client Protocol) işçisi. Doğal: opencode (`opencode acp`), Gemini (`gemini --acp`), Qwen, Kilo.
 * Adaptörle: Claude Code (@agentclientprotocol/claude-agent-acp), Codex (@agentclientprotocol/codex-acp).
 */
import { spawn } from "node:child_process";
import { Readable, Writable } from "node:stream";
import { readFile, writeFile, mkdir, realpath } from "node:fs/promises";
import { resolve, relative, isAbsolute, dirname } from "node:path";

/** ACP ajanının dosya isteklerini çalışma dizinine (worktree) hapseder: ana repoya veya ev dizinine yazamasın. */
export function insideRoot(root: string, p: string) { const r = relative(resolve(root), resolve(root, p)); return r === "" || (!r.startsWith("..") && !isAbsolute(r)); }

/**
 * insideRoot + sembolik bağlantı çözümü. Yalnızca metinsel kontrol, worktree içindeki bir bağlantı üzerinden dışarı
 * erişime izin veriyordu (ör. ana repoya bağlanan paylaşılan `node_modules`, ya da repoya işlenmiş `x -> /etc`).
 * Hedefin (yoksa var olan en yakın atasının) gerçek yolu, kökün gerçek yolu altında olmalıdır.
 */
export async function insideRootReal(root: string, p: string): Promise<boolean> {
  if (!insideRoot(root, p)) return false;
  const realRoot = await realpath(root).catch(() => resolve(root));
  let cur = resolve(root, p);
  for (;;) {
    try { return insideRoot(realRoot, await realpath(cur)); }
    catch { const up = dirname(cur); if (up === cur) return false; cur = up; }
  }
}
import * as acp from "@agentclientprotocol/sdk";
import type { TaskBrief, Worker, WorkerConfig, WorkResult } from "../types.js";
import { briefToPrompt, agentEnv, resolveSpawn } from "./cli-stream.js";
import { detectLimit } from "../limits/detect.js";

export const ACP_CMDS: Record<string, [string, string[]]> = {
  opencode: ["opencode", ["acp"]],
  gemini: ["gemini", ["--acp"]],
  "claude-code": ["npx", ["-y", "@agentclientprotocol/claude-agent-acp@latest"]],
  codex: ["npx", ["-y", "@agentclientprotocol/codex-acp@latest"]],
};

export class AcpWorker implements Worker {
  constructor(public config: WorkerConfig, private acpAgent = config.agent === "acp" ? "opencode" : config.agent) {}

  async run(brief: TaskBrief, opts: { cwd: string; resumeSessionId?: string; signal?: AbortSignal }): Promise<WorkResult> {
    const [cmd, args] = ACP_CMDS[this.acpAgent] ?? ACP_CMDS.opencode;
    const bin = process.env[`ORKESTRA_BIN_${this.acpAgent.replace("-", "_").toUpperCase()}`] ?? cmd;
    const [exe, argv] = resolveSpawn(bin, args); // Windows'ta da kabuksuz (.cmd -> node betiği)
    const proc = spawn(exe, argv, { cwd: opts.cwd, stdio: ["pipe", "pipe", "pipe"], windowsHide: true, env: agentEnv() });
    const killer = setTimeout(() => proc.kill(), Number(process.env.ORKESTRA_TASK_TIMEOUT_MS ?? 20 * 60_000)); // takılan ajan sonsuza dek beklemesin
    let stderr = ""; proc.stderr.on("data", d => (stderr += d));
    // Ajan ikilisi yoksa/çalıştırılamazsa 'error' olayı dinleyicisiz kalıp tüm süreci çökertiyordu.
    proc.on("error", e => (stderr += `\n[spawn error] ${e.message}`)); proc.stdin.on("error", () => {});
    const onAbort = () => proc.kill(); opts.signal?.addEventListener("abort", onAbort, { once: true });
    let text = "";
    const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
    const stream = acp.ndJsonStream(Writable.toWeb(proc.stdin) as WritableStream<Uint8Array>, Readable.toWeb(proc.stdout) as ReadableStream<Uint8Array>);
    const conn = new acp.ClientSideConnection(() => ({
      async sessionUpdate(n: any) {
        const u = n.update;
        if (u?.sessionUpdate === "agent_message_chunk" && u.content?.type === "text") text += u.content.text;
        if (u?.sessionUpdate === "usage_update" && u.used) usage.input = u.used;
      },
      async requestPermission(p: any) {
        // Kalıcı izin yerine tek seferlik izin; izin seçeneği yoksa iptal (önceden ilk seçenek körlemesine seçiliyordu)
        const allow = p.options.find((o: any) => o.kind === "allow_once") ?? p.options.find((o: any) => o.kind === "allow_always");
        if (!allow) return { outcome: { outcome: "cancelled" } };
        return { outcome: { outcome: "selected", optionId: allow.optionId } };
      },
      async readTextFile(p: any) {
        if (!(await insideRootReal(opts.cwd, p.path))) throw new Error(`çalışma dizini dışı okuma reddedildi: ${p.path}`);
        let c = await readFile(resolve(opts.cwd, p.path), "utf8");
        if (p.line || p.limit) { const ls = c.split("\n"); const s = Math.max(0, (p.line ?? 1) - 1); c = ls.slice(s, p.limit ? s + p.limit : undefined).join("\n"); }
        return { content: c }; },
      async writeTextFile(p: any) {
        if (!(await insideRootReal(opts.cwd, p.path))) throw new Error(`çalışma dizini dışı yazma reddedildi: ${p.path}`);
        const f = resolve(opts.cwd, p.path); await mkdir(dirname(f), { recursive: true }); await writeFile(f, p.content); return {}; },
    }), stream);
    try {
      await conn.initialize({ protocolVersion: acp.PROTOCOL_VERSION, clientCapabilities: { fs: { readTextFile: true, writeTextFile: true } } } as any);
      let sessionId: string; let configOptions: any[] = [];
      if (opts.resumeSessionId) {
        const r: any = await conn.loadSession({ sessionId: opts.resumeSessionId, cwd: opts.cwd, mcpServers: [] } as any);
        sessionId = opts.resumeSessionId; configOptions = r?.configOptions ?? [];
      } else {
        const r: any = await conn.newSession({ cwd: opts.cwd, mcpServers: [] } as any);
        sessionId = r.sessionId; configOptions = r.configOptions ?? [];
      }
      await this.selectModel(conn, sessionId, configOptions);
      text = "";
      const res: any = await conn.prompt({ sessionId, prompt: [{ type: "text", text: opts.resumeSessionId ? "Kaldığın yerden devam et ve görevi bitir." : briefToPrompt(brief) }] } as any);
      if (res?.usage) { usage.input = res.usage.inputTokens ?? usage.input; usage.output = res.usage.outputTokens ?? 0; usage.cacheRead = res.usage.cachedReadTokens ?? 0; usage.cacheWrite = res.usage.cachedWriteTokens ?? 0; }
      const limitHit = res?.stopReason === "end_turn" ? undefined : detectLimit((text + stderr).slice(-4000), this.acpAgent);
      return { taskId: brief.id, workerId: this.config.id, sessionId, ok: res?.stopReason === "end_turn" && !limitHit, summary: text.slice(-1500), usage, limitHit };
    } catch (e: any) {
      const msg = `${e?.message ?? e}\n${stderr}`;
      return { taskId: brief.id, workerId: this.config.id, ok: false, summary: msg.slice(-1500), usage, limitHit: detectLimit(msg, this.acpAgent) };
    } finally { clearTimeout(killer); opts.signal?.removeEventListener("abort", onAbort); proc.kill(); }
  }

  /** Model seçimi ACP session config option üzerinden (category "model" veya id "model"). */
  private async selectModel(conn: acp.ClientSideConnection, sessionId: string, options: any[]) {
    const m = this.config.model; if (!m) return;
    const opt = options.find(o => o.category === "model" || o.id === "model");
    if (!opt || opt.type !== "select") return;
    const flat = (opt.options ?? []).flatMap((x: any) => x.options ?? [x]);
    const hit = flat.find((v: any) => v.value === m || v.value?.endsWith(m) || v.name === m);
    if (hit) await conn.setSessionConfigOption({ sessionId, configId: opt.id, value: hit.value } as any);
  }
}
