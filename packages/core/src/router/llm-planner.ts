import type { Planner, Review } from "./conductor.js";
import type { Config, TaskBrief, WorkResult } from "../types.js";
import { runCli } from "../workers/cli-stream.js";
import { refSafe } from "../workers/worktree.js";

/**
 * Şef modeli headless ve ARAÇSIZ çağırır: tek tur, katı JSON çıktı -> minimum çıktı token'ı.
 * Şef dosya okumaz; repo haritası + hafıza + diff + kapı çıktısı yeter.
 */
export class LlmPlanner implements Planner {
  usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  constructor(private cfg: Config, private cwd: string) {}

  private async ask(prompt: string): Promise<string> {
    const { agent, model } = this.cfg.conductor;
    const { parsed, raw } = await runCli(agent, model, prompt, this.cwd, { timeoutMs: 10 * 60_000 });
    for (const k of Object.keys(this.usage) as (keyof typeof this.usage)[]) this.usage[k] += parsed.usage[k];
    return parsed.text || raw;
  }

  static extractJson<T>(text: string, open: "[" | "{"): T {
    const close = open === "[" ? "]" : "}";
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const src = fence ? fence[1] : text;
    const s = src.indexOf(open), e = src.lastIndexOf(close);
    if (s < 0 || e < s) throw new Error(`Şef geçerli JSON döndürmedi: ${text.slice(0, 300)}`);
    return JSON.parse(src.slice(s, e + 1));
  }

  async plan(goal: string, repoMap: string, memory: string): Promise<TaskBrief[]> {
    const workers = this.cfg.workers.map(w => `${w.id}(${w.strengths.join("/")})`).join(", ");
    const prompt = `Sen şef mühendissin. KOD YAZMA, DOSYA OKUMA, ARAÇ KULLANMA. Sadece plan çıkar.
Hedefi EN AZ sayıda bağımsız göreve böl (çoğu hedef için 1 görev, en fazla 3). Doğrulama/test koşma için ayrı görev AÇMA: testleri sistem otomatik koşar. Hedef açıkça istemedikçe mevcut testleri değiştirme görevi verme. Yalnızca JSON dizi döndür, başka hiçbir şey yazma:
[{"id":"t1","goal":"...","files":["..."],"context":"≤120 kelime, sadece o görev için gerekeni","acceptance":["test edilebilir kriter"],"complexity":"trivial|small|medium|hard","tags":["refactor|bugfix|tests|docs|feature|small-edit|..."]}]
İşçiler: ${workers}
HEDEF: ${goal}
HAFIZA:
${memory || "(boş)"}
REPO HARİTASI:
${repoMap || "(boş)"}`;
    let tasks: TaskBrief[];
    try { tasks = LlmPlanner.extractJson<TaskBrief[]>(await this.ask(prompt), "["); }
    catch { tasks = LlmPlanner.extractJson<TaskBrief[]>(await this.ask(`${prompt}\n\nÖNEMLİ: Önceki yanıtın geçerli JSON değildi. YALNIZCA JSON dizi döndür.`), "["); }
    return LlmPlanner.normalizeTasks(tasks, goal);
  }

  /** Şef çıktısını güvenli hale getirir: yinelenen/eksik id, geçersiz karmaşıklık, boş plan. */
  static normalizeTasks(tasks: any, goal: string): TaskBrief[] {
    const list: any[] = Array.isArray(tasks) ? tasks.filter(t => t && typeof t.goal === "string" && t.goal.trim()) : [];
    if (!list.length) list.push({ goal, files: [], acceptance: [], complexity: "small", tags: [] }); // boş plan: hedefin kendisi tek görev
    const seen = new Set<string>(); const C = ["trivial", "small", "medium", "hard"];
    return list.map((t, i) => {
      let id = refSafe(String(t.id || `t${i + 1}`)); while (seen.has(id)) id = `${id}-${i + 1}`; seen.add(id);
      return { id, goal: t.goal, files: Array.isArray(t.files) ? t.files : [], context: typeof t.context === "string" ? t.context : "",
        acceptance: Array.isArray(t.acceptance) ? t.acceptance : [], complexity: C.includes(t.complexity) ? t.complexity : "small",
        tags: Array.isArray(t.tags) ? t.tags : [] };
    });
  }

  async review(b: TaskBrief, r: WorkResult, gateLog: string): Promise<Review> {
    const prompt = `Sen şef denetçisin. ARAÇ KULLANMA. Sadece JSON döndür: {"verdict":"accept|fix|reassign","note":"≤50 kelime somut düzeltme talimatı"}
fix = aynı işçi düzeltsin, reassign = işçi yetersiz, başkasına ver.
GÖREV: ${b.goal}
KABUL: ${b.acceptance.join("; ")}
İŞÇİ ÖZETİ: ${r.summary.slice(0, 1200)}
DIFF: ${(r.diff ?? "(yok)").slice(0, 4000)}
KAPI ÇIKTISI: ${gateLog || "(kapı tanımlı değil)"}`;
    try { const r = LlmPlanner.extractJson<Review>(await this.ask(prompt), "{");
      const v = String(r.verdict ?? "").toLowerCase();
      return { verdict: v === "accept" || v === "fix" || v === "reassign" ? v : "fix", note: String(r.note ?? "") }; }
    catch { return { verdict: "fix", note: "Denetim yanıtı okunamadı; kabul kriterlerini yeniden kontrol et." }; }
  }
}
