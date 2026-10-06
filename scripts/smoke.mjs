#!/usr/bin/env node
// Gerçek bir ajanla duman testi (giriş gerektirmeyen opencode ücretsiz modeli ile):
//   node scripts/smoke.mjs [opencode/big-pickle]
// Geçici bir git deposunda hatalı bir fonksiyonu düzelttirir, sonucu ve token kullanımını yazdırır.
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os"; import { join } from "node:path"; import { execFileSync } from "node:child_process";
import { makeWorker } from "../packages/core/dist/index.js";
const model = process.argv[2] ?? "opencode/big-pickle";
const d = mkdtempSync(join(tmpdir(), "so-smoke-"));
const g = (...a) => execFileSync("git", a, { cwd: d });
g("init", "-q"); writeFileSync(join(d, "mat.js"), "export function topla(a, b) {\n  return a - b;\n}\n");
g("add", "-A"); g("-c", "user.email=s@s", "-c", "user.name=s", "commit", "-qm", "i");
const w = makeWorker({ id: "w1", agent: "opencode", model, strengths: [] });
const r = await w.run({ id: "t1", goal: "mat.js içindeki topla fonksiyonu çıkarma yapıyor; toplama yapacak şekilde düzelt.", files: ["mat.js"], context: "", acceptance: ["topla(2,3) === 5"], complexity: "trivial", tags: ["bugfix"] }, { cwd: d });
const ok = readFileSync(join(d, "mat.js"), "utf8").includes("a + b");
console.log(JSON.stringify({ ok: r.ok && ok, usage: r.usage, dir: d }, null, 2)); process.exit(r.ok && ok ? 0 : 1);
