#!/usr/bin/env node
import "./quiet.js";
import { spawnSync } from "node:child_process";
import { Command } from "commander";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  Conductor, LlmPlanner, loadConfig, Memory, LimitTracker, ResumeScheduler, makeWorker, buildRepoMapAsync, startMcp,
  discoverAllModels, type Config,
} from "super-orkestra-core";

let running = 0; const busy = () => running > 0;
export function boot(cwd = process.cwd(), quiet = false) {
  const cfg = loadConfig(cwd);
  const memory = new Memory(join(cwd, cfg.memory.dir));
  const limits = new LimitTracker(cfg.limits.pauseAtPercent);
  const workers = new Map(cfg.workers.map(w => [w.id, makeWorker(w)]));
  let conductor!: Conductor;
  const scheduler = new ResumeScheduler(async job => {
    if (!quiet) console.log(`▶ Limit sıfırlandı, devam: ${job.brief.id} (${job.workerId})`);
    // İş başka bir projeye aitse o projenin şefini kur (resume-daemon tüm projeleri sürdürür)
    const k = job.cwd && job.cwd !== cwd ? boot(job.cwd, quiet).conductor : conductor;
    running++; const r = await k.runTask(job.brief, 0, [], { workerId: job.workerId, sessionId: job.sessionId, worktree: job.worktree }).finally(() => running--);
    if (!quiet) console.log(`■ Devam sonucu ${job.brief.id}: ${r}`);
  });
  conductor = new Conductor(cfg, new LlmPlanner(cfg, cwd), workers, memory, limits, scheduler, cwd);
  if (!quiet) {
    conductor.on("plan", t => console.log(`📋 Plan: ${t.length} görev\n${t.map((x: any) => `   ${x.id} [${x.complexity}] ${x.goal}`).join("\n")}`));
    conductor.on("assign", e => console.log(`→ ${e.task} → ${e.worker} (${e.model})${e.attempt ? ` deneme ${e.attempt + 1}` : ""}`));
    conductor.on("gates", e => console.log(`🧪 ${e.task} kapılar: ${e.ok ? "geçti" : "KALDI"}`));
    conductor.on("review", e => console.log(`🔎 ${e.task}: ${e.verdict} — ${e.note}`));
    conductor.on("handoff", e => console.log(`↪ ${e.task}: ${e.from} → ${e.to} (${e.reason})`));
    conductor.on("paused", e => console.log(`⏸ ${e.task} limitte; otomatik devam ${new Date(e.until * 1000).toLocaleString()}`));
    conductor.on("done", e => console.log(`✅ ${e.task} (${e.worker})`));
    conductor.on("failed", e => console.log(`❌ ${e.task}: ${e.note}`));
    conductor.on("warn", m => console.log(`⚠ ${m}`));
  }
  return { cfg, memory, limits, scheduler, conductor };
}

function usageReport(cwd: string) {
  const f = join(cwd, ".orkestra", "usage.jsonl"); if (!existsSync(f)) return { tasks: 0, byWorker: {} };
  const byWorker: Record<string, { runs: number; input: number; output: number; cacheRead: number }> = {};
  const conductor = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  for (const l of readFileSync(f, "utf8").trim().split("\n")) {
    let e: any; try { e = JSON.parse(l); } catch { continue; } // yarım yazılmış satır
    if (e.kind === "work") { const w = (byWorker[e.worker] ??= { runs: 0, input: 0, output: 0, cacheRead: 0 }); w.runs++; w.input += e.usage.input; w.output += e.usage.output; w.cacheRead += e.usage.cacheRead; }
    const d = e.conductorDelta; if (d) for (const k of Object.keys(conductor) as (keyof typeof conductor)[]) conductor[k] += d[k] ?? 0;
  }
  return { byWorker, conductor };
}

const VERSION: string = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "package.json"), "utf8")).version;
/** `orkestra run -` hedefi stdin'den okur (çok satırlı/tırnaklı hedefler kabuk kaçışına takılmaz; VS Code bunu kullanır). */
/** "-" argümanı: metin ORKESTRA_INPUT ortam değişkeninden (masaüstü/VS Code; kabuk kaçışı gerekmez) ya da stdin'den okunur. */
const readStdin = async () => { if (process.env.ORKESTRA_INPUT !== undefined) return process.env.ORKESTRA_INPUT.trim(); let s = ""; for await (const c of process.stdin) s += c; return s.trim(); };
const p = new Command("super-orkestra").description("Super Orkestra — şef model + 3 işçi model · minimum token · kalıcı hafıza · limit sonrası otomatik devam").version(VERSION);
p.command("run <goal...>").description("Hedefi ver; şef planlar, dağıtır, denetler").action(async (g: string[]) => {
  const goal = g.length === 1 && g[0] === "-" ? await readStdin() : g.join(" ");
  if (!goal) { console.error("Hedef boş."); process.exitCode = 2; return; }
  const cwd = process.cwd(); const { conductor, scheduler, cfg } = boot(cwd);
  const res = await conductor.execute(goal, await buildRepoMapAsync(cwd, 1500, goal));
  console.log("Sonuç:", JSON.stringify(res));
  console.log("Token:", JSON.stringify(usageReport(cwd)));
  if (Object.values(res).includes("paused")) {
    console.log("Bekleyen devam görevi var; limit sıfırlanınca otomatik sürdürülecek (Ctrl+C ile çıkıp `orkestra resume-daemon` da kullanabilirsiniz).");
    scheduler.arm(true, Number(process.env.ORKESTRA_TICK_MS ?? 30_000));
    const t = setInterval(() => { if (!scheduler.pending(cwd).length && !busy()) { clearInterval(t); scheduler.stop(); console.log("Token:", JSON.stringify(usageReport(cwd))); } }, 2000);
  }
  void cfg;
});
p.command("mcp").description("MCP sunucusu (stdio) olarak çalış").action(async () => { const cwd = process.cwd(); const b = boot(cwd, true); await startMcp(b.conductor, b.memory, b.limits, f => buildRepoMapAsync(cwd, 1500, f ?? ""), VERSION); });
p.command("limits").description("Abonelik limit durumu (JSON)").action(() => { const l = new LimitTracker(); l.refresh(); console.log(JSON.stringify(l.snapshot(), null, 2)); });
p.command("usage").description("Token kullanım özeti (JSON)").action(() => console.log(JSON.stringify(usageReport(process.cwd()), null, 2)));
p.command("map").description("Repo haritasını göster").option("-t, --tokens <n>", "token bütçesi", "1500").option("-f, --focus <metin>", "hedefe odakla", "").action(async (o: any) => console.log(await buildRepoMapAsync(process.cwd(), Number(o.tokens), o.focus)));
p.command("resume-daemon").description("Limit sıfırlanınca bekleyen oturumları sürdüren arka plan servisi").action(() => {
  const { scheduler } = boot(); console.log(`Bekleyen devam görevi: ${scheduler.pending().length}`); scheduler.arm(true);
});
p.command("models").description("opencode + OpenRouter modellerini keşfet (JSON)").option("--free", "sadece ücretsiz").action(async (o: any) => {
  const all = await discoverAllModels(); console.log(JSON.stringify(o.free ? all.filter(m => m.free) : all, null, 2));
});
p.command("remember <text...>").description("Kalıcı hafızaya olgu ekle").action(async (t: string[]) => { const txt = t.length === 1 && t[0] === "-" ? await readStdin() : t.join(" ");
  if (!txt) { console.error("Metin boş."); process.exitCode = 2; return; } boot(process.cwd(), true).memory.remember(txt); console.log("Kaydedildi."); });
p.command("recall <query...>").description("Hafızadan getir").action(async (q: string[]) => console.log(boot(process.cwd(), true).memory.recall(q.length === 1 && q[0] === "-" ? await readStdin() : q.join(" "))));
p.command("statusline").description("Claude Code statusline kancası (5 saatlik/haftalık limitleri kaydeder). ~/.claude/settings.json: {\"statusLine\":{\"type\":\"command\",\"command\":\"super-orkestra statusline\"}}")
  .action(() => { const hook = join(dirname(fileURLToPath(import.meta.url)), "..", "hooks", "claude-statusline.mjs");
    const r = spawnSync(process.execPath, [hook], { stdio: "inherit" }); process.exitCode = r.status ?? 0; });
p.parseAsync().catch(e => { console.error(`orkestra: ${e?.message ?? e}`); process.exitCode = 1; });
