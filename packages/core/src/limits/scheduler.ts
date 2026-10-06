import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, rmdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { orkHome, type TaskBrief } from "../types.js";
import type { Worktree } from "../workers/worktree.js";

export interface ResumeJob { brief: TaskBrief; workerId: string; sessionId?: string; at: number; cwd?: string; worktree?: Worktree }
/**
 * Kalıcı devam zamanlayıcısı: diske yazılır, uyku/yeniden başlatma sonrası da çalışır.
 * Süre dolunca aynı oturum `claude -r <id>` / `codex exec resume <id>` ile "Kaldığın yerden devam et" diye sürdürülür.
 */
export class ResumeScheduler {
  private file = join(orkHome(), "resume-queue.json");
  private timer?: NodeJS.Timeout;
  constructor(private onDue: (job: ResumeJob) => Promise<void>) {}
  private load(): ResumeJob[] { return existsSync(this.file) ? JSON.parse(readFileSync(this.file, "utf8")) : []; }
  /** Atomik yazım (yarım dosya kalmaz). */
  private save(j: ResumeJob[]) { mkdirSync(dirname(this.file), { recursive: true }); const tmp = `${this.file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(j, null, 2)); renameSync(tmp, this.file); }
  /** Süreçler arası kilit: `orkestra run` ile `resume-daemon` aynı işi iki kez sürdürmesin. 60 sn'den eski kilit bayat sayılır. */
  private locked<T>(fn: () => T): T | undefined {
    const lock = this.file + ".lock"; mkdirSync(dirname(this.file), { recursive: true });
    try { mkdirSync(lock); } catch { try { if (Date.now() - statSync(lock).mtimeMs > 60_000) { rmdirSync(lock); mkdirSync(lock); } else return; } catch { return; } }
    try { return fn(); } finally { try { rmdirSync(lock); } catch {} }
  }
  schedule(job: ResumeJob) { for (let i = 0; i < 50; i++) if (this.locked(() => { this.save([...this.load(), job]); return true; })) break; this.arm(); }
  pending(cwd?: string) { return this.load().filter(j => !cwd || j.cwd === cwd); }
  stop() { if (this.timer) clearInterval(this.timer); this.timer = undefined; }
  /** Her 30 sn kontrol: setTimeout uzun uykularda kayar, bu yüzden duvar saatiyle karşılaştırırız. */
  arm(keepAlive = false, everyMs = 30_000) {
    if (this.timer) { if (keepAlive) this.timer.ref?.(); return; }
    this.timer = setInterval(async () => {
      const now = Date.now() / 1000;
      const due = this.locked(() => { const jobs = this.load(); const d = jobs.filter(j => j.at <= now); if (d.length) this.save(jobs.filter(j => j.at > now)); return d; }) ?? [];
      if (!due.length) return;
      for (const j of due) await this.onDue(j).catch(() => this.schedule({ ...j, at: now + 600 }));
    }, everyMs);
    if (!keepAlive) this.timer.unref?.();
  }
}
