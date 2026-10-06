#!/usr/bin/env node
// Claude Code statusLine betiği: stdin'deki JSON'dan rate_limits'i ~/.orkestra/claude-limits.json'a yazar
// ~/.claude/settings.json -> { "statusLine": { "type": "command", "command": "node /yol/hooks/claude-statusline.mjs" } }
import { mkdirSync, writeFileSync, renameSync } from "node:fs"; import { join } from "node:path"; import { homedir } from "node:os";
let s = ""; process.stdin.on("data", d => s += d).on("end", () => {
  let rl; try { rl = JSON.parse(s || "{}").rate_limits; } catch { /* bozuk girdi: durum satırını yine de göster */ }
  if (rl) try {
    const d = process.env.ORKESTRA_HOME ?? join(homedir(), ".orkestra"); mkdirSync(d, { recursive: true });
    const f = join(d, "claude-limits.json"), tmp = `${f}.${process.pid}.tmp`; writeFileSync(tmp, JSON.stringify(rl)); renameSync(tmp, f); // atomik
  } catch { /* yazılamadıysa durum satırını bozma */ }
  const f = rl?.five_hour; process.stdout.write(f ? `5s: %${Math.round(f.used_percentage)} · sıfırlanma ${new Date(f.resets_at * 1000).toLocaleTimeString()}` : "orkestra");
});
