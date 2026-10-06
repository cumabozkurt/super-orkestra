import { homedir } from "node:os";
import { join } from "node:path";
/** Orkestra'nın kullanıcı düzeyi dizini (kuyruk, limitler, worktree'ler). ORKESTRA_HOME ile değiştirilebilir. */
export const orkHome = () => process.env.ORKESTRA_HOME ?? join(homedir(), ".orkestra");

export type AgentKind = "claude-code" | "codex" | "gemini" | "opencode" | "openrouter" | "acp";

export interface WorkerConfig { id: string; agent: AgentKind; model: string; strengths: string[]; }
export interface Config {
  conductor: { agent: AgentKind; model: string };
  workers: WorkerConfig[];
  providers: Record<string, any>;
  gates: string[];
  budget: { maxTokensPerTask: number; maxRetries: number };
  limits: { pauseAtPercent: number; resumeDelaySec: number; allowAccountFailover: boolean };
  memory: { dir: string; maxInjectTokens: number };
}

/** Şefin işçiye verdiği kısa, kendi içinde yeterli görev brifi (tam transcript ASLA gönderilmez). */
export interface TaskBrief {
  id: string;
  goal: string;
  files: string[];          // sadece dokunulacak dosyalar
  context: string;          // repo map dilimi + ilgili hafıza (token bütçeli)
  acceptance: string[];     // kabul kriterleri
  complexity: "trivial" | "small" | "medium" | "hard";
  tags: string[];
}

export interface WorkResult {
  taskId: string; workerId: string; sessionId?: string;
  ok: boolean; diff?: string; summary: string;
  usage: { input: number; output: number; cacheRead: number; cacheWrite: number };
  limitHit?: { resetsAt: number; provider: string };
}

export interface Worker {
  config: WorkerConfig;
  run(brief: TaskBrief, opts: { cwd: string; resumeSessionId?: string; signal?: AbortSignal }): Promise<WorkResult>;
}
