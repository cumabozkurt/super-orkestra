import type { TaskBrief, Worker, WorkerConfig, WorkResult } from "../types.js";
import { briefToPrompt } from "./cli-stream.js";
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Modelin döndürdüğü diff'i çalışma dizinine uygular (önce --check). */
export function applyDiff(cwd: string, text: string): { ok: boolean; error?: string } {
  const fence = text.match(/```(?:diff|patch)?\s*\n([\s\S]*?)```/); let diff = (fence ? fence[1] : text).trim();
  const start = diff.search(/^(diff --git|--- )/m); if (start < 0) return { ok: false, error: "yanıtta diff yok" };
  diff = diff.slice(start) + "\n";
  const d = mkdtempSync(join(tmpdir(), "ork-")); const f = join(d, "p.diff"); writeFileSync(f, diff);
  try { for (const extra of [[], ["--3way"]]) { try { execFileSync("git", ["apply", "--recount", "--whitespace=nowarn", ...extra, f], { cwd, stdio: "pipe" }); return { ok: true }; } catch (e: any) { if (extra.length) throw e; } } return { ok: false }; }
  catch (e: any) { return { ok: false, error: String(e.stderr ?? e.message).slice(0, 500) }; }
  finally { rmSync(d, { recursive: true, force: true }); }
}

/** OpenRouter (OpenAI uyumlu). Modeller /models uç noktasından otomatik keşfedilir. */
export async function discoverOpenRouterModels(baseUrl = "https://openrouter.ai/api/v1") {
  const r = await fetch(`${baseUrl}/models`);
  const j: any = await r.json();
  return (j.data as any[]).map(m => ({ id: m.id, ctx: m.context_length, promptPrice: Number(m.pricing?.prompt ?? 0) }));
}

/** "auto:cheapest-capable" -> bağlam penceresi yeterli en ucuz kodlama modelini seç. */
export async function resolveModel(spec: string, minCtx = 64000) {
  if (!spec.startsWith("auto:")) return spec;
  const models = (await discoverOpenRouterModels()).filter(m => m.ctx >= minCtx && /code|coder|sonnet|gpt|qwen|deepseek|glm|kimi/i.test(m.id));
  return models.sort((a, b) => a.promptPrice - b.promptPrice)[0]?.id ?? "openrouter/auto";
}

/** Not: OpenRouter işçisi dosya düzenleme için opencode/ACP ajanı üzerinden de koşturulabilir; bu sınıf diff üreten hafif yoldur. */
export class OpenRouterWorker implements Worker {
  constructor(public config: WorkerConfig, private apiKey = process.env.OPENROUTER_API_KEY ?? "") {}
  async run(brief: TaskBrief, opts: { cwd: string } = { cwd: process.cwd() }): Promise<WorkResult> {
    const zero = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
    if (!this.apiKey) return { taskId: brief.id, workerId: this.config.id, ok: false, summary: "OPENROUTER_API_KEY tanımlı değil", usage: zero };
    const model = await resolveModel(this.config.model);
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, usage: { include: true }, messages: [
        { role: "system", content: "Sadece unified diff döndür, ardından '---ÖZET---' ve 3 satır özet." },
        { role: "user", content: briefToPrompt(brief) }] }),
    });
    if (r.status === 429) return { taskId: brief.id, workerId: this.config.id, ok: false, summary: "429", usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      limitHit: { provider: "openrouter", resetsAt: Math.floor(Date.now() / 1000) + 60 } };
    if (!r.ok) return { taskId: brief.id, workerId: this.config.id, ok: false, summary: `OpenRouter HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`, usage: zero };
    const j: any = await r.json();
    const text: string = j.choices?.[0]?.message?.content ?? "";
    const [diff, summary = ""] = text.split("---ÖZET---");
    // Önceden diff hiç uygulanmıyordu: worktree boş kalıyor, şef her seferinde "fix" diyordu.
    const applied = applyDiff(opts.cwd, diff);
    return { taskId: brief.id, workerId: this.config.id, ok: applied.ok, diff, summary: applied.ok ? summary : `Diff uygulanamadı: ${applied.error}\n${summary}`,
      usage: { input: j.usage?.prompt_tokens ?? 0, output: j.usage?.completion_tokens ?? 0, cacheRead: j.usage?.prompt_tokens_details?.cached_tokens ?? 0, cacheWrite: 0 } };
  }
}
