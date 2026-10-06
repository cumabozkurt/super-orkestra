import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { orkHome, type WorkerConfig, type WorkResult } from "../types.js";

interface Window { usedPct: number; resetsAt: number; windowMin: number }
/**
 * Abonelik limit takibi:
 *  - Claude Code: statusline hook'u `rate_limits.five_hour/seven_day` JSON'unu ~/.orkestra/claude-limits.json'a yazar (hooks/statusline.mjs).
 *  - Codex: ~/.codex/sessions/**\/rollout-*.jsonl içindeki son token_count.rate_limits (pencereler süreye göre ayırt edilir).
 */
export class LimitTracker {
  private state = new Map<string, Window[]>();
  /** Çıktıdan yakalanan limitler ayrı tutulur: refresh() eski statusline/rollout verisiyle bunları silmesin. */
  private hits = new Map<string, Window>();
  constructor(private pauseAt = 95) {}

  refresh() {
    const cl = join(orkHome(), "claude-limits.json");
    if (existsSync(cl)) try {
      const j = JSON.parse(readFileSync(cl, "utf8"));
      this.state.set("claude-code", [j.five_hour, j.seven_day].filter(Boolean).map((w: any) => ({ usedPct: w.used_percentage, resetsAt: w.resets_at, windowMin: 0 })));
    } catch { /* statusline dosyası yazılırken okundu; bir sonraki turda */ }
    let cx: string | undefined; try { cx = latestCodexRollout(); } catch {}
    if (cx) {
      const lines = readFileSync(cx, "utf8").trim().split("\n").reverse();
      for (const l of lines) { try { const e = JSON.parse(l); const rl = e.payload?.rate_limits ?? e.rate_limits;
        if (rl) { this.state.set("codex", [rl.primary, rl.secondary].filter(Boolean).map((w: any) => ({ usedPct: w.used_percent,
          resetsAt: w.resets_at ?? Math.floor(Date.now() / 1000) + (w.resets_in_seconds ?? 0), windowMin: w.window_minutes }))); break; } } catch {} }
    }
  }
  /** Abonelik CLI'larında limit hesap geneli (aynı ajanın tüm işçileri durur); opencode/OpenRouter'da model başına. */
  private key(w: WorkerConfig) { return ["opencode", "openrouter"].includes(w.agent) ? `${w.agent}:${w.model}` : w.agent; }
  record(w: WorkerConfig, r: WorkResult) {
    if (r.limitHit) this.hits.set(this.key(w), { usedPct: 100, resetsAt: r.limitHit.resetsAt, windowMin: 300 });
  }
  isBlocked(w: WorkerConfig) {
    const now = Date.now() / 1000;
    return this.windows(w).some(x => x.usedPct >= this.pauseAt && x.resetsAt > now);
  }
  private windows(w: WorkerConfig) { const k = this.key(w); const h = this.hits.get(k); return [...(this.state.get(k) ?? []), ...(h ? [h] : [])]; }
  blockedWorkers(ws: WorkerConfig[]) { this.refresh(); return ws.filter(w => this.isBlocked(w)).map(w => w.id); }
  /** Tüm işçiler limitteyken en erken açılacak pencerenin zamanı (epoch sn). */
  earliestReset(ws: WorkerConfig[]): number | undefined {
    const now = Date.now() / 1000;
    const ends = ws.map(w => this.windows(w).filter(x => x.usedPct >= this.pauseAt && x.resetsAt > now).map(x => x.resetsAt))
      .filter(r => r.length).map(r => Math.max(...r)); // işçi, en geç kapanan penceresi açılınca serbest kalır
    return ends.length ? Math.min(...ends) : undefined;
  }
  snapshot() { const o: Record<string, Window[]> = Object.fromEntries(this.state);
    for (const [k, h] of this.hits) o[k] = [...(o[k] ?? []), h]; return o; }
}

function latestCodexRollout(): string | undefined {
  const base = join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "sessions"); if (!existsSync(base)) return;
  let best: [string, number] | undefined;
  const walk = (d: string, depth: number) => { for (const f of readdirSync(d)) { const p = join(d, f); const s = statSync(p);
    if (s.isDirectory() && depth < 4) walk(p, depth + 1); else if (f.startsWith("rollout-") && (!best || s.mtimeMs > best[1])) best = [p, s.mtimeMs]; } };
  walk(base, 0); return best?.[0];
}
