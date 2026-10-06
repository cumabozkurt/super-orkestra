import { EventEmitter } from "node:events";
import { appendFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Config, TaskBrief, Worker, WorkResult } from "../types.js";
import { pickWorker } from "./classifier.js";
import { runGates } from "./gates.js";
import { Memory } from "../memory/memory.js";
import { LimitTracker } from "../limits/tracker.js";
import { ResumeScheduler } from "../limits/scheduler.js";
import { createWorktree, worktreeDiff, mergeWorktree, removeWorktree, isGitRepo, ensureIgnored, type Worktree } from "../workers/worktree.js";

export interface ResumeState { workerId: string; sessionId?: string; worktree?: Worktree }
export interface Review { verdict: "accept" | "fix" | "reassign"; note: string }
export interface Planner {
  plan(goal: string, repoMap: string, memory: string): Promise<TaskBrief[]>;
  review(brief: TaskBrief, result: WorkResult, gateLog: string): Promise<Review>;
  usage?: WorkResult["usage"];
}

/**
 * Şef (conductor): plan + denetim. Dosya okumaz; repo haritası, diff ve kapı (test/lint) sonuçlarını görür.
 * Task Ledger (plan) + Progress Ledger (usage.jsonl / progress.md). İşçiler izole git worktree'lerde çalışır.
 */
export class Conductor extends EventEmitter {
  private ledger: string;
  constructor(
    private cfg: Config, private planner: Planner, private workers: Map<string, Worker>,
    private memory: Memory, private limits: LimitTracker, private scheduler: ResumeScheduler, private cwd: string,
  ) {
    super();
    mkdirSync(join(cwd, ".orkestra"), { recursive: true });
    this.ledger = join(cwd, ".orkestra", "usage.jsonl");
    if (isGitRepo(cwd)) ensureIgnored(cwd);
  }

  private lastCU = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  /** Şef kullanımı süreç boyunca birikimli; deftere yalnızca son kayıttan bu yana artışı yaz (çoklu koşuda toplam doğru çıksın). */
  private cuDelta() { const u = this.planner.usage; if (!u) return undefined;
    const d = { input: u.input - this.lastCU.input, output: u.output - this.lastCU.output, cacheRead: u.cacheRead - this.lastCU.cacheRead, cacheWrite: u.cacheWrite - this.lastCU.cacheWrite };
    this.lastCU = { ...u }; return d; }
  private log(entry: object) { appendFileSync(this.ledger, JSON.stringify({ ts: Date.now(), ...entry }) + "\n"); }

  async execute(goal: string, repoMap: string) {
    const mem = this.memory.recall(goal, this.cfg.memory.maxInjectTokens);
    const tasks = await this.planner.plan(goal, repoMap, mem);
    this.emit("plan", tasks);
    this.log({ kind: "plan", goal, tasks: tasks.map(t => t.id), conductorDelta: this.cuDelta() });
    const results: Record<string, string> = {};
    for (const t of tasks) results[t.id] = await this.runTask(t);
    const ok = Object.values(results).every(r => r === "done");
    this.memory.remember(`Hedef ${ok ? "tamamlandı" : "kısmen tamamlandı"}: ${goal} (${Object.entries(results).map(([k, v]) => `${k}=${v}`).join(", ")})`, ["outcome"]);
    this.memory.appendProgress(`${ok ? "✅" : "⚠️"} ${goal}`);
    this.emit("finished", { goal, results });
    return results;
  }

  /** Görev başına harcanan (önbellek dışı) token; budget.maxTokensPerTask aşılınca yeni deneme açılmaz. */
  private spent = new Map<string, number>();
  private overBudget(id: string) { const max = this.cfg.budget.maxTokensPerTask; return max > 0 && (this.spent.get(id) ?? 0) >= max; }

  async runTask(brief: TaskBrief, attempt = 0, exclude: string[] = [], resume?: ResumeState): Promise<string> {
    exclude = [...new Set([...exclude, ...this.limits.blockedWorkers(this.cfg.workers)])];
    // Devam:
    //  a) oturumu açan işçi müsait ve oturum kimliği var -> aynı oturum + aynı worktree (önbellek sıcak, en ucuz)
    //  b) aksi halde yarım worktree KORUNUR ve herhangi bir müsait işçiye (tercihen sahibine) mevcut diff ile birlikte devredilir
    let resumeSessionId: string | undefined; let wt: Worktree | undefined; let carry: Worktree | undefined; let preferred;
    if (resume) {
      const owner = this.cfg.workers.find(w => w.id === resume.workerId);
      const ownerFree = !!owner && !exclude.includes(owner.id);
      const wtAlive = !!resume.worktree && existsSync(resume.worktree.path);
      if (ownerFree && resume.sessionId) { resumeSessionId = resume.sessionId; if (wtAlive) wt = resume.worktree; }
      else { if (wtAlive) carry = resume.worktree; if (ownerFree) preferred = owner; }
    }
    let wc;
    if (resumeSessionId) wc = this.cfg.workers.find(w => w.id === resume!.workerId)!;
    else if (preferred) wc = preferred;
    else {
      try { wc = pickWorker(brief, this.cfg.workers, exclude).worker; }
      catch { return this.pauseUntilReset(brief, resume?.workerId ?? exclude[0] ?? this.cfg.workers[0].id, undefined, this.limits.earliestReset(this.cfg.workers), carry); }
    }
    let runBrief = brief;
    if (carry) {
      wt = carry; let d = ""; try { d = worktreeDiff(carry); } catch {}
      if (d.trim()) runBrief = { ...brief, context: `${brief.context}\n\nÖNCEKİ DENEME YARIM KALDI: bu çalışma dizininde aşağıdaki değişiklikler zaten var. Bunları koru, gözden geçir ve görevi tamamla; baştan yazma.\n${d.slice(0, 6000)}` };
      this.emit("carry", { task: brief.id, to: wc.id, diffBytes: d.length });
    }
    const worker = this.workers.get(wc.id)!;
    this.emit("assign", { task: brief.id, worker: wc.id, model: wc.model, attempt, resumed: !!resumeSessionId });

    const useWt = isGitRepo(this.cwd);
    try { if (useWt && !wt) wt = createWorktree(this.cwd, brief.id, wc.id); } catch (e) { this.emit("warn", `worktree açılamadı: ${e}`); }
    const runDir = wt?.path ?? this.cwd;

    const res = await worker.run(runBrief, { cwd: runDir, resumeSessionId });
    this.limits.record(wc, res);
    this.spent.set(brief.id, (this.spent.get(brief.id) ?? 0) + res.usage.input + res.usage.output);
    this.log({ kind: "work", task: brief.id, worker: wc.id, model: wc.model, attempt, ok: res.ok, usage: res.usage, limit: res.limitHit ?? null });

    if (res.limitHit) {
      const next = [...exclude, wc.id, ...this.limits.blockedWorkers(this.cfg.workers)];
      let alt; try { alt = pickWorker(brief, this.cfg.workers, next).worker; } catch { alt = undefined; } // devir mesajı gerçek seçimi göstersin
      if (alt) { // yarım iş atılmaz: worktree yeni işçiye diff ile devredilir
        this.emit("handoff", { task: brief.id, from: wc.id, to: alt.id, reason: "limit" });
        return this.runTask(brief, attempt, [...exclude, wc.id], wt ? { workerId: alt.id, worktree: wt } : undefined); }
      // Herkes limitte: yarım iş kaybolmasın diye worktree korunur, aynı işçi + aynı oturum + aynı worktree ile devam edilir.
      return this.pauseUntilReset(brief, wc.id, res.sessionId ?? resumeSessionId, res.limitHit.resetsAt, wt);
    }

    if (wt) res.diff = worktreeDiff(wt);
    const gate = await runGates(this.cfg.gates, runDir);
    this.emit("gates", { task: brief.id, ok: gate.ok });
    const big = (res.diff?.length ?? 0) > 8000;
    const empty = wt ? !res.diff?.trim() : false;
    const tampered = testsWeakened(res.diff ?? "");
    if (tampered) this.emit("warn", `${brief.id}: mevcut test satırları değiştirildi/silindi — şef denetimine zorlanıyor`);
    const needsReview = !gate.ok || big || empty || tampered || brief.complexity === "hard" || !res.ok;

    let review: Review = { verdict: "accept", note: "kapılar geçti" };
    if (needsReview) {
      review = await this.planner.review(brief, res, gate.log.slice(-3000));
      if (!gate.ok && review.verdict === "accept") review = { verdict: "fix", note: `Kapılar başarısız: ${gate.log.slice(-400)}` };
      this.emit("review", { task: brief.id, ...review });
      this.log({ kind: "review", task: brief.id, verdict: review.verdict, conductorDelta: this.cuDelta() });
    }

    if (review.verdict === "accept") {
      if (wt) {
        const m = mergeWorktree(this.cwd, wt, `${brief.id}: ${brief.goal.slice(0, 60)}`); removeWorktree(this.cwd, wt);
        if (!m.ok) { this.emit("review", { task: brief.id, verdict: "fix", note: "birleştirme çakışması" });
          return attempt < this.cfg.budget.maxRetries ? this.runTask({ ...brief, context: `${brief.context}\nÖnceki deneme ana dalla çakıştı.` }, attempt + 1, exclude) : "failed"; }
      }
      this.memory.remember(`${brief.id} (${brief.tags.join(",")}) ${wc.id}/${wc.model} ile çözüldü: ${res.summary.slice(0, 200)}`, ["task", ...brief.tags]);
      this.emit("done", { task: brief.id, worker: wc.id });
      return "done";
    }

    if (wt) removeWorktree(this.cwd, wt);
    if (attempt >= this.cfg.budget.maxRetries) { this.emit("failed", { task: brief.id, note: review.note }); return "failed"; }
    if (this.overBudget(brief.id)) { const note = `token bütçesi aşıldı (${this.spent.get(brief.id)} ≥ ${this.cfg.budget.maxTokensPerTask}); son not: ${review.note}`;
      this.emit("failed", { task: brief.id, note }); this.log({ kind: "budget", task: brief.id, spent: this.spent.get(brief.id) }); return "failed"; }
    const fixed: TaskBrief = { ...brief, context: `${brief.context}\n\nŞef düzeltmesi (deneme ${attempt + 1}): ${review.note}` };
    // "fix": aynı işçi (önbellek sıcak), "reassign": başka işçi
    return review.verdict === "fix" ? this.runTask(fixed, attempt + 1, exclude) : this.runTask(fixed, attempt + 1, [...exclude, wc.id]);
  }

  private pauseUntilReset(brief: TaskBrief, workerId: string, sessionId?: string, resetsAt?: number, worktree?: Worktree) {
    const at = (resetsAt ?? Math.floor(Date.now() / 1000) + 3600) + this.cfg.limits.resumeDelaySec;
    this.scheduler.schedule({ brief, workerId, sessionId, at, cwd: this.cwd, worktree });
    this.emit("paused", { task: brief.id, until: at });
    this.log({ kind: "paused", task: brief.id, worker: workerId, until: at });
    return "paused";
  }
}

/** Kapıyı "geçmek" için mevcut testleri silme/zayıflatma girişimini yakalar (eklemeye izin verir). */
export function testsWeakened(diff: string): boolean {
  let file = "";
  for (const line of diff.split("\n")) {
    if (line.startsWith("--- ")) { file = line.slice(4).replace(/^a\//, ""); continue; }
    if (line.startsWith("+++ ")) { const f = line.slice(4); if (f !== "/dev/null") file = f.replace(/^b\//, ""); continue; }
    if (!/(^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[jt]sx?$|_test\.(go|py)$|^test_.*\.py$/.test(file)) continue;
    if (line.startsWith("-") && !line.startsWith("---") && /assert|expect|test\(|it\(|def test_/.test(line)) return true;
  }
  return false;
}
