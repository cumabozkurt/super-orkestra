// Claude Code / Codex / Gemini — gerçek hesap olmadan kod düzeyi test.
// Gerçek CLI yerine aynı headless akışı üreten sahte ikili (tests/fixtures/fake-agent.mjs) kullanılır.
import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { chmodSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os"; import { join } from "node:path"; import { execSync, execFileSync } from "node:child_process";
import { CliWorker } from "../packages/core/src/workers/cli-stream.js";
import { detectLimit } from "../packages/core/src/limits/detect.js";
import { LimitTracker } from "../packages/core/src/limits/tracker.js";
import { Conductor, type Planner } from "../packages/core/src/router/conductor.js";
import { Memory } from "../packages/core/src/memory/memory.js";
import { ResumeScheduler } from "../packages/core/src/limits/scheduler.js";
import type { Config, TaskBrief, WorkerConfig } from "../packages/core/src/types.js";

const FAKE = join(__dirname, "fixtures", "fake-agent.mjs");
const AGENTS = [
  { agent: "claude-code", fake: "claude", env: "ORKESTRA_BIN_CLAUDE_CODE", text: "Düzelttim.", usage: { input: 120, output: 40, cacheRead: 9000, cacheWrite: 300 } },
  { agent: "codex", fake: "codex", env: "ORKESTRA_BIN_CODEX", text: "Codex düzeltti.", sid: "019a-codex-thread", usage: { input: 2000, output: 80, cacheRead: 1500, cacheWrite: 0 } },
  { agent: "gemini", fake: "gemini", env: "ORKESTRA_BIN_GEMINI", text: "Gemini düzeltti.", sid: "gem-123", usage: { input: 500, output: 60, cacheRead: 200, cacheWrite: 0 } },
] as const;
const brief: TaskBrief = { id: "t1", goal: "x=2 yap", files: ["x.txt"], context: "", acceptance: ["x.txt 2"], complexity: "medium", tags: ["bugfix"] };
const tmp = (p: string) => mkdtempSync(join(tmpdir(), p));
/** Platformdan bağımsız sahte ikili: .mjs + shebang (Windows'ta resolveSpawn bunu `node betik.mjs` olarak çalıştırır). */
const nodeBin = (dir: string, name: string, js: string) => { const p = join(dir, `${name}.mjs`); writeFileSync(p, `#!/usr/bin/env node\n${js}\n`); chmodSync(p, 0o755); return p; };
const log = () => join(tmp("log-"), "argv.jsonl");
const calls = (f: string) => readFileSync(f, "utf8").trim().split("\n").map(l => JSON.parse(l));

beforeEach(() => { process.env.HOME = process.env.USERPROFILE = tmp("h-"); process.env.ORKESTRA_HOME = join(process.env.HOME, ".orkestra");
  for (const a of AGENTS) process.env[a.env] = FAKE; delete process.env.FAKE_MODE; });

for (const a of AGENTS) describe(`${a.agent} işçisi`, () => {
  const run = (mode: string, resume?: string) => { const cwd = tmp("wt-"), f = log();
    process.env.FAKE_AGENT = a.fake; process.env.FAKE_MODE = mode; process.env.FAKE_LOG = f;
    return new CliWorker({ id: "w", agent: a.agent, model: "m1", strengths: [] }).run(brief, { cwd, resumeSessionId: resume }).then(r => ({ r, cwd, argv: calls(f)[0].argv as string[] })); };

  it("headless çalışır: metin, oturum, token ve dosya değişikliği", async () => {
    const { r, cwd, argv } = await run("ok");
    expect(r.ok).toBe(true); expect(r.summary).toBe(a.text); expect(r.usage).toEqual(a.usage); expect(r.limitHit).toBeUndefined();
    expect(existsSync(join(cwd, `done-by-${a.fake}.txt`))).toBe(true);
    if (a.agent === "claude-code") { expect(r.sessionId).toBe(argv[argv.indexOf("--session-id") + 1]); expect(argv).toContain("--add-dir"); }
    else expect(r.sessionId).toBe(a.sid);
    expect(argv).toContain("m1");
    expect(argv.join(" ")).toContain("GÖREV: x=2 yap");
  });
  it("limit mesajını yakalar ve sıfırlanma zamanını çıkarır", async () => {
    const { r } = await run("limit"); const now = Date.now() / 1000;
    expect(r.ok).toBe(false); expect(r.limitHit).toBeTruthy(); expect(r.limitHit!.resetsAt).toBeGreaterThan(now);
    if (a.agent === "codex") expect(Math.round((r.limitHit!.resetsAt - now) / 60)).toBe(125);
  });
  it("hata kodunda başarısız sayılır ama limit sanılmaz", async () => {
    const { r } = await run("fail"); expect(r.ok).toBe(false); expect(r.limitHit).toBeUndefined();
  });
  it("devamda doğru resume bayrağı ve devam istemi gider", async () => {
    const { argv } = await run("ok", "S-42");
    if (a.agent === "claude-code") { expect(argv).toContain("--resume"); expect(argv).toContain("S-42"); expect(argv).not.toContain("--session-id"); }
    if (a.agent === "codex") expect(argv.slice(0, 2)).toEqual(["exec", "resume"]);
    if (a.agent === "gemini") expect(argv.slice(argv.indexOf("-r"), argv.indexOf("-r") + 2)).toEqual(["-r", "latest"]);
    expect(argv.join(" ")).toContain("Kaldığın yerden devam et");
  });
});

describe("limit metinleri", () => {
  const now = new Date(2026, 9, 7, 10, 0, 0).getTime();
  it("Claude yeni biçim: resets 3pm", () => expect(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Istanbul", hour: "2-digit", hourCycle: "h23" }).format(detectLimit("You've hit your limit · resets 3pm (Europe/Istanbul)", "c", now)!.resetsAt * 1000)).toBe("15"));
  it("Claude geçmiş saat ertesi güne kayar", () => expect(detectLimit("limit · resets 9am", "c", now)!.resetsAt * 1000 - now).toBe(23 * 3600e3));
  it("Codex göreli süre", () => expect(detectLimit("try again in 1 day 2 hours", "x", now)!.resetsAt).toBe(Math.floor(now / 1000) + 93600));
  it("Codex mutlak saat", () => expect(new Date(detectLimit("You've hit your usage limit. try again at 3:05 PM", "x", now)!.resetsAt * 1000).getMinutes()).toBe(5));
  it("Gemini kota", () => expect(detectLimit("RESOURCE_EXHAUSTED", "g", now)).toBeTruthy());
  it("sıradan metin limit değil", () => expect(detectLimit("tests pass: 3 at 4pm review", "g", now)).toBeUndefined());
});

describe("abonelik limit takibi", () => {
  it("Claude statusline hook'u rate_limits'i yazar, takip edici okur ve %95'te durdurur", () => {
    const reset = Math.floor(Date.now() / 1000) + 3600;
    const out = execFileSync("node", [join(__dirname, "..", "packages", "cli", "hooks", "claude-statusline.mjs")], { env: process.env,
      input: JSON.stringify({ rate_limits: { five_hour: { used_percentage: 97, resets_at: reset }, seven_day: { used_percentage: 40, resets_at: reset + 86400 } } }) }).toString();
    expect(out).toContain("%97");
    const t = new LimitTracker(95); expect(t.blockedWorkers([{ id: "w1", agent: "claude-code", model: "", strengths: [] }])).toEqual(["w1"]);
  });
  it("Codex rollout jsonl'daki son rate_limits okunur", () => {
    const d = join(process.env.HOME!, ".codex", "sessions", "2026", "10", "07"); mkdirSync(d, { recursive: true });
    const reset = Math.floor(Date.now() / 1000) + 1800;
    writeFileSync(join(d, "rollout-x.jsonl"), [
      { type: "event_msg", payload: { type: "token_count", rate_limits: { primary: { used_percent: 10, window_minutes: 300, resets_at: reset } } } },
      { type: "event_msg", payload: { type: "token_count", rate_limits: { primary: { used_percent: 99, window_minutes: 300, resets_at: reset }, secondary: { used_percent: 50, window_minutes: 10080, resets_at: reset + 9e4 } } } },
    ].map(o => JSON.stringify(o)).join("\n"));
    const t = new LimitTracker(95); const ws: WorkerConfig[] = [{ id: "w2", agent: "codex", model: "", strengths: [] }, { id: "w3", agent: "gemini", model: "", strengths: [] }];
    expect(t.blockedWorkers(ws)).toEqual(["w2"]); expect((t.snapshot() as any).codex[1].windowMin).toBe(10080);
  });
});

describe("şef + üç abonelik CLI'ı (uçtan uca, sahte ikililerle)", () => {
  it("Claude limitte → Codex'e devreder, kapı geçer, ana dala birleşir", async () => {
    const d = tmp("e2e-"); execSync("git init -q && git config user.email t@t && git config user.name t && echo 1 > x.txt && git add -A && git commit -qm i", { cwd: d });
    const c: Config = { conductor: { agent: "claude-code", model: "opus" },
      workers: [{ id: "w1", agent: "claude-code", model: "sonnet", strengths: ["bugfix"] }, { id: "w2", agent: "codex", model: "", strengths: ["bugfix"] }, { id: "w3", agent: "gemini", model: "", strengths: [] }],
      providers: {}, gates: [`node -e "process.exit(require('fs').existsSync('done-by-codex.txt')?0:1)"`], budget: { maxTokensPerTask: 60000, maxRetries: 2 },
      limits: { pauseAtPercent: 95, resumeDelaySec: 60, allowAccountFailover: false }, memory: { dir: ".orkestra/memory", maxInjectTokens: 200 } };
    // ikiliye ajan adını sar: her ajan için ayrı küçük betik
    const bin = tmp("bin-"); for (const [ag, fk, mode] of [["CLAUDE_CODE", "claude", "limit"], ["CODEX", "codex", "ok"], ["GEMINI", "gemini", "ok"]]) {
      process.env[`ORKESTRA_BIN_${ag}`] = nodeBin(bin, fk, `process.env.FAKE_AGENT = ${JSON.stringify(fk)}; process.env.FAKE_MODE = ${JSON.stringify(mode)}; await import(${JSON.stringify(pathToFileURL(FAKE).href)});`); }
    const p: Planner = { async plan() { return [{ ...brief, complexity: "hard" }]; }, async review() { return { verdict: "accept", note: "" } as any; } };
    const ws = new Map(c.workers.map(w => [w.id, new CliWorker(w)]));
    const k = new Conductor(c, p, ws, new Memory(join(d, ".orkestra/memory")), new LimitTracker(), new ResumeScheduler(async () => {}), d);
    const ev: any[] = []; k.on("handoff", e => ev.push(e));
    expect(await k.runTask({ ...brief, complexity: "hard" })).toBe("done");
    expect(ev[0]).toMatchObject({ from: "w1", reason: "limit" }); expect(existsSync(join(d, "done-by-codex.txt"))).toBe(true);
  });
});

describe("denetim düzeltmeleri", () => {
  it("başarılı koşuda çıktıda '429' geçse de limit sanılmaz", async () => {
    const cwd = tmp("wt-"); const bin = nodeBin(tmp("bin-"), "claude", `console.log(JSON.stringify({ type: "result", result: "HTTP 429 rate_limit_exceeded durumunu ele alan kodu yazdım", session_id: "s", usage: {} }));`);
    process.env.ORKESTRA_BIN_CLAUDE_CODE = bin;
    const r = await new CliWorker({ id: "w", agent: "claude-code", model: "", strengths: [] }).run(brief, { cwd });
    expect(r.ok).toBe(true); expect(r.limitHit).toBeUndefined();
  });
  it("is_error olan sonuçta limit aranır", async () => {
    const cwd = tmp("wt-"); const bin = nodeBin(tmp("bin-"), "claude", `console.log(JSON.stringify({ type: "result", is_error: true, result: "You've hit your limit · resets 3pm", session_id: "s" })); process.exit(1);`);
    process.env.ORKESTRA_BIN_CLAUDE_CODE = bin;
    const r = await new CliWorker({ id: "w", agent: "claude-code", model: "", strengths: [] }).run(brief, { cwd });
    expect(r.limitHit).toBeTruthy();
  });
  it("tüm test dosyasını silmek kurcalama sayılır", async () => {
    const { testsWeakened } = await import("../packages/core/src/router/conductor.js");
    expect(testsWeakened("diff --git a/tests/cart.test.js b/tests/cart.test.js\ndeleted file mode 100644\n--- a/tests/cart.test.js\n+++ /dev/null\n@@ -1,3 +0,0 @@\n-test(\"x\", () => assert.equal(1, 1));\n")).toBe(true);
  });
  it("hepsi limitteyken en erken açılan pencereye göre beklenir", () => {
    const t = new LimitTracker(); const now = Math.floor(Date.now() / 1000);
    const ws: WorkerConfig[] = [{ id: "a", agent: "claude-code", model: "", strengths: [] }, { id: "b", agent: "codex", model: "", strengths: [] }];
    t.record(ws[0], { limitHit: { resetsAt: now + 7200, provider: "c" } } as any); t.record(ws[1], { limitHit: { resetsAt: now + 1800, provider: "x" } } as any);
    expect(t.earliestReset(ws)).toBe(now + 1800);
  });
  it("devam aynı işçide, aynı oturum ve korunmuş yarım worktree ile sürer", async () => {
    const d = tmp("rs-"); execSync("git init -q && git config user.email t@t && git config user.name t && echo 1 > x.txt && git add -A && git commit -qm i", { cwd: d });
    const c: Config = { conductor: { agent: "claude-code", model: "" },
      workers: [{ id: "w1", agent: "claude-code", model: "", strengths: [] }, { id: "w2", agent: "codex", model: "", strengths: [] }],
      providers: {}, gates: [`node -e "const s=require('fs').readFileSync('x.txt','utf8');process.exit(/half/.test(s)&&/done/.test(s)?0:1)"`], budget: { maxTokensPerTask: 60000, maxRetries: 0 },
      limits: { pauseAtPercent: 95, resumeDelaySec: 0, allowAccountFailover: false }, memory: { dir: ".orkestra/memory", maxInjectTokens: 100 } };
    const reset = Math.floor(Date.now() / 1000) + 3600; const seen: any[] = [];
    const mk = (id: string) => ({ config: c.workers.find(w => w.id === id)!, async run(b: TaskBrief, o: any) {
      seen.push({ id, resume: o.resumeSessionId, cwd: o.cwd });
      if (!o.resumeSessionId) { writeFileSync(join(o.cwd, "x.txt"), "half\n"); return { taskId: b.id, workerId: id, ok: false, summary: "", usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, sessionId: `S-${id}`, limitHit: { provider: id, resetsAt: reset } }; }
      writeFileSync(join(o.cwd, "x.txt"), readFileSync(join(o.cwd, "x.txt"), "utf8") + "done\n");
      return { taskId: b.id, workerId: id, ok: true, summary: "bitti", usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, sessionId: o.resumeSessionId }; } });
    const sched = new ResumeScheduler(async () => {}); const p: Planner = { async plan() { return [brief]; }, async review() { return { verdict: "accept", note: "" } as any; } };
    const k = new Conductor(c, p, new Map([["w1", mk("w1")], ["w2", mk("w2")]]) as any, new Memory(join(d, ".orkestra/memory")), new LimitTracker(), sched, d);
    expect(await k.runTask({ ...brief, complexity: "hard" })).toBe("paused");
    const job = sched.pending()[0]; expect(job.worktree && existsSync(job.worktree.path)).toBe(true);
    const k2 = new Conductor(c, p, new Map([["w1", mk("w1")], ["w2", mk("w2")]]) as any, new Memory(join(d, ".orkestra/memory")), new LimitTracker(), sched, d); // limit sıfırlandı (yeni süreç)
    expect(await k2.runTask(job.brief, 0, [], { workerId: job.workerId, sessionId: job.sessionId, worktree: job.worktree })).toBe("done");
    const last = seen.at(-1); expect(last.id).toBe(job.workerId); expect(last.resume).toBe(job.sessionId); expect(last.cwd).toBe(job.worktree!.path);
    expect(readFileSync(join(d, "x.txt"), "utf8")).toBe("half\ndone\n");
  });
});

describe("ikinci denetim düzeltmeleri", () => {
  it("codex devamı yazma izniyle ve aynı modelle açılır", async () => {
    const { cliArgv } = await import("../packages/core/src/workers/cli-stream.js");
    const [, a] = cliArgv("codex", "gpt-5.5-codex", "devam", "x", "SID");
    expect(a.slice(0, 2)).toEqual(["exec", "resume"]);
    expect(a).toContain('sandbox_mode="workspace-write"'); expect(a[a.indexOf("-m") + 1]).toBe("gpt-5.5-codex");
    expect(a.at(-2)).toBe("SID");
  });
  it("çıktıdan yakalanan limit, refresh() sonrası silinmez", () => {
    const t = new LimitTracker(); const w: WorkerConfig = { id: "c", agent: "codex", model: "", strengths: [] };
    t.record(w, { limitHit: { resetsAt: Math.floor(Date.now() / 1000) + 3600, provider: "codex" } } as any);
    t.refresh(); expect(t.blockedWorkers([w])).toEqual(["c"]);
  });
  it("Claude 'resets 3pm (Europe/Istanbul)' makine saat diliminden bağımsız çözülür", async () => {
    const { detectLimit } = await import("../packages/core/src/limits/detect.js");
    const now = Date.UTC(2026, 9, 7, 10, 0, 0); // 13:00 İstanbul
    expect(detectLimit("You've hit your limit · resets 3pm (Europe/Istanbul)", "c", now)!.resetsAt).toBe(Date.UTC(2026, 9, 7, 12, 0, 0) / 1000);
    expect(detectLimit("You've hit your limit · resets 3pm (America/New_York)", "c", now)!.resetsAt).toBe(Date.UTC(2026, 9, 7, 19, 0, 0) / 1000);
    expect(detectLimit("You've hit your limit · resets 9am (Europe/Istanbul)", "c", now)!.resetsAt).toBe(Date.UTC(2026, 9, 8, 6, 0, 0) / 1000);
    expect(detectLimit("You've hit your limit · resets 2am (Europe/London)", "c", Date.UTC(2026, 9, 24, 12))!.resetsAt).toBe(Date.UTC(2026, 9, 25, 2, 0, 0) / 1000); // BST→GMT geçişi
  });
  it("Windows'ta .cmd sarmalayıcısı kabuksuz node betiğine çözülür", async () => {
    const { resolveSpawn } = await import("../packages/core/src/workers/cli-stream.js");
    const d = tmp("win-"); const cmd = join(d, "codex.cmd");
    writeFileSync(cmd, `@ECHO off\r\nendLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & "%_prog%"  "%dp0%\\node_modules\\@openai\\codex\\bin\\codex.js" %*\r\n`);
    const [b, a] = resolveSpawn("codex", ["exec", "çok\nsatırlı \"istem\" & del *"], "win32", () => `${cmd}\r\n`);
    expect(b).toBe(process.execPath); expect(a[0].startsWith(d) && /node_modules.@openai.codex.bin.codex\.js$/.test(a[0])).toBe(true);
    expect(a[2]).toBe("çok\nsatırlı \"istem\" & del *");
    expect(resolveSpawn("claude", ["-p"], "win32", () => "C:\\x\\claude.exe\r\n")).toEqual(["C:\\x\\claude.exe", ["-p"]]);
    expect(resolveSpawn("claude", ["-p"], "linux")).toEqual(["claude", ["-p"]]);
  });
  it("OpenRouter işçisinin diff'i worktree'ye gerçekten uygulanır", async () => {
    const { applyDiff } = await import("../packages/core/src/workers/openrouter.js");
    const d = tmp("or-"); execSync("git init -q", { cwd: d }); writeFileSync(join(d, "f.txt"), "a\nb\n"); // printf/tek tırnak Windows cmd'de yok
    const r = applyDiff(d, "İşte:\n```diff\n--- a/f.txt\n+++ b/f.txt\n@@ -1,2 +1,2 @@\n a\n-b\n+c\n```\n");
    expect(r.ok).toBe(true); expect(readFileSync(join(d, "f.txt"), "utf8")).toBe("a\nc\n");
    expect(applyDiff(d, "diff yok").ok).toBe(false);
  });
});

describe("üçüncü denetim düzeltmeleri", () => {
  it("ACP dosya erişimi çalışma dizinine hapsedilir", async () => {
    const { insideRoot } = await import("../packages/core/src/workers/acp.js");
    const r = tmp("acp-");
    expect(insideRoot(r, join(r, "src/a.ts"))).toBe(true); expect(insideRoot(r, "src/a.ts")).toBe(true);
    expect(insideRoot(r, join(r, "..", "baska", "x"))).toBe(false); expect(insideRoot(r, "../../etc/passwd")).toBe(false);
    expect(insideRoot(r, join(tmpdir(), "x"))).toBe(false);
  }, 30_000);
  it("token bütçesi aşılınca yeni deneme açılmaz", async () => {
    const d = tmp("bg-"); execSync("git init -q && git config user.email t@t && git config user.name t && echo 1 > x.txt && git add -A && git commit -qm i", { cwd: d });
    const c: Config = { conductor: { agent: "claude-code", model: "" }, workers: [{ id: "w1", agent: "claude-code", model: "", strengths: [] }],
      providers: {}, gates: [`node -e "process.exit(1)"`], budget: { maxTokensPerTask: 1000, maxRetries: 5 },
      limits: { pauseAtPercent: 95, resumeDelaySec: 0, allowAccountFailover: false }, memory: { dir: ".orkestra/memory", maxInjectTokens: 100 } };
    let runs = 0;
    const w = { config: c.workers[0], async run(b: TaskBrief, o: any) { runs++; writeFileSync(join(o.cwd, "x.txt"), String(runs));
      return { taskId: b.id, workerId: "w1", ok: true, summary: "", usage: { input: 700, output: 100, cacheRead: 0, cacheWrite: 0 } }; } };
    const p: Planner = { async plan() { return [brief]; }, async review() { return { verdict: "fix", note: "tekrar" } as any; } };
    const k = new Conductor(c, p, new Map([["w1", w]]) as any, new Memory(join(d, ".orkestra/memory")), new LimitTracker(), new ResumeScheduler(async () => {}), d);
    const fails: any[] = []; k.on("failed", e => fails.push(e));
    expect(await k.runTask(brief)).toBe("failed"); expect(runs).toBe(2); expect(fails[0].note).toContain("bütçe");
  });
  it("yapılandırma: dosya yoksa varsayılan, eksik alanlar birleşir, hatalı olan net mesajla reddedilir", async () => {
    const { loadConfig, detectGates } = await import("../packages/core/src/config.js");
    const d = tmp("cfg-");
    const def = loadConfig(d); expect(def.workers.length).toBe(3); expect(def.gates).toEqual([]);
    writeFileSync(join(d, "package.json"), JSON.stringify({ scripts: { test: "vitest run" } })); expect(detectGates(d)).toEqual(["npm test --silent"]);
    writeFileSync(join(d, "orkestra.config.json"), JSON.stringify({ workers: [{ id: "a", agent: "opencode", model: "x" }], limits: { resumeDelaySec: 5 } }));
    const c = loadConfig(d); expect(c.limits).toEqual({ pauseAtPercent: 95, resumeDelaySec: 5, allowAccountFailover: false }); expect(c.workers[0].strengths).toEqual([]);
    writeFileSync(join(d, "orkestra.config.json"), JSON.stringify({ workers: [{ id: "a", agent: "kodcu" }, { id: "a", agent: "codex" }] }));
    expect(() => loadConfig(d)).toThrow(/agent geçersiz[\s\S]*yinelenen işçi/);
    writeFileSync(join(d, "orkestra.config.json"), "{ bozuk"); expect(() => loadConfig(d)).toThrow(/okunamadı/);
  });
  it("statusline kancası bozuk girdide çökmez, ORKESTRA_HOME'a atomik yazar", () => {
    const h = tmp("sl-"); const hook = join(__dirname, "..", "packages", "cli", "hooks", "claude-statusline.mjs");
    expect(execFileSync(process.execPath, [hook], { input: "{bozuk", env: { ...process.env, ORKESTRA_HOME: h } }).toString()).toBe("orkestra");
    execFileSync(process.execPath, [hook], { input: JSON.stringify({ rate_limits: { five_hour: { used_percentage: 40, resets_at: 2000000000 } } }), env: { ...process.env, ORKESTRA_HOME: h } });
    expect(JSON.parse(readFileSync(join(h, "claude-limits.json"), "utf8")).five_hour.used_percentage).toBe(40);
  });
  it("devam kuyruğu ORKESTRA_HOME altında tutulur", () => {
    const h = tmp("oh-"); process.env.ORKESTRA_HOME = h;
    const s = new ResumeScheduler(async () => {}); s.schedule({ brief, workerId: "w", at: 1 }); s.stop();
    expect(existsSync(join(h, "resume-queue.json"))).toBe(true);
  });
});
