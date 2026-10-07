// v1.0.1 denetimi: bulunan hataların regresyon testleri (gerçek hesap/ağ gerektirmez).
import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, symlinkSync, utimesSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os"; import { join } from "node:path"; import { execSync, execFileSync } from "node:child_process";
import { ResumeScheduler } from "../packages/core/src/limits/scheduler.js";
import { Conductor, testsWeakened, type Planner } from "../packages/core/src/router/conductor.js";
import { Memory } from "../packages/core/src/memory/memory.js";
import { LimitTracker } from "../packages/core/src/limits/tracker.js";
import { LlmPlanner } from "../packages/core/src/router/llm-planner.js";
import { refSafe, createWorktree, removeWorktree } from "../packages/core/src/workers/worktree.js";
import { insideRootReal } from "../packages/core/src/workers/acp.js";
import { AcpWorker } from "../packages/core/src/workers/acp.js";
import { makeWorker } from "../packages/core/src/workers/factory.js";
import { validateConfig, DEFAULT_CONFIG } from "../packages/core/src/config.js";
import type { Config, TaskBrief, WorkResult } from "../packages/core/src/types.js";

const tmp = (p: string) => mkdtempSync(join(tmpdir(), p));
const brief: TaskBrief = { id: "t1", goal: "x=2 yap", files: ["x.txt"], context: "", acceptance: [], complexity: "small", tags: [] };
const U = { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 };
// Her test kendi ORKESTRA_HOME'unu kullanır (kuyruk/kilit testler arasında taşınmasın).
beforeEach(() => { process.env.ORKESTRA_HOME = join(tmp("hd-home-"), ".orkestra"); });
function repo() { const d = tmp("hd-"); execSync("git init -q && git config user.email t@t && git config user.name t", { cwd: d });
  writeFileSync(join(d, "x.txt"), "1\n"); execSync("git add -A && git commit -qm i", { cwd: d }); return d; }

describe("devam zamanlayıcısı", () => {
  it("arm() farklı aralıkla çağrılınca mevcut zamanlayıcıyı yeni aralıkla kurar (ORKESTRA_TICK_MS)", async () => {
    const seen: string[] = []; const s = new ResumeScheduler(async j => { seen.push(j.brief.id); });
    s.schedule({ brief, workerId: "w1", at: 1 }); // schedule() varsayılan 30 sn aralıkla kurar
    s.arm(false, 25);
    await new Promise(r => setTimeout(r, 400)); s.stop();
    expect(seen).toEqual(["t1"]); expect(s.pending().length).toBe(0);
  });
  it("bayat kilidi devralır, taze kilitte işi sessizce kaybetmek yerine hata verir", () => {
    const s = new ResumeScheduler(async () => {});
    const lock = join(process.env.ORKESTRA_HOME!, "resume-queue.json.lock"); mkdirSync(lock, { recursive: true });
    const old = new Date(Date.now() - 120_000); utimesSync(lock, old, old);
    s.schedule({ brief, workerId: "w1", at: 1 }); expect(s.pending().length).toBe(1);
    mkdirSync(lock);
    expect(() => s.schedule({ brief: { ...brief, id: "t2" }, workerId: "w1", at: 1 })).toThrow(/kilitli/);
    s.stop();
  }, 10_000);
});

describe("şef: reassign", () => {
  it("başka müsait işçi yoksa duraklatmaz, aynı işçiyle düzeltir", async () => {
    const d = repo();
    const c: Config = { ...structuredClone(DEFAULT_CONFIG), workers: [{ id: "w1", agent: "claude-code", model: "", strengths: [] }],
      gates: [`node -e "process.exit(require('fs').readFileSync('x.txt','utf8').includes('2')?0:1)"`], limits: { pauseAtPercent: 95, resumeDelaySec: 0, allowAccountFailover: false } };
    let n = 0;
    const w = { config: c.workers[0], async run(b: TaskBrief, o: { cwd: string }): Promise<WorkResult> {
      n++; if (n > 1) writeFileSync(join(o.cwd, "x.txt"), "2\n"); return { taskId: b.id, workerId: "w1", ok: true, summary: "", usage: U }; } };
    const verdicts = ["reassign", "accept"];
    const p: Planner = { async plan() { return [brief]; }, async review() { return { verdict: verdicts.shift() as any, note: "başkası denesin" }; } };
    const sched = new ResumeScheduler(async () => {});
    const k = new Conductor(c, p, new Map([["w1", w]]), new Memory(join(d, ".orkestra/memory")), new LimitTracker(), sched, d);
    expect(await k.runTask(brief)).toBe("done"); expect(n).toBe(2); expect(sched.pending().length).toBe(0);
    expect(readFileSync(join(d, "x.txt"), "utf8")).toBe("2\n");
  });
});

describe("worktree dal adları", () => {
  it("refSafe geçerli git dal parçası üretir", () => {
    for (const id of ["t1..2", ".gizli", "a.lock", "son.", "-x", "a b/c", "", "@{u}"]) {
      const r = refSafe(id); expect(r.length).toBeGreaterThan(0);
      execFileSync("git", ["check-ref-format", "--branch", `orkestra/${r}-w1-abc`]); // geçersizse fırlatır
    }
  });
  it("şefin '..' içeren görev kimliğiyle de izole worktree açılır", () => {
    const d = repo(); const wt = createWorktree(d, "t1..2", "w 1");
    expect(wt.path).not.toBe(d); removeWorktree(d, wt);
    expect(LlmPlanner.normalizeTasks([{ id: "..t1", goal: "a" }], "h")[0].id).toBe("t1");
  });
});

describe("test kurcalama koruması", () => {
  it("alt klasördeki test_*.py ve .test.mjs dosyalarını da tanır", () => {
    expect(testsWeakened("--- a/pkg/test_odeme.py\n+++ b/pkg/test_odeme.py\n-    assert toplam == 3\n")).toBe(true);
    expect(testsWeakened("--- a/src/a.test.mjs\n+++ b/src/a.test.mjs\n-expect(x).toBe(1)\n")).toBe(true);
    expect(testsWeakened("--- a/pkg/odeme.py\n+++ b/pkg/odeme.py\n-    assert x\n")).toBe(false);
  });
});

describe("ACP dosya erişimi: sembolik bağlantı kaçışı", () => {
  it("worktree içindeki bağlantı üzerinden dışarı erişim reddedilir", async () => {
    const root = tmp("acp-root-"), out = tmp("acp-out-");
    writeFileSync(join(out, "gizli.txt"), "x");
    try { symlinkSync(out, join(root, "kacis"), "junction"); } catch { return; } // bağlantı oluşturulamayan ortamda atla
    expect(await insideRootReal(root, "kacis/gizli.txt")).toBe(false);
    expect(await insideRootReal(root, "kacis/yeni/dosya.txt")).toBe(false);
    expect(await insideRootReal(root, "src/yeni/dosya.ts")).toBe(true);
    expect(await insideRootReal(root, "../disari.txt")).toBe(false);
  });
  it("ajan ikilisi yoksa süreç çökmez, başarısız sonuç döner", async () => {
    const prev = process.env.ORKESTRA_BIN_OPENCODE; process.env.ORKESTRA_BIN_OPENCODE = join(tmp("yok-"), "opencode-yok");
    try {
      const r = await new AcpWorker({ id: "w", agent: "opencode", model: "", strengths: [] }).run(brief, { cwd: tmp("acp-cwd-") });
      expect(r.ok).toBe(false); expect(r.limitHit).toBeUndefined();
    } finally { if (prev === undefined) delete process.env.ORKESTRA_BIN_OPENCODE; else process.env.ORKESTRA_BIN_OPENCODE = prev; }
  }, 30_000);
});

describe("yapılandırma", () => {
  it("şef olarak desteklenmeyen ajanı ve geçersiz transport'u reddeder", () => {
    const c = structuredClone(DEFAULT_CONFIG); c.conductor.agent = "openrouter";
    expect(validateConfig(c).join("\n")).toMatch(/conductor\.agent geçersiz/);
    const c2 = structuredClone(DEFAULT_CONFIG); (c2.workers[0] as any).transport = "ssh";
    expect(validateConfig(c2).join("\n")).toMatch(/transport geçersiz/);
    expect(validateConfig(structuredClone(DEFAULT_CONFIG))).toEqual([]);
  });
  it("OpenRouter anahtarı providers.openrouter.apiKeyEnv ile adı verilen değişkenden okunur", async () => {
    process.env.BENIM_OR_ANAHTARIM = "sk-test"; delete process.env.OPENROUTER_API_KEY;
    const w = makeWorker({ id: "o", agent: "openrouter", model: "x", strengths: [] }, { openrouter: { apiKeyEnv: "BENIM_OR_ANAHTARIM" } });
    expect((w as any).apiKey).toBe("sk-test");
    const none = makeWorker({ id: "o", agent: "openrouter", model: "x", strengths: [] }, {});
    const r = await none.run(brief, { cwd: tmpdir() }); expect(r.ok).toBe(false); expect(r.summary).toMatch(/anahtar/);
    delete process.env.BENIM_OR_ANAHTARIM;
  });
});
