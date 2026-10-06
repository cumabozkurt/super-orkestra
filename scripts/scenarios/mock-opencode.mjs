#!/usr/bin/env node
// Senaryo testleri için opencode sarmalayıcısı. MOCK_PLAN={"model":["429","limit",...]} dosyasındaki sıradaki
// eylemi uygular (429 / limit), plan boşsa gerçek opencode'a (MOCK_REAL) devreder. Her çağrı MOCK_LOG'a yazılır.
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path"; import { tmpdir } from "node:os";
const args = process.argv.slice(2), i = args.findIndex(a => a === "-m" || a === "--model");
const model = i >= 0 ? args[i + 1] : "?", planF = process.env.MOCK_PLAN, log = process.env.MOCK_LOG ?? join(tmpdir(), "mock-calls.log");
let plan = {}; try { plan = JSON.parse(readFileSync(planF, "utf8")); } catch {}
const act = plan[model]?.shift(); if (planF) writeFileSync(planF, JSON.stringify(plan));
appendFileSync(log, `${new Date().toISOString()} ${model} ${act ?? "pass"}\n`);
if (act === "429") { console.error("Error: 429 rate_limit_exceeded"); process.exit(1); }
if (act === "limit") { console.error(`usage limit reached|${Math.floor(Date.now() / 1000) + Number(process.env.MOCK_RESET_SEC ?? 20)}`); process.exit(1); }
const r = spawnSync(process.env.MOCK_REAL ?? "opencode", args, { stdio: "inherit" }); process.exit(r.status ?? 1);
