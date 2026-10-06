#!/usr/bin/env node
// Claude Code / Codex / Gemini CLI'larının headless çıktısını taklit eder (gerçek hesap olmadan kod düzeyi test).
// FAKE_AGENT=claude|codex|gemini, FAKE_MODE=ok|limit|fail, FAKE_LOG=argv günlüğü
import { appendFileSync, writeFileSync } from "node:fs";
const a = process.env.FAKE_AGENT, mode = process.env.FAKE_MODE ?? "ok", argv = process.argv.slice(2);
if (process.env.FAKE_LOG) appendFileSync(process.env.FAKE_LOG, JSON.stringify({ agent: a, argv, cwd: process.cwd() }) + "\n");
const out = o => process.stdout.write(JSON.stringify(o) + "\n");
const limitMsg = { claude: "You've hit your limit · resets 3pm (Europe/Istanbul)",
  codex: "You've hit your usage limit. Upgrade to Plus to continue using Codex, or try again in 2 hours 5 minutes.",
  gemini: "[API Error: 429 RESOURCE_EXHAUSTED Quota exceeded for quota metric]" }[a];
if (mode === "limit") { process.stderr.write(limitMsg + "\n"); process.exit(1); }
if (mode === "fail") { process.stderr.write("boom\n"); process.exit(2); }
writeFileSync("done-by-" + a + ".txt", "ok\n");
if (a === "claude") {
  const sid = argv[argv.indexOf("--session-id") + 1] ?? argv[argv.indexOf("--resume") + 1];
  out({ type: "system", subtype: "init", session_id: sid, model: "claude-sonnet" });
  out({ type: "assistant", session_id: sid, message: { content: [{ type: "text", text: "Düzelttim." }] } });
  out({ type: "result", subtype: "success", is_error: false, result: "Düzelttim.", session_id: sid,
    usage: { input_tokens: 120, output_tokens: 40, cache_read_input_tokens: 9000, cache_creation_input_tokens: 300 } });
} else if (a === "codex") {
  out({ type: "thread.started", thread_id: "019a-codex-thread" }); out({ type: "turn.started" });
  out({ type: "item.completed", item: { id: "item_0", type: "reasoning", text: "düşünüyorum" } });
  out({ type: "item.completed", item: { id: "item_1", type: "agent_message", text: "Codex düzeltti." } });
  out({ type: "turn.completed", usage: { input_tokens: 2000, cached_input_tokens: 1500, output_tokens: 80 } });
} else if (a === "gemini") {
  out({ type: "init", session_id: "gem-123", model: "gemini-3-pro" });
  out({ type: "message", role: "user", content: "görev" });
  out({ type: "message", role: "assistant", content: "Gemini ", delta: true });
  out({ type: "message", role: "assistant", content: "düzeltti.", delta: true });
  out({ type: "result", status: "success", stats: { total_tokens: 560, input_tokens: 500, output_tokens: 60, cached: 200 } });
}
