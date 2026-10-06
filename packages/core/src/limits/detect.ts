/** Claude/Codex/Gemini limit mesajlarını yakalar.
 *  Claude eski: "usage limit reached|<epoch>", yeni: "You've hit your limit · resets 3pm (Europe/Istanbul)"
 *  Codex: "You've hit your usage limit ... try again in 2 hours 5 minutes" / "try again at 3:05 PM"
 *  Gemini: 429 RESOURCE_EXHAUSTED / "Quota exceeded" */
export function detectLimit(text: string, provider: string, now = Date.now()): { resetsAt: number; provider: string } | undefined {
  const sec = (ms: number) => Math.floor(ms / 1000);
  const epoch = text.match(/usage limit reached\|(\d{10})/i);
  if (epoch) return { provider, resetsAt: Number(epoch[1]) };
  const inRel = text.match(/try again in\s+((?:\d+\s*(?:days?|d|hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)\s*,?\s*(?:and\s*)?)+)/i);
  if (inRel) {
    let s = 0; for (const [, n, u] of inRel[1].matchAll(/(\d+)\s*([a-z]+)/gi)) {
      const k = u.toLowerCase(); s += Number(n) * (k.startsWith("d") ? 86400 : k.startsWith("h") ? 3600 : k.startsWith("m") ? 60 : 1); }
    return { provider, resetsAt: sec(now) + s };
  }
  const m = text.match(/(?:limit|try again)[^\n]*?(?:resets?|at)\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (m) {
    let h = Number(m[1]); if (m[3]) { h = h % 12; if (m[3].toLowerCase() === "pm") h += 12; }
    // Claude saat dilimini parantezde verir: "resets 3pm (Europe/Istanbul)". Yoksa makinenin yerel saati.
    const tz = text.slice((m.index ?? 0) + m[0].length).match(/^\s*\(([A-Za-z_]+\/[A-Za-z_\/+-]+|UTC)\)/)?.[1];
    return { provider, resetsAt: sec(nextWallClock(now, h, Number(m[2] ?? 0), tz)) };
  }
  if (/\b429\b|rate_limit_exceeded|usage_limit_reached|RESOURCE_EXHAUSTED|quota exceeded/i.test(text)) return { provider, resetsAt: sec(now) + 300 };
  return undefined;
}

/** Verilen saat diliminde bir sonraki HH:MM anı (ms). Geçersiz/eksik dilimde yerel saat. */
export function nextWallClock(now: number, h: number, min: number, tz?: string): number {
  if (!tz) { const d = new Date(now); d.setHours(h, min, 0, 0); if (d.getTime() <= now) d.setDate(d.getDate() + 1); return d.getTime(); }
  try {
    const parts = (t: number) => Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(t).map(p => [p.type, Number(p.value)])) as Record<string, number>;
    const offset = (t: number) => { const p = parts(t); return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(t / 1000) * 1000; };
    for (let add = 0; add <= 1; add++) {
      const p = parts(now); const wall = Date.UTC(p.year, p.month - 1, p.day + add, h, min, 0);
      const guess = wall - offset(wall - offset(wall)); // iki geçiş: yaz saati sınırında doğru ofset
      if (guess > now) return guess;
    }
  } catch { /* bilinmeyen dilim */ }
  return nextWallClock(now, h, min);
}
