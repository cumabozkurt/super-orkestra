import { execFileSync } from "node:child_process";
import { discoverOpenRouterModels } from "../workers/openrouter.js";

/** Tüm sağlayıcıların modellerini otomatik keşfet: opencode (`opencode models`) + OpenRouter (/models). */
export async function discoverAllModels() {
  const out: { provider: string; id: string; free?: boolean }[] = [];
  try {
    const bin = process.env.ORKESTRA_BIN_OPENCODE ?? "opencode";
    const txt = execFileSync(bin, ["models"], { encoding: "utf8", timeout: 60_000, shell: process.platform === "win32" });
    for (const l of txt.split("\n").map(s => s.trim()).filter(s => /^[\w.-]+\/[\w.:/-]+$/.test(s))) out.push({ provider: "opencode", id: l, free: /free|big-pickle/.test(l) });
  } catch { /* opencode kurulu değil */ }
  try { for (const m of await discoverOpenRouterModels()) out.push({ provider: "openrouter", id: m.id, free: m.promptPrice === 0 }); } catch { /* ağ yok */ }
  return out;
}
