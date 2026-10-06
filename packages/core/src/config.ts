import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { AgentKind, Config } from "./types.js";

const AGENTS: AgentKind[] = ["claude-code", "codex", "gemini", "opencode", "openrouter", "acp"];

/** Yapılandırma dosyası yoksa ya da eksikse kullanılan varsayılanlar (önceden npm ile kurulunca örnek dosya bulunamıyor ve çöküyordu). */
export const DEFAULT_CONFIG: Config = {
  conductor: { agent: "claude-code", model: "opus" },
  workers: [
    { id: "w1", agent: "claude-code", model: "sonnet", strengths: ["refactor", "feature", "multi-file"] },
    { id: "w2", agent: "codex", model: "", strengths: ["bugfix", "tests"] },
    { id: "w3", agent: "opencode", model: "opencode/big-pickle", strengths: ["docs", "small-edit", "boilerplate"] },
  ],
  providers: { openrouter: { apiKeyEnv: "OPENROUTER_API_KEY" } },
  gates: [],
  budget: { maxTokensPerTask: 60000, maxRetries: 2 },
  limits: { pauseAtPercent: 95, resumeDelaySec: 60, allowAccountFailover: false },
  memory: { dir: ".orkestra/memory", maxInjectTokens: 1200 },
};

/** Kapı belirtilmemişse projeden çıkar: yanlış varsayılan kapı (ör. npm olmayan repoda `npm test`) her görevi başarısız sayardı. */
export function detectGates(cwd: string): string[] {
  try { const pkg = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8"));
    if (pkg.scripts?.test && !/no test specified/.test(pkg.scripts.test)) return ["npm test --silent"]; } catch {}
  if (existsSync(join(cwd, "Cargo.toml"))) return ["cargo test -q"];
  if (existsSync(join(cwd, "go.mod"))) return ["go test ./..."];
  if (existsSync(join(cwd, "pyproject.toml")) || existsSync(join(cwd, "pytest.ini"))) return ["python -m pytest -q"];
  return [];
}

export function validateConfig(c: Config): string[] {
  const e: string[] = [];
  if (!AGENTS.includes(c.conductor?.agent)) e.push(`conductor.agent geçersiz: ${c.conductor?.agent}`);
  if (!Array.isArray(c.workers) || !c.workers.length) e.push("en az bir işçi gerekli (workers)");
  const ids = new Set<string>();
  for (const w of Array.isArray(c.workers) ? c.workers : []) {
    if (!w.id) e.push("her işçinin id'si olmalı");
    else if (ids.has(w.id)) e.push(`yinelenen işçi id'si: ${w.id}`); else ids.add(w.id);
    if (!AGENTS.includes(w.agent)) e.push(`${w.id}: agent geçersiz (${w.agent}); geçerliler: ${AGENTS.join(", ")}`);
    if (!Array.isArray(w.strengths)) w.strengths = [];
    w.model ??= "";
  }
  if (!(c.limits.pauseAtPercent > 0 && c.limits.pauseAtPercent <= 100)) e.push("limits.pauseAtPercent 1-100 arası olmalı");
  if (!(c.budget.maxRetries >= 0)) e.push("budget.maxRetries ≥ 0 olmalı");
  if (!Array.isArray(c.gates)) e.push("gates bir komut dizisi olmalı");
  return e;
}

/** orkestra.config.json'ı varsayılanlarla birleştirir ve doğrular. */
export function loadConfig(cwd: string): Config {
  const f = join(cwd, "orkestra.config.json");
  let user: Partial<Config> = {};
  if (existsSync(f)) {
    try { user = JSON.parse(readFileSync(f, "utf8")); }
    catch (e: any) { throw new Error(`orkestra.config.json okunamadı: ${e.message}`); }
  }
  const d = DEFAULT_CONFIG;
  const cfg: Config = {
    conductor: { ...d.conductor, ...user.conductor },
    workers: user.workers ?? structuredClone(d.workers),
    providers: { ...d.providers, ...user.providers },
    gates: user.gates ?? detectGates(cwd),
    budget: { ...d.budget, ...user.budget },
    limits: { ...d.limits, ...user.limits },
    memory: { ...d.memory, ...user.memory },
  };
  const errs = validateConfig(cfg);
  if (errs.length) throw new Error(`orkestra.config.json hatalı:\n- ${errs.join("\n- ")}`);
  return cfg;
}
