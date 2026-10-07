import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os"; import { join } from "node:path"; import { execSync } from "node:child_process";
import { parseEvents, cliArgv } from "../packages/core/src/workers/cli-stream.js";
import { buildRepoMap } from "../packages/core/src/memory/repomap.js";
import { Memory } from "../packages/core/src/memory/memory.js";
import { createWorktree, worktreeDiff, mergeWorktree, removeWorktree } from "../packages/core/src/workers/worktree.js";
import { ResumeScheduler } from "../packages/core/src/limits/scheduler.js";
import { LlmPlanner } from "../packages/core/src/router/llm-planner.js";

function repo() {
  const d = mkdtempSync(join(tmpdir(), "ork-")); execSync("git init -q && git config user.email t@t && git config user.name t", { cwd: d });
  writeFileSync(join(d, "a.ts"), "export function helper() { return 1 }\n");
  writeFileSync(join(d, "b.ts"), "import { helper } from './a'\nexport function main() { return helper() + helper() }\n");
  execSync("git add -A && git commit -qm i", { cwd: d }); return d;
}

describe("akış ayrıştırma (gerçek opencode çıktısı)", () => {
  it("opencode olayları", () => {
    const raw = `{"type":"text","sessionID":"ses_1","part":{"type":"text","text":"PONG"}}\n{"type":"step_finish","sessionID":"ses_1","part":{"type":"step-finish","tokens":{"input":238,"output":4,"reasoning":13,"cache":{"write":0,"read":7424}}}}`;
    const p = parseEvents(raw);
    expect(p.text).toBe("PONG"); expect(p.sessionId).toBe("ses_1"); expect(p.usage).toEqual({ input: 238, output: 17, cacheRead: 7424, cacheWrite: 0 });
  });
  it("claude result olayı", () => {
    const p = parseEvents(`{"type":"result","result":"tamam","session_id":"u-1","usage":{"input_tokens":10,"output_tokens":5,"cache_read_input_tokens":100}}`);
    expect(p.text).toBe("tamam"); expect(p.usage.cacheRead).toBe(100);
  });
  it("doğrulanmış bayraklar", () => {
    expect(cliArgv("codex", "m", "x", "s", "abc")[1]).toEqual(["exec", "resume", "--json", "--skip-git-repo-check", "-c", 'sandbox_mode="workspace-write"', "-m", "m", "abc", "x"]);
    expect(cliArgv("claude-code", "opus", "x", "sid")[1]).toContain("--session-id");
    expect(cliArgv("gemini", "", "x", "s", "r")[1]).toContain("latest");
  });
});

describe("repo haritası", () => {
  it("çok referans alan dosya önce gelir", () => {
    const d = repo(); const map = buildRepoMap(d, 500);
    expect(map.indexOf("a.ts")).toBeLessThan(map.indexOf("b.ts"));
  });
});

describe("hafıza", () => {
  it("hatırla / getir / bütçe", () => {
    const m = new Memory(mkdtempSync(join(tmpdir(), "mem-")));
    m.remember("Proje testleri vitest ile koşar", ["conv"]); m.remember("Veritabanı PostgreSQL 18", ["db"]);
    expect(m.recall("testleri nasıl koşarım")).toContain("vitest");
    expect(m.recall("tamamen alakasız", 10).length).toBeLessThan(200);
  });
});

describe("worktree izolasyonu", () => {
  it("ayrı dalda çalışır, birleşir, temizlenir", () => {
    const d = repo(); const wt = createWorktree(d, "t1", "w1");
    writeFileSync(join(wt.path, "a.ts"), "export function helper() { return 2 }\n");
    expect(readFileSync(join(d, "a.ts"), "utf8")).toContain("return 1");
    expect(worktreeDiff(wt)).toContain("return 2");
    expect(mergeWorktree(d, wt, "t1").ok).toBe(true); removeWorktree(d, wt);
    expect(readFileSync(join(d, "a.ts"), "utf8")).toContain("return 2"); expect(existsSync(wt.path)).toBe(false);
  });
});

describe("şef JSON çıkarımı", () => {
  it("kod bloğu içinden", () => expect(LlmPlanner.extractJson<any[]>("Plan:\n```json\n[{\"id\":\"t1\"}]\n```", "[")[0].id).toBe("t1"));
});

describe("devam zamanlayıcısı", () => {
  it("kuyruk diske yazılır", () => {
    process.env.HOME = process.env.USERPROFILE = mkdtempSync(join(tmpdir(), "home-")); process.env.ORKESTRA_HOME = join(process.env.HOME, ".orkestra");
    const s = new ResumeScheduler(async () => {});
    s.schedule({ brief: { id: "t", goal: "", files: [], context: "", acceptance: [], complexity: "small", tags: [] }, workerId: "w1", at: 1 });
    expect(new ResumeScheduler(async () => {}).pending().length).toBe(1);
  });
});

import { testsWeakened } from "../packages/core/src/router/conductor.js";
describe("test kurcalama koruması", () => {
  const hdr = "--- a/cart.test.js\n+++ b/cart.test.js\n";
  it("test silmeyi yakalar", () => expect(testsWeakened(hdr + "-test(\"x\", () => assert.equal(1,1));\n")).toBe(true));
  it("test eklemeye izin verir", () => expect(testsWeakened(hdr + "+test(\"y\", () => assert.equal(2,2));\n")).toBe(false));
  it("kaynak dosyadaki silmeye karışmaz", () => expect(testsWeakened("--- a/cart.js\n+++ b/cart.js\n-  assert(x)\n")).toBe(false));
});

describe("tree-sitter repo haritası", () => {
  it("TS/Python/Go/Rust tanımlarını doğru çıkarır, yorumdaki sözde tanımları almaz", async () => {
    const { treeSitterDefs } = await import("../packages/core/src/memory/repomap.js");
    const ts = await treeSitterDefs("a.ts", "// function sahte() {}\nexport class Kuyruk {\n  ekle(x: number) { return yardimci(x); }\n}\nexport const hizli = () => 1;\ninterface Ayar { a: 1 }\nfunction yardimci(y: number) { return y; }\n");
    expect(ts!.syms).toEqual(["Kuyruk", "ekle", "hizli", "Ayar", "yardimci"]); expect(ts!.refs).toContain("yardimci"); expect(ts!.refs).not.toContain("sahte");
    expect((await treeSitterDefs("b.py", "class Depo:\n    def kaydet(self):\n        pass\n# def yok(): pass\n"))!.syms).toEqual(["Depo", "kaydet"]);
    expect((await treeSitterDefs("c.go", "package m\ntype Kayit struct{}\nfunc (k Kayit) Yaz() {}\nfunc Yeni() Kayit { return Kayit{} }\n"))!.syms).toEqual(["Kayit", "Yaz", "Yeni"]);
    expect((await treeSitterDefs("d.rs", "pub struct Tampon;\nimpl Tampon { pub fn bosalt(&self) {} }\ntrait Yazar { fn yaz(&self); }\n"))!.syms).toEqual(["Tampon", "bosalt", "Yazar", "yaz"]);
    expect(await treeSitterDefs("e.txt", "x")).toBeNull();
  }, 30_000);
  it("buildRepoMapAsync merkezi dosyayı öne alır ve odakla sıralar", async () => {
    const { buildRepoMapAsync } = await import("../packages/core/src/memory/repomap.js");
    const d = mkdtempSync(join(tmpdir(), "rm-")); execSync("git init -q", { cwd: d });
    writeFileSync(join(d, "cekirdek.ts"), "export function temelIslem() { return 1; }\n");
    for (const n of ["a", "b", "c"]) writeFileSync(join(d, `${n}.ts`), `import { temelIslem } from "./cekirdek";\nexport function ${n}Kullan() { return temelIslem(); }\n`);
    writeFileSync(join(d, "odeme.py"), "def odeme_al():\n    pass\n");
    execSync("git add -A", { cwd: d });
    const m = await buildRepoMapAsync(d, 1500); expect(m.split("\n")[0]).toBe("cekirdek.ts");
    const f = await buildRepoMapAsync(d, 1500, "odeme hatası"); expect(f.split("\n")[0]).toBe("odeme.py");
  }, 30_000);
});

describe("dördüncü denetim", () => {
  it("agentEnv geri döngü adreslerini NO_PROXY'ye ekler, mevcutları korur", async () => {
    const { agentEnv } = await import("../packages/core/src/workers/cli-stream.js");
    const e = agentEnv({ HTTP_PROXY: "http://p:1", NO_PROXY: "corp.local" });
    expect(e.NO_PROXY).toBe("corp.local,127.0.0.1,localhost,::1"); expect(e.no_proxy).toBe(e.NO_PROXY); expect(e.HTTP_PROXY).toBe("http://p:1");
  });
  it("şef planı normalize edilir: yinelenen id, geçersiz karmaşıklık, boş plan", () => {
    const t = LlmPlanner.normalizeTasks([{ id: "t1", goal: "a", complexity: "zor" }, { id: "t1", goal: "b" }, { goal: "" }], "hedef");
    expect(t.map(x => x.id)).toEqual(["t1", "t1-2"]); expect(t[0].complexity).toBe("small");
    expect(LlmPlanner.normalizeTasks([], "hedef")).toMatchObject([{ id: "t1", goal: "hedef" }]);
  });
  it("kapı komutu zaman aşımında takılmaz ve CI=1 ile koşar", async () => {
    const { runGates } = await import("../packages/core/src/router/gates.js");
    process.env.ORKESTRA_GATE_TIMEOUT_MS = "500";
    const r = await runGates([`node -e "setTimeout(()=>{},60000)"`], tmpdir()); delete process.env.ORKESTRA_GATE_TIMEOUT_MS;
    expect(r.ok).toBe(false); expect(r.log).toContain("zaman aşımı");
    // GitHub Actions zaten CI=true ayarlar; varsayılanı (CI=1) sınamak için geçici olarak kaldır.
    const prevCI = process.env.CI; delete process.env.CI;
    try { expect((await runGates([`node -e "process.exit(process.env.CI==='1'?0:1)"`], tmpdir())).ok).toBe(true); }
    finally { if (prevCI !== undefined) process.env.CI = prevCI; }
    // Önceden ayarlanmış CI değeri korunur.
    process.env.CI = "true";
    try { expect((await runGates([`node -e "process.exit(process.env.CI==='true'?0:1)"`], tmpdir())).ok).toBe(true); }
    finally { if (prevCI !== undefined) process.env.CI = prevCI; else delete process.env.CI; }
  });
});
