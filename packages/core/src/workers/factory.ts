import type { TaskBrief, Worker, WorkerConfig, WorkResult } from "../types.js";
import { CliWorker } from "./cli-stream.js";
import { OpenRouterWorker } from "./openrouter.js";
import { AcpWorker } from "./acp.js";

/** ACP dener; protokol/oturum hatasında (limit değilse) aynı görevi headless CLI ile yeniden koşar. */
class AutoWorker implements Worker {
  private acp: AcpWorker; private cli: CliWorker;
  constructor(public config: WorkerConfig) { this.acp = new AcpWorker(config); this.cli = new CliWorker(config); }
  async run(b: TaskBrief, o: { cwd: string; resumeSessionId?: string; signal?: AbortSignal }): Promise<WorkResult> {
    const r = await this.acp.run(b, o);
    if (r.ok || r.limitHit || r.usage.output > 0) return r;
    return this.cli.run(b, o);
  }
}

export type Transport = "auto" | "acp" | "cli";
/**
 * Taşıma seçimi. Doğal ACP konuşan ajanlarda (opencode, gemini) varsayılan "auto": ACP dener, düşerse headless CLI.
 * (opencode'un `session/new` "service failure (directory)" hatası HTTP(S)_PROXY kaynaklıydı; agentEnv() NO_PROXY ile çözdü,
 * 2026-10-07'de opencode 1.18.35 ile ACP yeni oturum + loadSession devamı gerçek modelle doğrulandı.)
 * Claude Code / Codex için ACP npx adaptörü gerektirdiğinden varsayılan "cli".
 */
export function makeWorker(c: WorkerConfig & { transport?: Transport }): Worker {
  if (c.agent === "openrouter") return new OpenRouterWorker(c);
  const t: Transport = c.transport ?? (process.env.ORKESTRA_TRANSPORT as Transport | undefined) ?? (["opencode", "gemini"].includes(c.agent) ? "auto" : "cli");
  if (c.agent === "acp" || t === "acp") return new AcpWorker(c);
  if (t === "auto") return new AutoWorker(c);
  return new CliWorker(c);
}
