import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os"; import { join } from "node:path"; import { execSync } from "node:child_process";
import { Conductor, type Planner } from "../packages/core/src/router/conductor.js";
import { Memory } from "../packages/core/src/memory/memory.js";
import { LimitTracker } from "../packages/core/src/limits/tracker.js";
import { ResumeScheduler } from "../packages/core/src/limits/scheduler.js";
import type { Config, TaskBrief, Worker, WorkResult } from "../packages/core/src/types.js";

const U = { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 };
const cfg = (gates: string[]): Config => ({
  conductor: { agent: "opencode", model: "x" },
  workers: [{ id: "w1", agent: "claude-code", model: "a", strengths: ["bugfix"] }, { id: "w2", agent: "codex", model: "b", strengths: [] }, { id: "w3", agent: "gemini", model: "c", strengths: [] }],
  providers: {}, gates, budget: { maxTokensPerTask: 60000, maxRetries: 2 },
  limits: { pauseAtPercent: 95, resumeDelaySec: 60, allowAccountFailover: false }, memory: { dir: ".orkestra/memory", maxInjectTokens: 200 },
});
const brief: TaskBrief = { id: "t1", goal: "x=2 yap", files: ["x.txt"], context: "", acceptance: ["x.txt 2"], complexity: "hard", tags: ["bugfix"] };

function repo() { const d = mkdtempSync(join(tmpdir(), "cnd-")); execSync("git init -q && git config user.email t@t && git config user.name t", { cwd: d });
  writeFileSync(join(d, "x.txt"), "1\n"); execSync("git add -A && git commit -qm i", { cwd: d }); return d; }

class FakeWorker implements Worker {
  calls: { cwd: string; resume?: string }[] = [];
  constructor(public config: any, private behave: (n: number, cwd: string) => Partial<WorkResult>) {}
  async run(b: TaskBrief, o: { cwd: string; resumeSessionId?: string }): Promise<WorkResult> {
    this.calls.push({ cwd: o.cwd, resume: o.resumeSessionId });
    return { taskId: b.id, workerId: this.config.id, ok: true, summary: "ok", usage: U, sessionId: `s-${this.config.id}`, ...this.behave(this.calls.length, o.cwd) };
  }
}
const planner = (verdicts: string[] = []): Planner & { reviews: number } => ({ reviews: 0,
  async plan() { return [brief]; },
  async review() { this.reviews++; return { verdict: (verdicts.shift() ?? "accept") as any, note: "x.txt içine 2 yaz" }; } });

beforeEach(() => { process.env.HOME = mkdtempSync(join(tmpdir(), "h-")); process.env.ORKESTRA_HOME = join(process.env.HOME, ".orkestra"); });

function setup(c: Config, ws: FakeWorker[], p: Planner) {
  const d = repo(); const sched = new ResumeScheduler(async () => {});
  const k = new Conductor(c, p, new Map(ws.map(w => [w.config.id, w])), new Memory(join(d, ".orkestra/memory")), new LimitTracker(), sched, d);
  return { d, k, sched };
}
const write2 = (_n: number, cwd: string) => { writeFileSync(join(cwd, "x.txt"), "2\n"); return {}; };

describe("şef döngüsü (sahte işçilerle)", () => {
  it("işçi izole worktree'de çalışır, kapı geçer, ana dala birleşir", async () => {
    const c = cfg([`node -e "process.exit(require('fs').readFileSync('x.txt','utf8').includes('2')?0:1)"`]); const w = new FakeWorker(c.workers[0], write2);
    const { d, k } = setup(c, [w, new FakeWorker(c.workers[1], write2), new FakeWorker(c.workers[2], write2)], planner(["accept"]));
    expect(await k.runTask(brief)).toBe("done");
    expect(w.calls[0].cwd).not.toBe(d); expect(readFileSync(join(d, "x.txt"), "utf8").replace(/\r\n/g, "\n")).toBe("2\n");
  });
  it("kapı kalırsa şef müdahale eder (fix) ve ikinci denemede düzelir", async () => {
    const c = cfg([`node -e "process.exit(require('fs').readFileSync('x.txt','utf8').includes('2')?0:1)"`]); const p = planner(["fix", "accept"]);
    const w = new FakeWorker(c.workers[0], (n, cwd) => (n === 1 ? {} : write2(n, cwd)));
    const { d, k } = setup(c, [w, new FakeWorker(c.workers[1], write2), new FakeWorker(c.workers[2], write2)], p);
    expect(await k.runTask(brief)).toBe("done"); expect(w.calls.length).toBe(2); expect(p.reviews).toBe(2);
    expect(readFileSync(join(d, "x.txt"), "utf8").replace(/\r\n/g, "\n")).toBe("2\n");
  });
  it("limit gelen işçinin işi başka işçiye devredilir", async () => {
    const c = cfg([`node -e "process.exit(require('fs').readFileSync('x.txt','utf8').includes('2')?0:1)"`]);
    const w1 = new FakeWorker(c.workers[0], () => ({ ok: false, limitHit: { provider: "claude-code", resetsAt: Math.floor(Date.now() / 1000) + 3600 } }));
    const w2 = new FakeWorker(c.workers[1], write2);
    const { k } = setup(c, [w1, w2, new FakeWorker(c.workers[2], write2)], planner());
    const events: any[] = []; k.on("handoff", e => events.push(e));
    expect(await k.runTask(brief)).toBe("done"); expect(events[0]).toMatchObject({ from: "w1", reason: "limit" });
  });
  it("hepsi limitteyse oturum sıfırlanma anına kalıcı kuyruğa alınır ve aynı oturumla devam eder", async () => {
    const c = cfg([]); const reset = Math.floor(Date.now() / 1000) + 3600;
    const lim = (id: string) => new FakeWorker({ ...c.workers.find(w => w.id === id) }, () => ({ ok: false, limitHit: { provider: id, resetsAt: reset } }));
    const ws = [lim("w1"), lim("w2"), lim("w3")];
    const { k, sched } = setup(c, ws, planner());
    expect(await k.runTask(brief)).toBe("paused");
    const q = sched.pending(); expect(q.length).toBe(1); expect(q[0].at).toBe(reset + 60); expect(q[0].sessionId).toMatch(/^s-w/);
  });
});

describe("yarım işin korunması", () => {
  it("limitte devirde worktree atılmaz; yeni işçi mevcut değişiklikleri diff olarak görür ve sürdürür", async () => {
    const c = cfg([`node -e "const s=require('fs').readFileSync('x.txt','utf8');process.exit(s.includes('yarim')&&s.includes('2')?0:1)"`]);
    const w1 = new FakeWorker(c.workers[0], (_n, cwd) => { writeFileSync(join(cwd, "x.txt"), "yarim\n"); return { ok: false, limitHit: { resetsAt: Date.now() / 1000 + 3600, provider: "anthropic" } }; });
    let seen = ""; const w2 = new FakeWorker(c.workers[1], (_n, cwd) => { seen = readFileSync(join(cwd, "x.txt"), "utf8"); writeFileSync(join(cwd, "x.txt"), seen + "2\n"); return {}; });
    const briefs: TaskBrief[] = []; const orig = w2.run.bind(w2); w2.run = async (b, o) => { briefs.push(b); return orig(b, o); };
    const { d, k } = setup(c, [w1, w2, new FakeWorker(c.workers[2], write2)], planner(["accept"]));
    const carried: any[] = []; k.on("carry", e => carried.push(e));
    expect(await k.runTask(brief)).toBe("done");
    expect(seen).toBe("yarim\n"); expect(briefs[0].context).toContain("ÖNCEKİ DENEME YARIM KALDI"); expect(briefs[0].context).toContain("+yarim");
    expect(carried[0]).toMatchObject({ to: "w2" }); expect(readFileSync(join(d, "x.txt"), "utf8").replace(/\r\n/g, "\n")).toBe("yarim\n2\n");
  });
  it("oturum kimliği dönmeyen limitte devam, yarım worktree'yi korur", async () => {
    const c = cfg([`node -e "process.exit(require('fs').readFileSync('x.txt','utf8').includes('tamam')?0:1)"`]);
    c.workers = [c.workers[0]];
    let n = 0; const w = new FakeWorker(c.workers[0], (_i, cwd) => { n++;
      if (n === 1) { writeFileSync(join(cwd, "x.txt"), "yarim\n"); return { ok: false, sessionId: undefined, limitHit: { resetsAt: Date.now() / 1000 - 1, provider: "anthropic" } }; }
      writeFileSync(join(cwd, "x.txt"), readFileSync(join(cwd, "x.txt"), "utf8") + "tamam\n"); return { sessionId: undefined }; });
    const { d, k, sched } = setup(c, [w], planner(["accept"]));
    expect(await k.runTask(brief)).toBe("paused");
    const job = sched.pending()[0]; expect(job.sessionId).toBeUndefined(); expect(job.worktree).toBeTruthy();
    const lt = (k as any).limits as LimitTracker; (lt as any).hits?.clear?.();
    expect(await k.runTask(job.brief, 0, [], { workerId: job.workerId, sessionId: job.sessionId, worktree: job.worktree })).toBe("done");
    expect(w.calls[1].cwd).toBe(w.calls[0].cwd); expect(w.calls[1].resume).toBeUndefined();
    expect(readFileSync(join(d, "x.txt"), "utf8").replace(/\r\n/g, "\n")).toBe("yarim\ntamam\n");
  });
  it("worktree kaldırılınca boş kök klasör de silinir", async () => {
    const { createWorktree, removeWorktree } = await import("../packages/core/src/workers/worktree.js");
    const d = repo(); const wt = createWorktree(d, "t9", "w1"); const root = join(wt.path, "..");
    removeWorktree(d, wt); expect(existsSync(root)).toBe(false);
  });
});
