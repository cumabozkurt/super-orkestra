import type { TaskBrief, WorkerConfig } from "../types.js";

/**
 * Ucuz, sıfır-token yönlendirme (RouteLLM / OpenHands Model Router fikri).
 * Önce kural tabanlı skor; belirsizse (skor farkı < eşik) şef modele tek satırlık soru sorulur.
 */
const COST_RANK: Record<string, number> = { trivial: 0, small: 1, medium: 2, hard: 3 };

export function scoreWorker(brief: TaskBrief, w: WorkerConfig, index: number): number {
  const tagHits = brief.tags.filter(t => w.strengths.includes(t)).length;
  // Basit iş -> listedeki daha ucuz işçi (sonraki index'ler ucuz kabul edilir), zor iş -> güçlü işçi.
  const costFit = brief.complexity === "hard" ? -index : index * (3 - COST_RANK[brief.complexity]) / 3;
  return tagHits * 2 + costFit;
}

export function pickWorker(brief: TaskBrief, workers: WorkerConfig[], exclude: string[] = []) {
  const ranked = workers
    .map((w, i) => ({ w, s: scoreWorker(brief, w, i) }))
    .filter(x => !exclude.includes(x.w.id))
    .sort((a, b) => b.s - a.s);
  if (!ranked.length) throw new Error("Uygun işçi yok (hepsi limitte veya hariç tutuldu)");
  const ambiguous = ranked.length > 1 && ranked[0].s - ranked[1].s < 0.5;
  return { worker: ranked[0].w, ambiguous, ranked };
}
